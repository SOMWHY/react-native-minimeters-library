# Skia Rendering and Theme Foundation Design

## Goal

Implement Phase 2 of `overview.md`: establish one Skia rendering base, one
immutable source of structural visual tokens, and three built-in dark themes.

## Scope

This phase provides the contracts and shared infrastructure needed by later
visualization modules. It does not implement audio modules, an INI parser, a
theme picker, audio analysis, persistence, or connection logic. INI import
remains deferred until a real MiniMeters sample or authoritative format
description is available.

## Architecture

- Add `@shopify/react-native-skia` as a library peer and development dependency.
  Expo SDK 58 declares Skia `2.14.0` in its bundled native module versions;
  that version's React, React Native, Reanimated, and Worklets peer ranges are
  satisfied by this workspace.
- Define a readonly `STRUCTURAL_TOKENS` object as the sole source for spacing,
  radii, typography, hierarchy, stroke widths, and fixed status colors. Themes
  must not contain or override structural values.
- Define a `VisualizationTheme` contract with a stable id/name and color roles
  for canvas/surface, grid/axis, labels, and visualization traces. Add three
  immutable dark presets: `midnight` (violet/cyan), `ice` (blue/cyan), and
  `ember` (magenta/red/orange). Presets may change colors only.
- Implement `VisualizationCanvas` as the sole owner of Skia `Canvas` setup,
  clipping, background, common grid, measured bounds, and a typed drawing
  context. Future modules render Skia nodes as its children and read the
  context through `useDrawingContext()`. The context exposes measured width and
  height, animated theme colors, structural tokens, and `mapX`/`mapY`
  coordinate helpers. Modules must not create their own Canvas or hard-code
  colors and stroke widths.
- Animate theme prop changes through Reanimated at the drawing base. Only color
  values transition; layout, spacing, typography, radii, and stroke widths stay
  fixed. The library receives the selected theme as a prop and owns no theme
  selection or persistence state.
- Keep coordinate mapping pure. Map values linearly between finite, non-empty
  domains and viewport ranges without clamping; callers clip drawing to the
  viewport. Reject invalid or degenerate domains explicitly.

## Preview and testing

- Add Storybook stories for the canvas and all three presets. Drive the sample
  waveform from the existing documented PCM fixture rather than inventing
  audio fields.
- Add focused tests with Node's built-in test runner for coordinate mapping,
  invalid domains, theme color-role completeness, and the separation between
  presets and structural tokens.
- Verify the enabled Storybook Android bundle, the UI package build/typecheck,
  and the existing mobile tests. Tests remain local and do not connect to a
  server or mock connection, scanning, or persistence services.

## Acceptance criteria

- All three presets render through the same Skia base and structural token
  object.
- Changing the injected theme changes colors only and does not change geometry
  or typography.
- The base provides shared grid and coordinate behavior; future modules have a
  single supported drawing entry point.
- Invalid coordinate domains fail explicitly, while zero-sized layout waits for
  measurement without throwing.
- No INI format is inferred and no application integration behavior is added.
