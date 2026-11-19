# Visualization Modules Implementation Plan

> **For the implementing agent:** implement task by task, in order. Each task is
> one commit. Follow the red-green loop: write the failing test first, watch it
> fail, implement, watch it pass, then commit. Do not batch tasks.

**Spec:** `docs/superpowers/specs/2026-11-19-visualization-modules-design.md`
**Product source of truth:** `overview.md`
**Data source of truth:** `docs/data-contract.md`

**Goal:** ship the seven Phase 3 visualization modules on the Phase 2 Skia base.

**Architecture recap:** `VisualizationCanvas` is the only Skia `Canvas`; modules
are composed inside it and read `useDrawingContext()`. All non-trivial maths
lives in pure helpers under `src/modules/` so Node can test it. Text and
placeholders are React Native overlay views, never Skia paragraphs.

**Testing constraint:** the package root barrel imports React Native, so Node
tests must import the pure sub-barrels (`../dist/modules/display`) and assert
root re-exports by reading `dist/index.js` as text. Keep that pattern.

**Verification loop after each task:**

```sh
npm test                  # build + node tests + workspace smoke
npm run typecheck
npm run typecheck:example
```

Storybook bundle check (before the final commit, and at least once mid-phase):

```sh
cd example && npx cross-env STORYBOOK_ENABLED=true npx expo export --platform android --clear
grep -c "Foundation/Waveform" dist/_expo/static/js/android/*.hbc
```

Host regression (must stay green, from the parent workspace):

```sh
cd /d/web_dev_projects/MiniMetersMobile && npm test --workspace=minimeters-mobile
```

---

## Task 1 — Module surface, states, and display helpers

**Files**

- Create `src/modules/types.ts`: `ModuleStatus`, `PcmBlock`, `ModuleBaseProps`,
  `EnvelopeColumns`, `StereoPoint`, `NumericRange` re-use from `src/drawing`.
- Create `src/modules/display.ts`: `clampUnit`, `toEnvelopeColumns`,
  `toTraceSamples`, `toStereoPoints`, `normalizeBins`, `toMeterScale`.
- Create `src/modules/ModuleSurface.tsx`.
- Create `src/modules/index.ts`.
- Update `src/index.ts` to export `./modules`.
- Create `tests/modules.test.cjs`.

**Step 1 — failing tests.** In `tests/modules.test.cjs`, require
`../dist/modules/display` after a build and assert:

1. `clampUnit` maps `-1 → 0`, `2 → 1`, keeps `0.25`, and turns `NaN`/`Infinity`
   into `0`/`1` respectively rather than propagating.
2. `toEnvelopeColumns` with a 8-sample stereo block and `columns = 4` returns 4
   min/max pairs covering the left channel, endpoints included.
3. `toEnvelopeColumns` with `columns` greater than the sample count returns the
   requested count and never indexes out of bounds.
4. `toTraceSamples` returns at most `points` values, first and last covering the
   channel endpoints, and handles a single-sample block.
5. `toStereoPoints` projects `(L=1,R=0)` to `x = -1/√2, y = 1/√2` and
   `(L=R=1)` to `x = 0, y = √2`, and caps the result at `points`.
6. `normalizeBins` maps `dbRange` endpoints to `0`/`1`, clamps outside values,
   and defaults to `[-90, 0]`.
7. `toMeterScale` behaves like `normalizeBins` for a single value.
8. Every helper returns only finite numbers for all-zero and non-finite inputs.
9. The root barrel still re-exports the modules barrel (`dist/index.js` contains
   `./modules`).

**Step 2 — implement.** Keep every helper allocation-bounded by the requested
output size and free of React Native or Skia imports. `ModuleSurface` renders:

```tsx
<View style={{ height, ...style }}>
  <VisualizationCanvas theme={theme} />
  <View style={StyleSheet.absoluteFill} pointerEvents="none">{overlay}</View>
</View>
```

Give it typed props `{ theme, height = 160, style, status, label?, children? }`
where `status` drives the placeholder text (`'WAITING FOR DATA'` /
`'INVALID DATA'`) and `children` is the optional canvas content, forwarded into
`VisualizationCanvas`. Use only `STRUCTURAL_TOKENS` values for spacing and
typography, and `useDrawingContext()`-injected colors is not possible at the
overlay level, so read `theme.colors.textMuted` for placeholder text.

**Step 3 — verify.** `npm test`, `npm run typecheck`.

