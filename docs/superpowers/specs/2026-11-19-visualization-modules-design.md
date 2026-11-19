# Visualization Modules Design

## Goal

Implement Phase 3 of `overview.md`: the seven visualization modules (spectrum,
vectorscope, waveform, loudness, oscilloscope, spectrogram, VU) on top of the
Phase 2 Skia base, each with a ready state, a waiting state, an invalid state,
and an isolated Storybook preview.

## Scope

In scope:

- Prepared-data prop contracts for all seven modules.
- Pure display-preparation helpers (decimation, stereo projection, dB
  normalization, heatmap rasterization) with unit tests.
- One shared module surface that owns measurement, the canvas, and the overlay
  that carries labels and placeholders.
- Three render states for every module, plus defensive handling of boundary
  values.
- Storybook stories covering ready / waiting / invalid and all three presets.

Out of scope (later phases or other owners):

- Dashboard grid, drag, resize, visibility, gravity fill, auto-placement
  (Phase 4 in `overview.md`).
- Card chrome: title bar, drag handle, resize handle, visibility toggle
  (Phase 4, delivered by the dashboard container).
- MiniMeters INI theme import (deferred until a real sample exists).
- Decoding the binary protocol, FFT/LUFS/peak/RMS computation, WebSocket,
  persistence, routing, accounts (host application responsibilities).

## Analysis boundary (decided)

`docs/data-contract.md` states the library must not decode the wire format or
calculate audio metrics, and the server only sends raw PCM. The chosen split is
**display preparation only**:

- The **host** decodes frames and computes audio metrics: FFT bins, peak, RMS,
  LUFS, VU ballistics, spectrogram history.
- The **library** converts already-computed values into screen coordinates and
  pixels: decimating a PCM block into envelope columns, projecting stereo pairs
  into goniometer coordinates, normalizing a dB range into `0..1`, rasterizing a
  spectrogram row set into RGBA pixels.

Display preparation must stay pure, synchronous, allocation-bounded, and
directly unit-testable without React Native or Skia. It must never invent a
metric, apply a smoothing/analysis window, or synthesize data when a prop is
absent.

Consequence: modules whose required values the server does not send still ship,
but they render their waiting state until the host provides those values. Their
Storybook stories feed prepared fixture values that are examples of host output,
not claims about server fields.

## Module surface

Each module is a single component that accepts a prepared data prop, a theme,
and a fixed surface height, and renders through the shared base:

```
<WaveformModule theme={theme} data={pcmFrame} height={160} />
```

- `VisualizationCanvas` (Phase 2) remains the only Skia `Canvas`, the only grid
  painter, and the only owner of animated theme colors.
- The module surface adds a measured host `View` with the requested height, the
  canvas, and an absolutely positioned React Native overlay used for text.
- Text (labels, waiting/invalid placeholders, numeric readouts) is React Native
  text, not Skia paragraphs. Rationale: it avoids bundling a font asset and
  keeping a font loader in the library, and text is chrome rather than data
  drawing. All *drawing* still goes through the canvas base.
- Overlay text uses `STRUCTURAL_TOKENS.typography` and the injected
  `colors.text` / `colors.textMuted`; no hardcoded sizes, colors, or spacing.
- Modules never read the theme directly from props for drawing; they read
  `useDrawingContext()` inside the canvas child so colors stay animated.

## Render states

Every module resolves one of three states before drawing:

| State | Trigger | Rendering |
|---|---|---|
| `ready` | required values present, finite, and non-degenerate | draw normally |
| `waiting` | prop absent, `null`, or empty | placeholder text, canvas background and grid only |
| `invalid` | required values present but non-finite (`NaN`, `±Infinity`) or structurally inconsistent (e.g. `samplesPerChannel` disagreeing with the sample buffer, empty row widths) | placeholder text, no trace drawing |

Rules that hold for every module:

- Finite values outside the expected range are clamped, not rejected: clipping
  an over-range peak is normal meter behavior.
- Silence (all-zero samples, all-zero bins, a zero-length dB meter) is valid
  data and must draw, not show a placeholder.
