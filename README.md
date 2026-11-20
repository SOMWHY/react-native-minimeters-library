# @minimetermobile/ui

Props-driven React Native rendering components for MiniMeters Mobile.

This package is the UI layer only. It does not open a WebSocket, parse audio
protocol frames, calculate audio metrics, manage routes, or persist dashboard
state. It renders the visualization modules (waveform, oscilloscope,
vectorscope, spectrum, VU, loudness, spectrogram) and the Skia foundation they
share; the host application remains the owner of audio analysis.

## Visual direction

Components use dark surfaces, compact technical labels, subtle gray/blue grids,
and saturated violet, magenta, red, cyan, blue, and orange audio accents. The
supplied screenshots are references, not assets.

## Rendering foundation

Two kinds of data drive every module:

- **Structural tokens** (`STRUCTURAL_TOKENS`) are the single source for spacing,
  radii, typography, hierarchy, stroke widths, grid density, fixed status colors,
  and motion durations. They are deeply frozen and identical in every theme.
- **Color roles** (`VisualizationColors`) come from a `VisualizationTheme`. Themes
  only carry colors; they never override structural values.

```ts
import { BUILT_IN_THEMES, STRUCTURAL_TOKENS } from '@minimetermobile/ui';

BUILT_IN_THEMES.midnight; // also: .ice, .ember
STRUCTURAL_TOKENS.grid.subdivisions;
STRUCTURAL_TOKENS.strokeWidth.hairline;
```

Every theme exposes the same roles: `canvas`, `surface`, `grid`, `axis`, `text`,
`textMuted`, `accent`, and `traces.{primary,secondary,left,right,low,mid,high}`.

### Canvas and drawing context

`VisualizationCanvas` is the only component that creates a Skia `Canvas`. It
measures its host view, paints the background and the shared grid, and provides a
drawing context to its children:

```tsx
import {
  BUILT_IN_THEMES,
  VisualizationCanvas,
  useDrawingContext,
} from '@minimetermobile/ui';
import { Path, Skia } from '@shopify/react-native-skia';

function Trace() {
  const { width, height, colors, tokens, mapX, mapY } = useDrawingContext();
  // mapX domain -> [0, width]; mapY domain -> [height, 0] (audio grows upward)
  // ...build a Skia path from your own data...
}

<View style={{ height: 240 }}>
  <VisualizationCanvas theme={BUILT_IN_THEMES.midnight}>
    <Trace />
  </VisualizationCanvas>
</View>;
```

`useDrawingContext()` returns `width`, `height`, `theme`, `colors` (one animated
`SharedValue<string>` per color role), `tokens` (`STRUCTURAL_TOKENS`), `mapX`, and
`mapY`. Calling it outside a `VisualizationCanvas` throws.

Rules for module authors:

- Use the injected grid, color roles, and structural tokens; do not hardcode
  colors, stroke widths, or typography.
- Animate color only. Theme transitions interpolate colors through Reanimated on
  the UI thread; geometry and typography stay fixed.
- Do not create another Skia `Canvas`.
- A zero-sized measurement renders nothing instead of throwing, so modules must
  not assume a ready canvas during the first layout pass.
- `mapX`/`mapY` are linear and unclamped; non-finite inputs throw `TypeError` and
  a degenerate domain throws `RangeError`.

Pure helpers `mapLinear` and `isCanvasReady` are exported for testing.

## Visualization modules

Seven modules ship in this release. Each one is a props-driven surface: the host
application owns decoding, analysis, and history, and hands the module
*display-ready* values.

| Module | Props | Draws |
| --- | --- | --- |
| `WaveformModule` | `block`, `channel`, `columns` | Filled min/max envelope band plus the zero axis |
| `OscilloscopeModule` | `block`, `channel`, `points` | Single decimated polyline over an opaque surface |
| `VectorscopeModule` | `block`, `points` | Projected stereo dots with diagonal and mid-side axes |
| `SpectrumModule` | `bins`, `dbRange` | Filled area under the normalized dB curve, `low`→`high` gradient |
| `VuModule` | `data: { left, right, leftPeak?, rightPeak? }` | Two bars on a gradient track with optional peak ticks |
| `LoudnessModule` | `data: { peak, rms, lufs }`, `dbRange` | Three horizontal dB meters with numeric readouts |
| `SpectrogramModule` | `rows`, `maxRows` | Scrolling RGBA history image, newest rows kept |

Every module also accepts `theme`, `height`, `label`, and `style`. `label` is
opt-in: omit it and the module draws no caption, which is what you want inside a
dashboard card that already prints a title.

```tsx
import { WaveformModule, BUILT_IN_THEMES } from '@minimetermobile/ui';

<WaveformModule
  theme={BUILT_IN_THEMES.midnight}
  block={{ samples, channels: 2, samplesPerChannel: frames }}
  height={160}
/>;
```

### Prepared-data boundary

The library **displays**; it does not analyze. It never decodes the wire format
and never computes FFT, peaks, RMS, or LUFS. Concretely:

- PCM modules take an interleaved `PcmBlock` (`{ samples, channels,
  samplesPerChannel }`). Decimation to columns/points happens here because it is
  a display transform, not an audio metric.
- `SpectrumModule` takes dB magnitude bins the host already computed.
- `SpectrogramModule` takes normalized rows (`0..1`, oldest first) the host
  already computed.
- `VuModule` takes normalized `0..1` levels; `LoudnessModule` takes dB values.

See `docs/data-contract.md` for the authoritative boundary.

## Dashboard container

