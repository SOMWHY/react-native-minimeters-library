# Dashboard Container Implementation Plan (Phase 4)

> **For the implementing agent:** implement task by task, in order. Each task is
> one commit. Follow the red-green loop: write the failing test first, watch it
> fail, implement, watch it pass, then commit. Do not batch tasks.

**Spec:** `docs/superpowers/specs/2026-11-19-dashboard-container-design.md`
**Product source of truth:** `overview.md` §4, §6, §7
**Data source of truth:** `docs/data-contract.md` (unchanged by this phase)

**Goal:** ship the dashboard container — grid layout, drag, resize, hide/restore,
gravity fill, and deterministic auto placement — on the Phase 3 modules.

**Architecture recap:** every layout change is a pure function over
`DashboardItem[]` in `src/dashboard/layout.ts`. `DashboardGrid` only turns cells
into points (`layoutRects`) and hosts cards. The only coupling to Phase 3 is the
host-supplied `renderModule(item)`, so a new module kind never changes the
dashboard. Gestures use React Native's `PanResponder` — no new dependency.

**Testing constraint:** the package root barrel imports React Native, so Node
tests must require the pure sub-barrels (`../dist/dashboard/layout`,
`../dist/dashboard/geometry`) and assert root re-exports by reading
`dist/index.js` as text. Keep that pattern from Phase 3.

**Hard constraints carried from `overview.md`:**

- Layout data is the single model for drag, resize, visibility, gravity fill and
  reset. No partial delivery.
- Gravity fill never stretches a module; spans stay integers of grid cells.
- Non-edit mode renders no gesture handlers at all.
- No persistence, no networking, no theme-selection UI in the library.

---

## Task 1 — Layout model and geometry

**Files**

- Create `src/dashboard/types.ts`: `ModuleKind`, `GridPlacement`, `DashboardItem`,
  `DashboardLayout`, `GridConfig`, `GridMetrics`, `CellRect`, `MeasuredCellMetrics`.
- Create `src/dashboard/geometry.ts`: `layoutRects`, `gridHeight`, `GRID_PRESETS`,
  `DEFAULT_GRID_CONFIG`.
- Create `src/dashboard/geometry.test`-style assertions inside
  `tests/dashboard.test.cjs` (Node, against `dist/dashboard/geometry`).

**Steps**

1. Write tests: a 1×1 at `(0,0)` maps to `x = padding`, `y = padding`;
   a 2×2 accounts for `gap`; `gridHeight` of an empty layout is `0`; presets
   expose `phone` (2 columns) and `tablet` (4 columns).
2. Run `npm test` — fails on the missing module.
3. Implement `types.ts` and `geometry.ts`. `layoutRects` takes measured
   `cellWidth` explicitly so it stays pure.
4. Run `npm test` — passes.
5. Commit `feat(dashboard): add layout model and cell geometry`.

---

## Task 2 — Overlap, slot search, compaction, auto placement

**Files**

- Create `src/dashboard/layout/overlap.ts`: `rectsOverlap`, `fitsInColumns`,
  `assertGridConfig`.
- Create `src/dashboard/layout/placement.ts`: `findSlot`, `autoPlace`.
- Create `src/dashboard/layout/compact.ts`: `compact`.
- Extend `tests/dashboard.test.cjs`.

**Steps**

1. Write tests first: edge-adjacent rects do not overlap; an overlapping pair
   does; `findSlot` returns the top-left free rect and `null` on a full grid;
   `autoPlace` grows a new row rather than dropping an item; `compact` fills
   gravity holes, is idempotent, never touches hidden items, and never changes a
   span.
2. Run `npm test` — fails.
3. Implement. `compact` runs up-pass then left-pass until stable, skipping hidden
   items entirely.
4. Run `npm test` — passes.
5. Commit `feat(dashboard): add slot search, gravity fill, and auto placement`.

---

## Task 3 — Layout mutations

**Files**

- Create `src/dashboard/layout/mutate.ts`: `moveItem`, `resizeItem`,
  `setVisibility`, `resetLayout`, `normalizeLayout`.
- Create `src/dashboard/layout/index.ts` (barrel).
- Extend `tests/dashboard.test.cjs`.

**Steps**

1. Write tests first: a move puts the item at the target cell; a displaced
   occupant ends up in a lower free row; the id multiset is preserved; no overlap
   remains after `compact`; resize clamps to `min/max` spans; hiding keeps the
   item with its placement; restoring lands non-overlapping; `normalizeLayout`
   clamps an over-wide span when the column count shrinks and throws on a config
   whose `maxColSpan > columns`; identical input yields identical output.
2. Run `npm test` — fails.
3. Implement. `moveItem`/`resizeItem` displace then compact; `setVisibility` and
   `resetLayout` route through the same helpers so behaviour cannot drift.
4. Run `npm test` — passes.
5. Commit `feat(dashboard): add layout mutations for drag, resize, and visibility`.

---

## Task 4 — `DashboardGrid` container

**Files**

- Create `src/dashboard/DashboardGrid.tsx`, `src/dashboard/index.ts`.
- Extend `tests/dashboard.test.cjs` (root barrel re-export assertions).
- Create `example/.rnstorybook/stories/Dashboard/DashboardGrid.stories.tsx`
  with a stable non-edit layout of all seven modules.

**Steps**

1. Write the barrel test (`dist/index.js` mentions `./dashboard`) and a
   `layoutRects`/`gridHeight` assertion for a 2-column, 7-item layout.
