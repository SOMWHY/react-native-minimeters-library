# Skia Rendering and Theme Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 Skia drawing base, immutable structural visual tokens, and three built-in color themes.

**Architecture:** Keep theme data and coordinate mapping pure and independently testable. Wrap Skia in `VisualizationCanvas`, which provides common grid, measured bounds, animated theme colors, and coordinate helpers to future modules.

**Tech Stack:** React Native 0.88.1, Expo SDK 58, `@shopify/react-native-skia` 2.14.0, Reanimated 4.7.1, Node's built-in test runner.

**Spec:** [2026-11-19-skia-theme-foundation-design.md](../specs/2026-11-19-skia-theme-foundation-design.md)

## Global Constraints

- `STRUCTURAL_TOKENS` is the only source for spacing, radii, typography, hierarchy, stroke widths, and fixed status colors.
- Themes change color values only; they do not contain or override structural values.
- Theme prop changes animate colors only through Reanimated; geometry and typography remain fixed.
- `VisualizationCanvas` is the only component that creates a Skia `Canvas`; future modules use its drawing context.
- Coordinate mapping is linear, unclamped, and rejects non-finite or degenerate domains.
- Do not implement audio modules, an INI parser, a theme picker, audio analysis, persistence, or connection logic in this phase.
- Keep all tests local; do not connect to a server or mock connection, scanning, or persistence services.

## Review Focus

- A zero-sized measured canvas must wait without throwing; cover the readiness guard with a pure test.
- Degenerate or non-finite coordinate inputs must fail explicitly; cover endpoint, reverse-axis, and invalid-domain cases.
- Built-in themes must expose the same complete color roles without affecting structural tokens; test the contract and preset distinction.
- Changing the injected theme must leave geometry and typography unchanged; keep the Storybook control on one mounted canvas so color interpolation is inspectable.
- Skia/Reanimated peer versions must match this Expo workspace; verify with `npm ls` and a Storybook-enabled Android bundle.

---

### Task 1: Add pure theme and coordinate foundations

**Files:**
- Create: `tests/foundation.test.cjs`
- Create: `src/theme/types.ts`
- Create: `src/theme/structural-tokens.ts`
- Create: `src/theme/themes.ts`
- Create: `src/theme/index.ts`
- Create: `src/drawing/coordinates.ts`
- Create: `src/drawing/canvas-size.ts`
- Modify: `src/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `VisualizationTheme`, `VisualizationColors`, `BUILT_IN_THEMES`, `STRUCTURAL_TOKENS`, `NumericRange`, `mapLinear`, and `isCanvasReady`.
- `mapLinear(value: number, domain: NumericRange, range: NumericRange): number` does not clamp; it throws `TypeError` for non-finite inputs and `RangeError` when the domain endpoints are equal.
- `isCanvasReady(width: number, height: number): boolean` is true only when both dimensions are finite and positive.

- [ ] **Step 1: Write failing contract tests**

Create `tests/foundation.test.cjs`:

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { BUILT_IN_THEMES, STRUCTURAL_TOKENS } = require('../dist');
const { isCanvasReady } = require('../dist/drawing/canvas-size');
const { mapLinear } = require('../dist/drawing/coordinates');

test('maps endpoints, interior values, and reversed axes without clamping', () => {
  assert.equal(mapLinear(0, [0, 10], [0, 100]), 0);
  assert.equal(mapLinear(5, [0, 10], [0, 100]), 50);
  assert.equal(mapLinear(10, [0, 10], [100, 0]), 0);
  assert.equal(mapLinear(15, [0, 10], [0, 100]), 150);
});

test('rejects non-finite values and a degenerate domain', () => {
  assert.throws(() => mapLinear(1, [2, 2], [0, 100]), RangeError);
  assert.throws(() => mapLinear(Number.NaN, [0, 1], [0, 100]), TypeError);
  assert.throws(() => mapLinear(1, [0, 1], [0, Number.POSITIVE_INFINITY]), TypeError);
});

test('waits for a positive measured canvas size', () => {
  assert.equal(isCanvasReady(0, 120), false);
  assert.equal(isCanvasReady(120, 0), false);
  assert.equal(isCanvasReady(Number.NaN, 80), false);
  assert.equal(isCanvasReady(120, Number.POSITIVE_INFINITY), false);
  assert.equal(isCanvasReady(120, 80), true);
});

test('built-in themes have complete color roles and share no structural fields', () => {
  const themes = Object.values(BUILT_IN_THEMES);
  const colorRoles = ['accent', 'axis', 'canvas', 'grid', 'surface', 'text', 'textMuted', 'traces'];

  assert.deepEqual(themes.map(({ id }) => id).sort(), ['ember', 'ice', 'midnight']);
  for (const theme of themes) {
    assert.deepEqual(Object.keys(theme).sort(), ['colors', 'id', 'name']);
    assert.deepEqual(Object.keys(theme.colors).sort(), colorRoles);
    assert.deepEqual(Object.keys(theme.colors.traces).sort(), [
      'high',
      'left',
      'low',
      'mid',
      'primary',
      'right',
      'secondary',
    ]);
    assert.equal('spacing' in theme, false);
  }
  assert.equal(new Set(themes.map(({ colors }) => JSON.stringify(colors))).size, 3);
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS));
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS.spacing));
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS.statusColors));
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test --workspace=@minimetermobile/ui`