**Step 4 — commit.** `feat(modules): add module surface, states, and display helpers`

---

## Task 2 — Waveform module

**Files**

- Create `src/modules/waveform/WaveformModule.tsx`,
  `src/modules/waveform/state.ts`, `src/modules/waveform/index.ts`.
- Update `src/modules/index.ts`.
- Extend `tests/modules.test.cjs`.

**Step 1 — failing tests.** Assert `resolveWaveformState` returns `waiting` for
`undefined`, `null`, and an empty sample array; `invalid` when
`samples.length !== channels * samplesPerChannel`, when `channels < 1`, or when
a sample is non-finite; `ready` for the documented stereo fixture and for an
all-silent block.

**Step 2 — implement.** `WaveformModule` resolves state, renders
`ModuleSurface` with a canvas child that draws a filled band between
`toEnvelopeColumns` min/max using `colors.traces.primary` and a zero axis line
with `colors.axis`. Map columns across `[0, width]` and amplitude `[-1, 1]` up
the reversed Y axis through the context's `mapX`/`mapY`. States other than
`ready` render no trace nodes.

**Step 3 — verify** with the standard loop, plus a Storybook story
`example/.rnstorybook/stories/Modules/Waveform.stories.tsx` with `Ready`,
`Waiting`, `Invalid` and the theme select.

**Step 4 — commit.** `feat(modules): add waveform module`

---

## Task 3 — Oscilloscope module

**Files**

- Create `src/modules/oscilloscope/{OscilloscopeModule.tsx,state.ts,index.ts}`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/.rnstorybook/stories/Modules/Oscilloscope.stories.tsx`.

**Step 1 — failing tests.** Same classifier matrix as the waveform, plus:
`toTraceSamples` output for the fixture is finite and within `[-1, 1]` after
clamping.

**Step 2 — implement.** One polyline `Path` from `toTraceSamples`, stroke
`colors.traces.primary`, width `tokens.strokeWidth.regular`, plus a `surface`
fill so overlapping siblings cannot show through. `points` default 128.

**Step 3 — verify** as above.

**Step 4 — commit.** `feat(modules): add oscilloscope module`

---

## Task 4 — Vectorscope module

**Files**

- Create `src/modules/vectorscope/{VectorscopeModule.tsx,state.ts,index.ts}`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/.rnstorybook/stories/Modules/Vectorscope.stories.tsx`.

**Step 1 — failing tests.** Classifier: `invalid` when `channels < 2` (a
vectorscope needs a stereo pair), when the buffer length disagrees, or when a
sample is non-finite; `waiting` when absent/empty; `ready` otherwise.

**Step 2 — implement.** Draw `toStereoPoints` output as circles
(`colors.traces.primary`, radius from `tokens.spacing.xs / 2`), the diagonal and
mid-side axes as `colors.axis` hairlines, and map `[-1, 1]` on both axes.

**Step 3 — verify** as above.

**Step 4 — commit.** `feat(modules): add vectorscope module`

---

## Task 5 — Spectrum module

**Files**

- Create `src/modules/spectrum/{SpectrumModule.tsx,state.ts,index.ts}`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/fixtures/spectrum-bins.ts` and
  `example/.rnstorybook/stories/Modules/Spectrum.stories.tsx`.

**Step 1 — failing tests.** Classifier: `invalid` on non-finite bins or an
inverted `dbRange`; `waiting` on absent/empty bins; `ready` on all-zero bins.
`normalizeBins` handles a single bin and a `dbRange` of equal endpoints by
returning `0` rather than dividing by zero.

**Step 2 — implement.** Filled area path under the normalized curve with an
animated `LinearGradient` (`traces.low` → `traces.high`) plus a stroke in
`traces.primary`; bin index maps linearly to X. Fixture documents itself as
host-prepared example output, not a server field.

**Step 3 — verify** as above.

**Step 4 — commit.** `feat(modules): add spectrum module`

---

## Task 6 — VU module

**Files**

- Create `src/modules/vu/{VuModule.tsx,state.ts,index.ts}`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/.rnstorybook/stories/Modules/Vu.stories.tsx`.

**Step 1 — failing tests.** Classifier: `invalid` for non-finite levels;
`waiting` when `data` is absent; `ready` for `{ left: 0, right: 0 }`. Clamping:
`left: 1.4` stays `ready` and clamps to `1`.