2. Run `npm test` — fails.
3. Implement `DashboardGrid`: measure the container, compute `cellWidth`, map
   `layoutRects` to absolutely positioned `ModuleCard`s, render nothing for
   invisible items, and call `renderModule(item)` for the body.
4. `npm run typecheck` and `npm test` — pass.
5. Commit `feat(dashboard): add the dashboard grid container`.

---

## Task 5 — `ModuleCard` shell and edit affordances

**Files**

- Create `src/dashboard/ModuleCard.tsx`.
- Extend `example/.rnstorybook/stories/Dashboard/DashboardGrid.stories.tsx` with
  `Editing` and `Viewing` variants.

**Steps**

1. Assert in the typecheck pass that `ModuleCard` in `editing` mode renders drag
   and resize handles with `accessibilityRole`/`accessibilityLabel`, and in
   non-edit mode renders neither.
2. Implement the card: label row (React Native text, never Skia), the module body,
   and edit-mode-only handles styled from `STRUCTURAL_TOKENS`.
3. `npm run typecheck`, `npm run typecheck:example` — pass.
4. Commit `feat(dashboard): add the module card shell with edit affordances`.

---

## Task 6 — Drag interaction

**Files**

- Create `src/dashboard/gestures.ts`: `dragDeltaToCells`.
- Wire a `PanResponder` inside `DashboardGrid`.
- Extend `tests/dashboard.test.cjs` and the dashboard stories (`Drag` variant).

**Steps**

1. Write tests first: a sub-half-cell drag yields `{ dCol: 0, dRow: 0 }`; a drag of
   1.6 cells yields `dCol = 2`; negative drags are clamped to the item's current
   position; `dRow` never produces a negative absolute row.
2. Run `npm test` — fails.
3. Implement `dragDeltaToCells`, then wire the responder: transient pixel offset
   via `transform` while dragging, `onLayoutChange` only on release, and
   `editing === false` disables the responder entirely.
4. `npm test`, `npm run typecheck` — pass.
5. Commit `feat(dashboard): add grid-snapping drag interaction`.

---

## Task 7 — Resize interaction

**Files**

- Extend `src/dashboard/gestures.ts`: `resizeDeltaToSpans`.
- Wire the resize handle in `ModuleCard`, callback into `DashboardGrid`.
- Extend `tests/dashboard.test.cjs` and the stories.

**Steps**

1. Write tests first: half-cell thresholds; clamping at `min*`/`max*` spans and at
   the column count; a resize that would exceed `maxColSpan` stops at the max.
2. Run `npm test` — fails.
3. Implement, then wire: live preview via `transform` scale-free re-layout is not
   allowed — the handle moves the card's `width`/`height` in pixels during the
   drag, and the settled layout comes from `resizeItem` on release.
4. `npm test`, `npm run typecheck` — pass.
5. Commit `feat(dashboard): add grid-stepped resize interaction`.

---

## Task 8 — Hidden module tray and restore

**Files**

- Create `src/dashboard/ModuleTray.tsx`.
- Extend `example/.rnstorybook/stories/Dashboard/DashboardGrid.stories.tsx` with
  `HiddenTray` and `Restored` variants.

**Steps**

1. Assert hidden items stay in `layout.items` with their placement, and that
   restoring through `setVisibility` produces a non-overlapping compacted layout
   (already covered in Task 3 — reference it from the tray story notes).
2. Implement `ModuleTray`: horizontal list of hidden items with a restore action,
   styled from `STRUCTURAL_TOKENS` and the theme; renders nothing when empty.
3. `npm run typecheck`, `npm run typecheck:example` — pass.
4. Commit `feat(dashboard): add the hidden module tray`.

---

## Task 9 — Package docs, exports, and phase verification

**Files**

- Update `README.md`: dashboard model, pure-function list, gesture and edit-mode
  rules, presets, and the "host owns persistence" note.
- Update `TODO.md`: mark Phase 4 complete, record follow-ups (accessibility
  controls, auto-scroll for tall grids, gesture library if feel demands it).
- Do not touch `docs/data-contract.md`: no server field is introduced here.

**Steps**

1. Confirm every dashboard export surfaces through `src/index.ts` →
   `src/dashboard/index.ts`.
2. `npm test`, `npm run typecheck`, `npm run typecheck:example`.
3. `npm pack --dry-run` — no example or fixture files in the tarball.
4. `STORYBOOK_ENABLED=true npx expo export --platform android` — the bundle
   contains `Dashboard/*` titles.
5. Host regression: `npm test --workspace=minimeters-mobile` in the parent repo.
6. Commit `docs(dashboard): document the dashboard container contracts`.

---

## Risks and open questions

- **Gesture feel without a library.** No inertia, no auto-scroll while dragging.
  Acceptable for a viewport-sized grid; revisit only if a device run demands it.
- **Ragged drag targets.** Dragging a 2×2 onto a 1×1 displaces the 1×1 rather than
  swapping. Documented in the spec (§4.1) so the host knows what to expect.
- **Accessibility.** Gesture-only interaction in this phase; `accessibilityRole`
  and labels are present, full host-driven controls are a recorded follow-up.
- **Column-count changes.** Rotation calls `normalizeLayout`; spans wider than the
  new column count clamp, so a 4-column layout becomes compact but not identical
  on a 2-column phone. Accepted and covered in stories.