Expected: FAIL because the theme, coordinate, and canvas-size exports do not exist yet.

- [ ] **Step 3: Implement the pure contracts**

In `src/theme/types.ts`, define readonly `VisualizationColors` with string roles `canvas`, `surface`, `grid`, `axis`, `text`, `textMuted`, `accent`, and nested trace roles `primary`, `secondary`, `left`, `right`, `low`, `mid`, and `high`. Define `VisualizationTheme` with `id`, `name`, and `colors`.

```ts
export interface VisualizationColors {
  readonly canvas: string;
  readonly surface: string;
  readonly grid: string;
  readonly axis: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly traces: {
    readonly primary: string;
    readonly secondary: string;
    readonly left: string;
    readonly right: string;
    readonly low: string;
    readonly mid: string;
    readonly high: string;
  };
}

export interface VisualizationTheme {
  readonly id: string;
  readonly name: string;
  readonly colors: VisualizationColors;
}
```

In `src/theme/structural-tokens.ts`, export a recursively frozen `STRUCTURAL_TOKENS` object:

```ts
{
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radii: { sm: 4, md: 8, lg: 12 },
  typography: {
    fontFamily: 'monospace',
    fontWeight: { regular: '400', medium: '500', bold: '700' },
    micro: 9,
    label: 11,
    body: 13,
    heading: 16,
  },
  strokeWidth: { hairline: 0.75, fine: 1, regular: 1.5, strong: 2 },
  grid: { subdivisions: 4 },
  hierarchy: { background: 0, grid: 1, trace: 2, label: 3, overlay: 4 },
  statusColors: { good: '#55D68B', warning: '#F4C95D', error: '#FF5A6F' },
  motion: { themeTransitionMs: 180 },
}
```

In `src/theme/themes.ts`, export `BUILT_IN_THEMES` with immutable `midnight`, `ice`, and `ember` entries. Give every entry all color roles from `VisualizationColors`; use these exact initial palettes:

| Theme | Canvas / surface / grid / axis / text / muted / accent | Traces: primary / secondary / left / right / low / mid / high |
|---|---|---|
| `midnight` | `#080A12` / `#10131E` / `#252A3A` / `#444B62` / `#DCE1F0` / `#8A91A8` / `#B85CFF` | `#A855F7` / `#22D3EE` / `#38BDF8` / `#F472B6` / `#6366F1` / `#D946EF` / `#F97316` |
| `ice` | `#071015` / `#0D1920` / `#1C3039` / `#385864` / `#DAEEF1` / `#819AA3` / `#38BDF8` | `#0EA5E9` / `#22D3EE` / `#38BDF8` / `#A78BFA` / `#2DD4BF` / `#3B82F6` / `#67E8F9` |
| `ember` | `#120A0B` / `#1B1012` / `#372125` / `#604047` / `#F4E0E2` / `#AD858A` / `#F43F5E` | `#F43F5E` / `#FB923C` / `#FB7185` / `#F97316` / `#EC4899` / `#EF4444` / `#FACC15` |

Do not put spacing, radius, typography, hierarchy, status, or stroke fields in a theme.