- A module never throws for malformed data, never blocks rendering of sibling
  modules, and never leaves a stale trace behind when it transitions to
  `waiting` or `invalid`.
- A zero measured canvas size draws nothing and shows no placeholder; it waits
  for layout, matching the Phase 2 contract.
- State resolution is a pure function per module so it can be tested without a
  renderer.

## Data contracts

All shapes below are the library's *input* contract, prepared by the host. Only
the raw PCM shape corresponds to something the server actually sends.

### Shared

```ts
export type ModuleStatus = 'ready' | 'waiting' | 'invalid';

/** The documented server frame, structurally (no import from the host app). */
export type PcmBlock = {
  readonly samples: ArrayLike<number>; // interleaved: L0,R0,L1,R1,...
  readonly channels: number;
  readonly samplesPerChannel: number;
};

export type ModuleBaseProps = {
  readonly theme: VisualizationTheme;
  readonly height?: number; // default 160
  readonly style?: StyleProp<ViewStyle>;
};
```

### Waveform — `waveform`

- Props: `{ data?: PcmBlock | null; channel?: number; columns?: number }`.
- Preparation: `toEnvelopeColumns(block, columns)` decimates the selected
  channel into min/max pairs, one pair per column.
- Drawing: a filled `Path` band between the per-column minimum and maximum
  (`colors.traces.primary`), plus a hairline zero axis (`colors.axis`).

```ts
export type EnvelopeColumns = { min: Float32Array; max: Float32Array };
```

### Oscilloscope — `oscilloscope`

- Props: `{ data?: PcmBlock | null; channel?: number; points?: number }`.
- Preparation: `toTraceSamples(block, points)` decimates the selected channel to
  at most `points` samples by stride.
- Drawing: one polyline `Path` (`colors.traces.primary`,
  `tokens.strokeWidth.regular`), clamped to the viewport box.

### Vectorscope — `vectorscope`

- Props: `{ data?: PcmBlock | null; points?: number }`.
- Preparation: `toStereoPoints(block, points)` reads interleaved left/right
  pairs and projects them with the standard goniometer rotation:
  `x = (right - left) / Math.SQRT2`, `y = (right + left) / Math.SQRT2`.
- Drawing: small circles (`colors.traces.primary`) over the diagonal and
  mid-side axes (`colors.axis`).

```ts
export type StereoPoint = { x: number; y: number };
```

### Spectrum — `spectrum`

- Props: `{ data?: { bins: ArrayLike<number>; dbRange?: NumericRange } | null }`.
- The host supplies FFT magnitudes already expressed in dB, ordered from low to
  high frequency (log-spaced if it wants log axis behavior; the module maps bin
  index linearly to X).
- Preparation: `normalizeBins(bins, dbRange)` maps dB into `0..1`, clamping
  outside the range.
- Drawing: a filled area `Path` under the curve using an animated
  `LinearGradient` between `colors.traces.low` and `colors.traces.high`, plus a
  stroke on the curve using `colors.traces.primary`.

Default `dbRange` is `[-90, 0]`.

### VU — `vu`

- Props: `{ data?: { left: number; right: number; leftPeak?: number; rightPeak?: number } | null }`.
- Values are linear `0..1`; the host applies its ballistics and peak hold.
- Preparation: `clampUnit` for the level and the optional peak markers.
- Drawing: two meter bars with a three-stop gradient
  (`colors.traces.low` → `colors.traces.mid` → `colors.traces.high`), track
  (`colors.surface`), and optional peak ticks (`colors.text`).

### Loudness — `loudness`

- Props: `{ data?: { peak: number; rms: number; lufs: number } | null; dbRange?: NumericRange }`.
- All three values are dB relative to full scale; default `dbRange` is
  `[-60, 0]`.
- Preparation: `toMeterScale(value, dbRange)` → `0..1`.
- Drawing: three horizontal bars (`peak` → `colors.traces.high`, `rms` →
  `colors.traces.mid`, `lufs` → `colors.traces.primary`) plus readout text in
  the overlay using `typography.micro`.

