# MiniMeters UI Library Progress

## Completed
- [x] Product scope and repository paths verified.
- [x] Full-library scope and phase split approved.
- [x] Phase 1 delivered: workspace package, verified data contract, and isolated Expo example.
- [x] On-device Storybook integrated into the isolated Expo example with a local-fixture smoke story.
- [x] Phase 2 delivered: Skia drawing base, structural tokens, and three built-in themes.
- [x] Phase 3 delivered: seven visualization modules with state classifiers, display helpers, and Storybook stories.
- [x] Phase 4 delivered: pure grid layout (`compact`, `moveItem`, `resizeItem`, `setVisibility`) plus the editable dashboard (drag, grid-stepped resize, hidden tray).
- [x] Phase 5 step 1 delivered: live PCM dashboard host wiring (shared pairing provider, persisted layout and theme, `renderModule` cell rect, raw diagnostics moved to a second tab). Device acceptance still pending.
- [x] Phase 5 step 2 delivered: host analysis engine (`fft.ts` radix-2 FFT, `analysis.ts` bin/level mapping, `loudness.ts` BS.1770-4 momentary LUFS, `ballistics.ts` VU attack/release plus peak hold, `engine.ts` state across frames, `history.ts` spectrogram rows). The four waiting modules are live. Device acceptance still pending.

## Phase 1 — Foundation and data contract
- [x] npm workspace and `@minimetermobile/ui` package scaffold.
- [x] Verified `docs/data-contract.md`.
- [x] Isolated Expo example app with local fixtures.

## Phase 2 — Skia rendering and theme foundation
- [x] Immutable `STRUCTURAL_TOKENS` (spacing, radii, typography, hierarchy, strokes, grid, status colors, motion).
- [x] `midnight`, `ice`, and `ember` color themes sharing one complete role contract.
- [x] Pure `mapLinear` / `isCanvasReady` helpers with degenerate-input guards.
- [x] `VisualizationCanvas`: the only Skia `Canvas`, shared grid, measured bounds, animated theme colors.
- [x] `useDrawingContext()` with `width`, `height`, `theme`, `colors`, `tokens`, `mapX`, and `mapY`.
- [x] Contract tests, package smoke check, and on-device Storybook canvas preview.

## Phase 3 — Visualization modules
- [x] Shared `ModuleSurface` shell, `ModuleStatus` states (`ready`/`waiting`/`invalid`), and pure display helpers.
- [x] `WaveformModule`: min/max envelope band with zero axis.
- [x] `OscilloscopeModule`: decimated polyline over an opaque surface.
- [x] `VectorscopeModule`: goniometer dots with diagonal and mid-side axes.
- [x] `SpectrumModule`: normalized dB area with `low`→`high` gradient.
- [x] `VuModule`: two gradient bars with optional peak ticks.
- [x] `LoudnessModule`: peak/RMS/LUFS meters with numeric readouts.
- [x] `SpectrogramModule`: pure RGBA rasterizer plus `Skia.Image` history image.
- [x] Storybook stories (`Ready`/`Waiting`/`Invalid` + theme select) for all seven modules.

## Phase 4 — Dashboard container and editing
- [x] Layout model (`DashboardItem`, `DashboardLayout`, `GridConfig`) with clone-on-write layout updates.
- [x] Pure geometry (`colWidth`, `cellRect`, `layoutRects`, `gridHeight`) and gravity compaction that skips hidden items.
- [x] Pure mutations with explicit outcomes: `moveItem`, `resizeItem` (returns `blocked` past `maxColSpan`), `setVisibility`, `hiddenItems`.
- [x] `DashboardGrid`: measured width, zero-width first-frame guard, controlled `onLayoutChange`.
- [x] `ModuleCard` affordances by mode plus `DraggableCard` drag and resize gestures (pixel preview, cell snap on release).
- [x] `ModuleTray` restoring hidden modules through `setVisibility`.
- [x] Storybook stories for scrolling, drag, resize, and hidden-tray states.