In `src/drawing/coordinates.ts`, implement `mapLinear` by validating every number with `Number.isFinite`, rejecting `domain[0] === domain[1]`, then returning `range[0] + ((value - domain[0]) / (domain[1] - domain[0])) * (range[1] - range[0])`. Do not clamp out-of-domain values.

In `src/drawing/canvas-size.ts`, implement `isCanvasReady` as a finite-positive-dimensions guard. Export `BUILT_IN_THEMES`, `STRUCTURAL_TOKENS`, `mapLinear`, and `isCanvasReady` from `src/index.ts`. Set the package `test` script to `npm run build && node --test tests/foundation.test.cjs && node scripts/workspace-smoke.cjs`.

- [ ] **Step 4: Run the pure foundation tests**

Run: `npm test --workspace=@minimetermobile/ui`

Expected: the new tests and existing workspace smoke check pass.

- [ ] **Step 5: Commit the pure foundation**

```powershell
git add package.json src/index.ts src/theme src/drawing/coordinates.ts src/drawing/canvas-size.ts tests/foundation.test.cjs
git commit -m "feat: add theme and drawing tokens" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Implement the Skia drawing base

**Files:**
- Modify: `package.json`
- Modify: `example/package.json`
- Create: `src/drawing/types.ts`
- Create: `src/drawing/DrawingContext.tsx`
- Create: `src/drawing/useAnimatedThemeColors.ts`
- Create: `src/drawing/VisualizationCanvas.tsx`
- Create: `src/drawing/index.ts`
- Modify: `package-lock.json` (standalone workspace)
- Modify: `..\package-lock.json` (parent workspace)

**Interfaces:**
- `VisualizationCanvas` accepts `{ theme: VisualizationTheme, showGrid?: boolean, style?: StyleProp<ViewStyle>, children?: ReactNode }`.
- `useDrawingContext()` returns `width`, `height`, `theme`, `STRUCTURAL_TOKENS`, animated color roles, `mapX(value, domain)`, and `mapY(value, domain)`.
- `mapX` maps the supplied domain to `[0, width]`; `mapY` maps it to `[height, 0]`.

- [ ] **Step 1: Add Skia as a peer and install the Expo-matched native package**

Add `@shopify/react-native-skia: 2.14.0` to the UI package's `peerDependencies` and `devDependencies`. Add `react-native-worklets: >=0.7.0` to peer dependencies and `0.13.0` to dev dependencies to satisfy Skia's peer contract. From the example, run `npx expo install @shopify/react-native-skia`; keep the resolved Expo SDK version.

Update both lockfiles:

```powershell
Set-Location D:\web_dev_projects\MiniMetersMobile
npm install
npm --prefix D:\web_dev_projects\MiniMetersMobile\react-native-minimeters-library install --package-lock-only
```

Expected: Expo selects Skia `2.14.0`; Storybook and Skia remain outside the regular `dependencies` of the UI package.

- [ ] **Step 2: Define the typed drawing context**

In `src/drawing/types.ts`, import `NumericRange` from `coordinates.ts`, define `AnimatedVisualizationColors` with a `SharedValue<string>` for every `VisualizationColors` role, and:

```ts
export interface DrawingContextValue {
  width: number;
  height: number;
  theme: VisualizationTheme;
  colors: AnimatedVisualizationColors;
  tokens: typeof STRUCTURAL_TOKENS;
  mapX(value: number, domain: NumericRange): number;
  mapY(value: number, domain: NumericRange): number;
}
```

In `DrawingContext.tsx`, provide the context and `useDrawingContext()`. Throw an explicit error when the hook is used outside `VisualizationCanvas`.

- [ ] **Step 3: Add Reanimated color interpolation**

Implement `useAnimatedThemeColors(theme)` with Reanimated shared values. Keep a shared progress value and the previous/target palette; when the theme prop changes, reset progress to `0`, run `withTiming(1, { duration: STRUCTURAL_TOKENS.motion.themeTransitionMs })`, and derive every role using `interpolateColor(progress, [0, 1], [previous, target])`. Keep colors in `SharedValue<string>` fields for Skia children; do not animate or mutate any structural token.

- [ ] **Step 4: Implement `VisualizationCanvas`**

Render a measured React Native `View` containing the sole Skia `Canvas`. On layout, update the measured dimensions. When `isCanvasReady(width, height)` is false, render no grid or child drawing and do not throw. Otherwise draw the background and `STRUCTURAL_TOKENS.grid.subdivisions` evenly spaced horizontal/vertical grid divisions using theme `canvas`/`grid` colors and `strokeWidth.hairline`, then render children inside the same Canvas and provide `DrawingContextValue` around the Canvas subtree.

Implement `mapX` and `mapY` by calling the tested `mapLinear`; `mapY` uses the reversed viewport `[height, 0]`. Export `VisualizationCanvas`, `DrawingContextValue`, and `useDrawingContext` from the drawing barrel and package root.

- [ ] **Step 5: Verify package and Expo integration**

Run:

```powershell
npm ls --workspace=@minimetermobile/ui @shopify/react-native-skia react-native-worklets
npm run typecheck --workspace=@minimetermobile/ui
npm run typecheck --workspace=@minimetermobile/ui-example
```

Expected: Skia and Worklets peer requirements are satisfied and both packages typecheck.

- [ ] **Step 6: Commit the Skia base**

```powershell
git add package.json package-lock.json example/package.json src/drawing src/index.ts
git commit -m "feat: add shared Skia visualization canvas" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Preview the foundation and complete Phase 2