### Spectrogram — `spectrogram`

- Props: `{ data?: { rows: ArrayLike<ArrayLike<number>> } | null; maxRows?: number }`.
- `rows` are host-computed spectra, newest row last, each row's values already
  normalized `0..1`; every row must have the same length (all rows with a
  different length classify as `invalid`).
- Preparation: `toSpectrogramPixels(rows, maxRows, ramp)` rasterizes rows into
  RGBA `Uint8Array` (row → Y, bin → X) using a three-stop color ramp derived
  from the theme's `traces.low`/`traces.mid`/`traces.high`.
- Drawing: `Skia.Image.MakeImage` with
  `{ colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul, width, height }`
  and `Skia.Data.fromBytes(bytes)`, then `<Image image={...} fit="fill" ... />`
  across the plot area. This API pair is verified in the installed Skia `2.14.0`
  type declarations.
- Consequence of the image approach: existing rows re-tint on the next raster
  update rather than during a theme transition. This is accepted and documented;
  geometry still never jumps.

## Display preparation API

New pure module `src/modules/display.ts` (no React, no Skia, no native imports):

```ts
toEnvelopeColumns(block: PcmBlock, columns: number, channel?: number): EnvelopeColumns
toTraceSamples(block: PcmBlock, points: number, channel?: number): Float32Array
toStereoPoints(block: PcmBlock, points?: number): StereoPoint[]
normalizeBins(bins: ArrayLike<number>, dbRange?: NumericRange): Float32Array
toMeterScale(value: number, dbRange: NumericRange): number
clampUnit(value: number): number
toSpectrogramPixels(rows, maxRows, ramp: readonly string[]): SpectrogramPixels
isSpectrogramValid(rows): boolean
```

Guarantees: pure, deterministic, no allocation proportional to input size beyond
the requested output size, all outputs finite, and all functions throw only on
programmer error (non-positive `columns`/`points`), never on data defects —
defective data is reported through the module's state classifier.

## State classifiers

Each module exposes a pure classifier next to its component, e.g.
`resolveWaveformState(block | null | undefined): ModuleStatus`. Classifiers are
exported so the host and tests can assert behavior without rendering. They live
in `src/modules/*/state.ts`.

## Preview

Storybook (`example/.rnstorybook/stories/Modules/`) gets one story file per
module with three stories each — `Ready`, `Waiting`, `Invalid` — and a theme
select control mapped through `BUILT_IN_THEMES`, mirroring the Phase 2 canvas
story. Fixtures:

- Raw-PCM modules use the documented fixture in `example/fixtures/pcm-frame.ts`.
- Derived-value modules (spectrum, loudness, VU, spectrogram) use new fixture
  files under `example/fixtures/` that are explicitly documented as
  host-prepared example output, not server fields.

## Testing

Node's built-in test runner, no renderer:

- Display preparation: endpoints, interior values, column/point counts larger
  than the input, silence, single-sample blocks, reversed and degenerate dB
  ranges, clamping of out-of-range values, spectrogram raster size and channel
  consistency, and that no output is non-finite.
- State classifiers: absent, `null`, empty, non-finite, and structurally
  inconsistent inputs for every module.
- Theme/token invariants stay covered by the Phase 2 tests; module components
  are additionally covered by the bundle check below.

Verification per task: `npm test` (build + node tests + workspace smoke),
`npm run typecheck`, `npm run typecheck:example`, and a Storybook-enabled
Android bundle export that must contain every module story.

## Acceptance criteria

- All seven modules exist, are exported from the package root, and render
  through `VisualizationCanvas` only.
- Every module implements ready, waiting, and invalid states, and silence draws
  rather than showing a placeholder.
- No module hardcodes a color, stroke width, spacing, or radius; all come from
  the theme colors or `STRUCTURAL_TOKENS`.
- Display preparation and state classification are pure and unit tested.
- Every module has an isolated Storybook preview for all three states and the
  theme select works across the three presets.
- Package build, typecheck, example typecheck, node tests, and the Storybook
  Android bundle all pass, and the host app's existing test suite still passes.
