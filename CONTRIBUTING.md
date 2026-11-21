# Contributing

Thanks for looking. This repository is the visualization layer of MiniMeters Mobile: props-driven
React Native components that render audio meters with Skia. It has no transport, no analysis and no
application state.

## Before you start

- **The boundary is the product.** This library displays prepared values. If a change requires
  decoding PCM, running an FFT, computing RMS/LUFS, or holding history, it belongs in the host app —
  or it needs a new explicit prop, not a hidden computation. See
  [`docs/data-contract.md`](docs/data-contract.md).
- **Structural tokens versus colour roles.** Spacing, radii, typography, stroke widths and motion
  durations come from `STRUCTURAL_TOKENS` and are identical in every theme. A theme carries colours
  only. Hard-coding either one is the most common way to break the design system.
- **Open an issue first** for a new module or a prop shape change. Prop changes ripple into the host
  app, which is a separate repository.

## Setup

```sh
npm install
npm run build
npm run typecheck
npm test
```

The Expo example consumes this package through `file:..`, so `npm run build` must be run before the
example (or a host app inside the workspace) sees a source change. There is no watch build: rebuild
explicitly.

## Checks

All four before a pull request:

```sh
npm run typecheck
npm test
npm run lint          # if present in your checkout
npm run build         # the published artefact must compile
```

## Tests

- Tests import from `src/`, not `dist/`, except where the point is the built artefact.
- The host app runs Jest against this package with deep imports (`@minimetermobile/ui/dist/...`),
  because the root entry pulls Skia's ESM build which Jest cannot transform. Keep `dist/` output
  importable per subpath — that is what makes the host's tests possible.
- Pure helpers exist so behaviour can be tested without React: `mapLinear`, `isCanvasReady`,
  `dragDeltaToCells`, `resizeDeltaToSpans`, `shouldArmDrag`, `shouldCancelArm`, `compact`,
  `normalizeLayout`, `buildSpectrogramRamp`, `toSpectrogramPixels`, `resolveSpectrogramState`.
  New geometry or gesture rules belong in a pure function first.
- A module's state classification (`ready` / `waiting` / `invalid`) must be tested for all three
  outcomes. A module that invents data for a degenerate input is a bug even if it looks fine.

## Conventions

- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs`, `refactor`, `test`, `chore`.
  One logical change per commit.
- **Semantic versioning.** `0.x` allows breaking changes, but they must be called out in the commit
  body and the release notes — the host app pins this package.
- No new runtime dependency. Skia, Reanimated, Gesture Handler and Worklets are peers provided by the
  host's Expo SDK; adding one as a `dependency` installs a second copy and breaks rendering.
- Never create a second Skia `Canvas`. `VisualizationCanvas` owns it.
- Animate colour only. Geometry and typography stay fixed across theme transitions.
- Public API changes need a README line and, for behaviour, a test.

## Pull requests

- Include a screenshot or recording for anything visible; this is a rendering library.
- State which host app version you tested against, if you tested in one.
- A maintainer runs the checks and a device build before merging; do not merge your own pull request.
