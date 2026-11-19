# @minimetermobile/ui

Props-driven React Native rendering components for MiniMeters Mobile.

This package is the UI layer only. It does not open a WebSocket, parse audio
protocol frames, calculate audio metrics, manage routes, or persist dashboard
state. Visualization modules (spectrum, vectorscope, waveform, ...) arrive in
later phases; the current release ships the rendering foundation they will use.

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
