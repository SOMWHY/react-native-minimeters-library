# Full-screen dashboard, floating settings orb, double-tap readout

Date: 2026-11-20
Scope: `react-native-minimeters-library` (spectrogram orientation) + `minimeters-mobile` (everything else)

## Goal

Three requests from the device build:

1. The visualization area should fill the whole screen instead of leaving a strip
   of unused space.
2. The always-visible button row (theme, edit layout, scan, disconnect) is too
   heavy for a first-level page; keep only a connection light there.
3. Double-tap waveform / spectrum / spectrogram to get a cursor with a numeric
   readout, like the desktop app — including a spectrogram whose time axis runs
   across, so a horizontal line selects a frequency.

## Library change — spectrogram orientation

`toSpectrogramPixels` now emits `width = rows` (time, newest on the right) and
`height = bins` (frequency, lowest bin at the bottom), i.e. the same orientation
the desktop app draws. This is a breaking change to the function's output
semantics, but `SpectrogramModule` is its only consumer and the library tests
were updated with it.

## Host changes

- `model.ts`: `fitRowsToViewport({ availableHeight, rows, preset })` derives the
  row height that makes the grid exactly fill the viewport, clamped to
  56–200 dp so an extreme layout still scrolls instead of collapsing.
  `layoutRowCount` reports the rows a layout occupies. `gridForWindow` accepts
  the available height and row count and returns the fitted metrics.
- `DashboardScreen`: the bottom bar is gone and the scroll view is edge to edge.
  `SettingsOrb` + `ConnectionLight` are the only chrome; the connection light is
  a 10 dp dot in the top-left with no text.
- `settings-orb.ts` (pure): orb size/margin, default bottom-right placement,
  clamping against safe-area insets, serialisation, and which side of the orb the
  settings card opens on.
- `orb-storage.ts`: the orb position persists across launches.
- `SettingsOrb.tsx`: a `Pressable` handles the tap (panel toggle) while raw
  responder props claim the touch only once the finger moves, so tapping and
  dragging never fight. The panel holds the connection banner, theme chips,
  edit/done/reset, scan-or-disconnect, and the hidden-module tray while editing.
- `readout.ts` (pure): note naming (A4 = 440, 12-TET), `formatHz`/`formatDb`/
  `formatNote`/`formatSeconds`, and per-kind sampling — waveform column peak,
  spectrum bin level + frequency, spectrogram cell level + frequency + time ago.
- `analysis.ts`: exports `binFrequencyRange(binIndex, sampleRate)` so the readout
  can label a bin without duplicating the log-spaced bin edges.
- `Crosshair.tsx`: double-tap toggles the cursor (two taps within 300 ms and
  12 dp), a drag while open moves it, and it renders only itself so a moving
  cursor never pushes a new Skia scene through the module. It is mounted only
  outside edit mode, where the card's hold-then-drag owns touch.
- `module-bodies.tsx`: takes `editing` and wraps each card in a flex box so the
  cursor overlays the plot exactly; the waveform now receives an explicit
  `WAVEFORM_COLUMNS` so the readout samples the columns that were drawn.

## Verification

- Library: `npm test` 97/97, `npm run typecheck`, `npm run typecheck:example`.
- Host: `npx jest` 231 tests / 25 suites, `npx tsc --noEmit`, `npx expo lint`.
- New host tests: `readout.test.ts`, `settings-orb.test.ts`,
  `Crosshair.test.tsx`, `module-bodies.test.tsx`, plus `DashboardScreen.test.tsx`
  updated for the orb (controls are behind a tap now, the light is not).

## Device checklist (not yet done)

- The grid reaches the bottom edge with no scrollbar and no dead strip.
- Dragging the orb and relaunching keeps its position; a rotation keeps it on
  screen.
- Double-tap on waveform/spectrum/spectrogram shows lines + readout, double-tap
  again hides it, dragging after activation sweeps it.
- The spectrogram now reads time across and frequency up.
- In edit mode a hold-then-drag moves a card without a cursor appearing.