## Remaining phases
- [x] Phase 4: Pure layout functions and editable dashboard interactions — spec and plan are written (`docs/superpowers/specs/2026-11-19-dashboard-container-design.md`, `docs/superpowers/plans/2026-11-19-dashboard-container.md`); implementation starts at Task 1.
- [x] Phase 5 step 1: Host integration (`docs/superpowers/plans/2026-11-20-phase-5-host-dashboard.md`) — library `renderModule` rect, host grid model, layout/theme persistence, PCM adapter seam, shared connection provider, dashboard screen, diagnostics tab.
- [x] Phase 5 step 2: Host analysis engine (FFT bins, RMS/peak/LUFS, VU ballistics, spectrogram history) so the four waiting modules light up. Loudness is momentary K-weighted LUFS over a 400 ms window; VU uses 20 ms attack / 260 ms release with a 1.2 s peak hold.
- [x] Meter fidelity pass: VU bars rescaled to dB, loudness windows split into momentary / short-term / integrated, spectrogram window tied to the poll cadence.
- [ ] Phase 5 acceptance: device run in portrait and landscape (pairing, drag/resize/hide/restore, theme switch, rotation 2↔4 columns, relaunch restore, reset).

## Follow-ups
- [ ] Confirm on device that the seven module stories render (the Android export bundle contains all seven titles and 36 Node tests pass, but no device run yet). Spectrogram's `Skia.Image.MakeImage` + `Skia.Data.fromBytes` runtime path is the least proven piece.
- [ ] Confirm reanimated shared values are accepted by `LinearGradient` and `Image` children on device (Spectrum gradient).
- [ ] Confirm the dashboard gestures on device: `PanResponder` inside a vertical `ScrollView` needs `onPanResponderTerminationRequest` tuning if iOS steals the touch, and the resize preview clamps at a 32 px touch target rather than a cell.
- [x] Host integration regression (`npm test --workspace=minimeters-mobile`) — 5 suites / 24 tests green against this branch.
- [x] Refresh the parent workspace lockfile (`D:\web_dev_projects\MiniMetersMobile\package-lock.json`) after this branch lands on `main`, so the host install resolves Skia and Worklets.

## Deferred
- [ ] MiniMeters INI theme import; waiting for a real sample or authoritative format source.

## Notes
- Host analysis is derived on the phone: `analyseFrame` stays pure (bins, levels, scopes) and `createAnalysisEngine` carries the meter state — BS.1770-4 K-weighted loudness in three windows (momentary 400 ms, short-term 3 s, integrated with absolute -70 LUFS and relative -10 LU gating), plus one-pole VU ballistics (20 ms attack / 260 ms release, 1.2 s peak hold) so a per-frame RMS cannot make the bar twitch.
- Meters are dB meters: `module-values.ts` maps linear levels to dB and then to a `0..1` bar fraction, so -20 dBFS sits two thirds up the VU bar instead of a tenth. VU span is -60..0 dBFS, loudness span is the analysis floor..0 dBFS.
- The host status strip prints `integrated LUFS (M … / S …)`; the library's `LoudnessValues` has one `lufs` slot, which the host fills with the integrated value.
- Spectrogram history is expressed in seconds (`SPECTROGRAM_HISTORY_SECONDS = 5`) and converted to rows with the stream's poll interval (`STREAM_REFRESH_MS = 100` → 50 rows), so the plot's timeline cannot drift from the polling cadence.
- `DashboardGrid` now accepts an optional `testID`, forwarded to its container, so hosts can drive layout in tests (the grid renders nothing until it has measured a width).
- The host app must import the Skia-free dashboard entry (`@minimetermobile/ui/dist/dashboard`) from modules that unit tests load: the package main pulls Skia's ESM build, which jest cannot transform.
- The example `tsconfig.json` now lists `.rnstorybook/**/*.ts(x)` explicitly: TypeScript's `include` globs skip dot-prefixed directories, so the stories were never typechecked before. Fixing that surfaced a stale `SkPath.moveTo` usage in `Canvas.stories.tsx` (Skia 2.x builds paths through `Skia.PathBuilder.Make()`).
