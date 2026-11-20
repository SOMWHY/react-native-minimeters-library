# Phase 5 (Step 1) — Live PCM Dashboard in the Host App

> **For agentic workers:** use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the host app's raw-sample text screen with a live `@minimetermobile/ui` dashboard fed by real PCM frames from the plugin socket.

**Architecture:** The library gains one additive change (`DashboardGrid.renderModule` receives the resolved `CellRect`). The host app grows a `src/features/dashboard/` slice of pure, unit-tested modules (grid model, layout codec, PCM adapter), a lifted connection provider shared by both tabs, and two screens: the dashboard (Home) and the raw-sample diagnostics (Explore).

**Tech Stack:** React Native 0.88 / Expo SDK 58, expo-router, Skia 2.14, `@react-native-async-storage/async-storage`, jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/` (Phase 4 dashboard container design) plus `docs/data-contract.md` boundary clause.

## Global Constraints

- Library analysis boundary is unchanged: the library never computes FFT/peak/RMS/LUFS. Host-side analysis is step 2.
- No credentials or new `.env` entries in this change.
- Library peer dependency versions stay exactly as pinned (Skia `2.14.0`).
- Every settled layout change goes through `onLayoutChange`; transient gesture state never persists.
- Host commits land in the host repo (`D:/web_dev_projects/MiniMetersMobile`); library commits land in the library repo. `git push` is blocked by the pi hook — never attempt it.

## Review Focus

- Orientation change while a card is mid-drag: the gesture must cancel, not commit a stale cell.
- Corrupt or version-mismatched stored layout: fall back to the factory layout silently, never crash or blank the screen.
- Mono frame reaching the vectorscope: shows `invalid` (its designed state) while waveform/oscilloscope keep drawing.
- Reconnect after disconnect: the dashboard must not keep painting frames from the previous session.
- Editing with zero hidden items: the tray is absent, not an empty bar.

---

## Task 1: Library — pass the resolved cell rect to `renderModule`

**Files:**
- Modify: `react-native-minimeters-library/src/dashboard/DashboardGrid.tsx`
- Modify: `react-native-minimeters-library/example/.rnstorybook/stories/Dashboard/DashboardGrid.stories.tsx`
- Modify: `react-native-minimeters-library/README.md`
- Modify: `react-native-minimeters-library/package.json` (version → `0.2.0`)

**Interfaces:**
- Produces: `DashboardGridProps.renderModule: (item: DashboardItem, rect: CellRect) => ReactNode`

- [x] Update the prop type and the call site to `renderModule(item, rect)`.
- [x] Update the stories so the module height comes from `rect.height`.
- [x] Run `npm run typecheck`, `npm run typecheck:example`, `npm test` (81/81).
- [x] Commit `feat(dashboard): pass the cell rect to renderModule`, then `chore(release): bump to 0.2.0`; ff-merge to `main`.

## Task 2: Host — grid model and width presets

**Files:**
- Create: `minimeters-mobile/src/features/dashboard/model.ts`
- Test: `minimeters-mobile/src/features/dashboard/__tests__/model.test.ts`

**Interfaces:**
- Produces:
  - `DASHBOARD_WIDTH_THRESHOLD = 700`
  - `gridForWidth(width: number): { metrics: GridMetrics; config: GridConfig }`
  - `DEFAULT_DASHBOARD_ITEMS: readonly DashboardItem[]`
  - `defaultLayout(): DashboardLayout`
  - `fitToConfig(items: readonly DashboardItem[], config: GridConfig): DashboardItem[]`
  - `restoreFactoryLayout(config: GridConfig): DashboardLayout`

- [x] Write the failing tests (2-col phone preset, 4-col tablet preset, `maxColSpan === columns`, default items inside bounds and non-overlapping, `fitToConfig` clamping 4-col → 2-col, factory reset).
- [x] Run `npm test --workspace=minimeters-mobile` and confirm the new suite fails to resolve the module.
- [x] Implement `model.ts` using `GRID_PRESETS` and `normalizeLayout`.
- [x] Re-run tests; commit `feat(dashboard): add grid model and width presets`.

## Task 3: Host — layout and theme persistence codec

**Files:**
- Create: `minimeters-mobile/src/features/dashboard/layout-storage.ts`
- Test: `minimeters-mobile/src/features/dashboard/__tests__/layout-storage.test.ts`
- Modify: `minimeters-mobile/package.json` (add AsyncStorage via `npx expo install`)

**Interfaces:**
- Produces:
  - `STORAGE_KEYS.layout = 'minimeters.dashboard.layout.v1'`, `STORAGE_KEYS.theme = 'minimeters.dashboard.theme.v1'`
  - `type ThemeId = 'midnight' | 'ice' | 'ember'`
  - `serializeLayout(layout: DashboardLayout): string`
  - `parseStoredLayout(raw: string | null, config: GridConfig): DashboardLayout | null`
  - `serializeTheme(id: ThemeId): string`, `parseStoredTheme(raw: string | null): ThemeId | null`
  - `loadLayout(storage, config)`, `saveLayout(storage, layout)`, `loadTheme(storage)`, `saveTheme(storage, id)` where `storage: { getItem(key): Promise<string|null>; setItem(key, value): Promise<void> }`

- [x] Write the failing codec tests (round-trip, corrupt JSON, wrong version, unknown kind dropped, `NaN` placement dropped, empty items, storage stub).
- [x] Run tests; confirm red.
- [x] Implement the codec with injected storage; wire `loadLayout`/`saveLayout` to AsyncStorage in a thin adapter exported for the screens.
- [x] Re-run tests; commit `feat(dashboard): persist layout and theme`.

## Task 4: Host — PCM adapter (step-2 seam)

**Files:**
- Create: `minimeters-mobile/src/features/dashboard/pcm-adapter.ts`
- Test: `minimeters-mobile/src/features/dashboard/__tests__/pcm-adapter.test.ts`

**Interfaces:**
- Produces:
  - `toPcmBlock(frame: PcmAudioFrame): PcmBlock`
  - `LIVE_PCM_KINDS`, `supportsLiveData(kind: ModuleKind): boolean`
  - `moduleDataFor(kind: ModuleKind, frame: PcmAudioFrame | null): PcmBlock | null`

- [x] Write the failing adapter tests (identity of `samples`, truth table over seven kinds, `null` frame).
- [x] Run tests; confirm red.
- [x] Implement the adapter; the four analysis kinds return `null` in step 1.
- [x] Re-run tests; commit `feat(dashboard): add the pcm adapter`.

## Task 5: Host — lift the connection into a provider

**Files:**
- Create: `minimeters-mobile/src/features/connection/connection-context.tsx`
- Modify: `minimeters-mobile/src/app/_layout.tsx`, `minimeters-mobile/src/features/monitoring/PcmMonitorScreen.tsx`

**Interfaces:**
- Produces: `PcmConnectionProvider`, `usePcmConnection(): { state, latestFrame, receivedFrameCount, scanError, connectionError, protocolError, connect(payload), disconnect() }`

- [x] Move the socket/state machine out of `PcmMonitorScreen` without behavior change (100 ms refresh, same error branches, injectable `socketFactory`).
- [x] Wrap `AppTabs` in the provider.
- [x] Run existing host tests (24) — they must stay green.
- [x] Commit `feat(connection): lift the pcm connection into a provider`.

## Task 6: Host — dashboard hook and Home screen

**Files:**
- Create: `minimeters-mobile/src/features/dashboard/use-dashboard-layout.ts`
- Create: `minimeters-mobile/src/features/dashboard/DashboardScreen.tsx`
- Modify: `minimeters-mobile/src/app/index.tsx`

**Interfaces:**
- Consumes: `gridForWidth`, `defaultLayout`, `fitToConfig`, `restoreFactoryLayout`, `loadLayout`, `saveLayout`, `loadTheme`, `saveTheme`, `moduleDataFor`, `usePcmConnection`.
- Produces: `useDashboardLayout(config)` → `{ layout, themeId, editing, setEditing, setThemeId, onLayoutChange, reset }`; `DashboardScreen`.

- [x] Implement the hook (factory first paint, 300 ms debounced save, immediate theme save, reset).
- [x] Implement the screen: pairing UI when disconnected, `DashboardGrid` when connected, header toolbar (status, EDIT/DONE, three theme chips, RESET), tray under the grid only while editing with hidden items, one-line note above the grid naming the four waiting modules.
- [x] Verify `npx tsc --noEmit` and `npm run lint` are clean.
- [x] Commit `feat(dashboard): render the live grid on the home tab`.

## Task 7: Host — move raw diagnostics to Explore

**Files:**
- Create: `minimeters-mobile/src/features/monitoring/PcmDiagnosticsScreen.tsx`
- Modify: `minimeters-mobile/src/app/explore.tsx`

- [x] Port `PcmFrameDetails` to the new screen on top of `usePcmConnection()`.
- [x] Replace the Expo template content in `explore.tsx`; delete components only that page used.
- [x] Verify typecheck + lint; commit `feat(monitoring): move raw sample diagnostics to explore`.

## Task 8: Verification and status docs

**Files:**
- Modify: `react-native-minimeters-library/TODO.md`
- Modify: `react-native-minimeters-library/README.md` (dashboard section note about `rect`)

- [x] Library: `npm test`, `npm run typecheck`, `npm run typecheck:example`, `npm pack --dry-run`.
- [x] Host: `npm test --workspace=minimeters-mobile`, `npx tsc --noEmit`, `npm run lint`.
- [x] Storybook: `npm run start:ui-storybook` — Dashboard stories render with `rect`-derived heights.
- [ ] Device (portrait + landscape): pairing → live waveform/oscilloscope/vectorscope; four modules `WAITING FOR DATA`; EDIT drag/resize/hide/restore; theme switch; rotation 2↔4 columns without overlap; relaunch restores layout + theme; RESET restores factory layout; Explore shows the raw table.
- [x] Update `TODO.md`: tick Phase 5 step 1, add the step-2 analysis engine entry, record the device result.
- [x] Commit `docs: record phase 5 status`.

## Test plan summary

| Suite | Covers |
|---|---|
| `model.test.ts` | presets by width, span limits, factory layout validity, rotation clamping, factory reset |
| `layout-storage.test.ts` | codec round-trip, corruption, version gate, unknown kind, non-finite placement, storage adapter |
| `pcm-adapter.test.ts` | zero-copy PCM block, live-kind truth table, null frame |
| existing 24 host tests | pairing payload, protocol decode, socket state machine — must stay green |
| library 81 node tests | layout maths, mutations, module display helpers — must stay green |

## Out of scope

Host analysis engine (FFT bins, RMS/peak/LUFS, VU ballistics, spectrogram history); INI theme import; tablet/web acceptance; npm publish; relaxing the Skia peer range.