**Step 2 — implement.** Two vertical bars with a three-stop gradient
(`traces.low` → `traces.mid` → `traces.high`) over a `surface` track, optional
peak ticks from `leftPeak`/`rightPeak` in `text`, labels `L`/`R` in the overlay
using `typography.micro`.

**Step 3 — verify** as above.

**Step 4 — commit.** `feat(modules): add VU module`

---

## Task 7 — Loudness module

**Files**

- Create `src/modules/loudness/{LoudnessModule.tsx,state.ts,index.ts}`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/.rnstorybook/stories/Modules/Loudness.stories.tsx`.

**Step 1 — failing tests.** Classifier: `invalid` when any of `peak`/`rms`/
`lufs` is non-finite; `waiting` when absent; `ready` for `-Infinity`-free
silent values such as `{ peak: -90, rms: -90, lufs: -90 }`. `toMeterScale`
clamps values below/above the dB range.

**Step 2 — implement.** Three horizontal bars in `traces.high`/`traces.mid`/
`traces.primary` over `surface` tracks, one decimal numeric readout per row in
the overlay using `typography.micro` and `colors.text`, row labels `PEAK`/
`RMS`/`LUFS`. Default `dbRange` `[-60, 0]`.

**Step 3 — verify** as above.

**Step 4 — commit.** `feat(modules): add loudness module`

---

## Task 8 — Spectrogram module

**Files**

- Create `src/modules/spectrogram/{SpectrogramModule.tsx,state.ts,index.ts}`,
  `src/modules/spectrogram/pixels.ts`.
- Update `src/modules/index.ts`, `tests/modules.test.cjs`.
- Add `example/fixtures/spectrogram-rows.ts` and
  `example/.rnstorybook/stories/Modules/Spectrogram.stories.tsx`.

**Step 1 — failing tests.** Pure rasterizer only (no Skia in Node):
`toSpectrogramPixels(rows, maxRows, ramp)` returns `{ width, height, bytes }`
with `bytes.length === width * height * 4`, row-major order, and only finite
0–255 channel values; unequal row lengths classify the module `invalid` via
`isSpectrogramValid`; `maxRows` trims the oldest rows; an empty row set yields a
zero-size raster the component renders as `waiting`.

**Step 2 — implement.** Convert the ramp colors (theme `traces.low`/`mid`/
`high`) to RGB triples; rasterize; build an image through
`Skia.Image.MakeImage({ width, height, colorType: ColorType.RGBA_8888,
alphaType: AlphaType.Unpremul }, Skia.Data.fromBytes(bytes), width * 4)` and draw
it with `<Image image fit="fill" />`. Rebuild the image only when the rows or
the ramp change (`useMemo`), and never per frame when the data is unchanged.

**Step 3 — verify** as above; confirm the bundle contains
`Foundation/Spectrogram`.

**Step 4 — commit.** `feat(modules): add spectrogram module`

---

## Task 9 — Package docs, exports, and phase verification

**Files**

- Update `README.md`: module list, prepared-data boundary, per-module prop
  summary, state semantics, "analysis belongs to the host" note.
- Update `TODO.md`: mark Phase 3 complete, record follow-ups.
- Update `docs/data-contract.md` only if a real server field is discovered — do
  not add invented fields.

**Steps**

1. Confirm every module is exported from `src/index.ts` through
   `src/modules/index.ts`.
2. `npm test`, `npm run typecheck`, `npm run typecheck:example`.
3. `npm pack --dry-run` — no fixture or example files leak into the tarball.
4. Storybook Android bundle export contains all seven module story titles.
5. Host regression: `npm test --workspace=minimeters-mobile` stays green.
6. Commit `docs(modules): document the visualization module contracts`.

---

## Risks and open questions

- **Skia image motif:** `MakeImage` + `Data.fromBytes` is verified in the
  installed 2.14.0 typings but unverified on device. If it fails at runtime,
  fall back to drawing spectrogram rows as `<Path>` polylines per row and record
  the change in the spec.
- **Reanimated shared values inside children:** children read colors through
  `useDrawingContext()` and pass shared values straight into Skia props. This is
  the Phase 2 pattern and is assumed to hold for `LinearGradient`/`Image`
  children; verify in Storybook before committing each module.
- **Performance target:** the modules must stay smooth at the documented ~30 Hz
  frame cadence. Spectrogram caps rows and bins per row; other modules cap
  points/columns at their prop defaults.
- **Card chrome** is out of scope. Modules render bare surfaces; Phase 4's
  dashboard wraps them.