**Files:**
- Create: `example/.rnstorybook/stories/Canvas.stories.tsx`
- Modify: `README.md`
- Modify: `TODO.md`
- Modify: `scripts/workspace-smoke.cjs`

**Interfaces:**
- Consumes: `VisualizationCanvas`, `BUILT_IN_THEMES`, `useDrawingContext`, `pcmFrame`, and the local Storybook on-device controls.
- Produces: an isolated Storybook story that renders the documented PCM fixture through the shared canvas and lets developers inspect all three palettes.

- [ ] **Step 1: Add the Storybook canvas preview**

Create a Storybook story with a fixed-height host `View`, `VisualizationCanvas`, and a small child component that reads `useDrawingContext()`. Draw four points from the left PCM channel using `pcmFrame.samples[index * pcmFrame.channels]`; map indices in `[0, pcmFrame.samplesPerChannel - 1]` with `mapX` and fixture amplitudes in `[-0.5, 0.5]` with `mapY`. Use `colors.traces.primary` and `tokens.strokeWidth.regular`; do not introduce mock audio fields or network/server code.

Expose the `midnight`, `ice`, and `ember` themes as a Storybook select control on one mounted story:

```ts
argTypes: {
  theme: {
    control: 'select',
    options: ['midnight', 'ice', 'ember'],
    mapping: BUILT_IN_THEMES,
  },
}
```

Changing the arg exercises color interpolation without a layout remount. Keep the Storybook selection UI out of the published UI package.

- [ ] **Step 2: Extend the package smoke check**

Update `scripts/workspace-smoke.cjs` to assert that Skia is declared as a peer dependency, not a regular dependency. Preserve the existing package-entry and React Native peer assertions.

- [ ] **Step 3: Document the rendering foundation**

Update `README.md` with the public theme exports, the `VisualizationCanvas`/`useDrawingContext()` usage boundary, and the rule that modules use the shared grid, color roles, and structural tokens. State that INI parsing remains deferred.

- [ ] **Step 4: Verify the full Phase 2 acceptance set**

Run from the standalone library root:

```powershell
npm test
npm run typecheck
npm run typecheck:example
npm pack --dry-run
Set-Location D:\web_dev_projects\MiniMetersMobile\react-native-minimeters-library\example
npx cross-env STORYBOOK_ENABLED=true expo export --platform android --clear
```

Run the host mobile regression suite from `D:\web_dev_projects\MiniMetersMobile`:

```powershell
npm test --workspace=minimeters-mobile
```

Expected: pure tests pass; the Storybook-enabled Android bundle contains the canvas story; mobile tests stay green; `npm pack --dry-run` includes the Skia peer contract but excludes `example/` and Storybook runtime files.

- [ ] **Step 5: Mark Phase 2 complete**

Mark only Phase 2 complete in `TODO.md`. Keep visualization modules, dashboard work, host integration, and deferred INI import unchecked.

- [ ] **Step 6: Commit the preview and Phase 2 completion**

```powershell
git add README.md TODO.md example/.rnstorybook/stories/Canvas.stories.tsx scripts/workspace-smoke.cjs
git commit -m "feat: preview Skia theme foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