`DashboardGrid` lays modules out on an integer cell grid and owns no state: the
host passes a `DashboardLayout` and receives every settled change through
`onLayoutChange`.

```tsx
import {
  DashboardGrid,
  compact,
  DEFAULT_GRID_CONFIG,
  GRID_PRESETS,
  WaveformModule,
  BUILT_IN_THEMES,
} from '@minimetermobile/ui';

const THEME = BUILT_IN_THEMES.midnight;

const [layout, setLayout] = useState<DashboardLayout>(() => ({
  items: compact(initialItems, DEFAULT_GRID_CONFIG),
}));

<DashboardGrid
  layout={layout}
  theme={THEME}
  config={DEFAULT_GRID_CONFIG}
  metrics={GRID_PRESETS.phone}
  editing={editing}
  onLayoutChange={setLayout}
  renderModule={(item, rect) => (
    <WaveformModule theme={THEME} block={blocks[item.id]} height={rect.height} />
  )}
/>;
```

`renderModule` also receives the resolved `CellRect`. Pass `rect.height` as the
module height so the plot fills the card the user resized — the grid is the only
thing that knows the measured column width.

### Layout model

- `DashboardItem` is `{ id, kind, placement: { col, row, colSpan, rowSpan }, visible, label? }`.
  Everything the grid draws comes from that object.
- Hidden items keep their placement in the array. Gravity compaction skips them,
  so a deleted card does not permanently reserve a hole it may want back.
- Every mutation returns a new `DashboardItem[]` and never mutates its input
  (`moveItem`, `resizeItem`, `setVisibility`, `compact`, `normalizeLayout`,
  `resetLayout`).
- `moveItem` and `resizeItem` place the card at the target and stop there. They
do **not** compact afterwards, so moving one card never re-shuffles the rest of
the layout behind the user's back. Run `compact` explicitly if you want gravity.
- `resizeItem` clamps to the last legal span when a span would exceed
  `maxColSpan`, `maxRowSpan`, or collide — the card stops at the last legal size
  rather than overlapping its neighbour.

### Editing interactions

Drag and resize are `PanResponder` gestures, not Reanimated worklets: the drag
path writes a settled layout once, on release, and nothing animates the layout
array in between.

- In edit mode the whole card is the drag surface, but a drag only starts after a
  still hold of `DRAG_HOLD_MS` (150 ms). Before that the responder stays passive,
  so an ordinary swipe scrolls the page instead of picking the card up — which is
  what breaks when a grid lives inside a `ScrollView`.
- `shouldArmDrag` / `shouldCancelArm` / `DRAG_CANCEL_DISTANCE` are the pure rules
  behind that hold: movement beyond the cancel distance before the hold elapses
  hands the gesture back to the scroll view.
- The responder callbacks are created once and read from refs, so a re-render
  mid-gesture cannot swap them out from under PanResponder.
- Mid-gesture the card follows the finger through a `transform` (drag) or a pixel
  size delta (resize). The layout array is untouched until release, so
  `onLayoutChange` only ever fires with positions the host can persist directly.
- The resize grabber is a 32 dp corner hit area (with `hitSlop`) — big enough for
  a thumb, and it grows a sized-down card rather than burying the target.
- `dragDeltaToCells` and `resizeDeltaToSpans` convert a pixel delta into a cell
  target and clamp it to the grid; both are pure and unit-tested without React.
- Outside edit mode no responder is created at all, so a scroll gesture over the
  grid is never intercepted.
- `ModuleTray` lists hidden modules and restores them through `setVisibility`,
  which finds a free slot and recompacts. It renders nothing when everything is
  visible.
- The card draws one title, not two: the modules no longer default their `label`,
  and the card header keeps `label ?? id`.

### Module states

Every module classifies its input before drawing and never invents data:

- `ready` — the input is present, finite, and structurally consistent.
- `waiting` — the input is absent, `null`, or empty. The surface shows
  `WAITING FOR DATA`.
- `invalid` — the input is present but non-finite or inconsistent (a mismatched
  `samplesPerChannel`, a mono block handed to the vectorscope, an inverted dB
  window, ragged spectrogram rows). The surface shows `INVALID DATA`.

Out-of-range values that are still meaningful are clamped rather than rejected:
VU levels above `1` clamp to full scale, and dB values outside `dbRange` clamp to
the meter ends. `ModuleSurface` renders the shared shell (host view, single
`VisualizationCanvas`, and a React Native label/readout overlay), so module text
stays in React Native and no Skia font asset is bundled.

`VisualizationCanvas` owns the `Canvas` and provides the drawing context, so a
module's content can call `useDrawingContext` without knowing where it is
mounted. On Android the canvas is a `TextureView`: layer-backed hosts (an
`Animated` wrapper, a transparent overlay) then composite the plot instead of
leaving a black hole.

The dashboard container is display-only for the same reason: it places modules and
reports where the user put them. Layout persistence, edit-mode chrome, and
per-device preferences belong to the host app.

## Peer dependencies

The host app provides React Native, Reanimated, Gesture Handler, Skia, and
Worklets. Skia and Worklets versions are pinned by the host Expo SDK, which is why
they are peers here and never runtime dependencies.

## Deferred

Importing MiniMeters INI themes is not implemented: it waits for a real sample or
an authoritative format source.

## Development

This folder can be installed and developed as a standalone npm workspace:

```sh
npm install
npm run build
npm run typecheck
npm test
npm run start:ui-example
npm run start:ui-storybook
```

The Expo example consumes this package through a local `file:..` dependency and
hosts the on-device Storybook preview of the canvas foundation.
