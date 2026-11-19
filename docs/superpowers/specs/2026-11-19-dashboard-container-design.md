# Dashboard Container — Design Spec (Phase 4)

**Status:** proposed
**Depends on:** Phase 2 (Skia base, `STRUCTURAL_TOKENS`, themes) and Phase 3 (seven
modules, `ModuleSurface`, `ModuleStatus`).
**Product source of truth:** `overview.md` §4 (dashboard container) and §6/§7
(preview and acceptance).

## 1. Goal

Ship the dashboard container: a grid of Phase 3 modules that can be dragged,
resized, hidden, and restored, with gravity fill and deterministic auto
placement — all driven by one layout data model and pure functions.

The library owns the layout maths and the rendering. It does **not** own layout
persistence: the host stores the array and passes it back in.

## 2. Scope and non-goals

In scope:

- One layout data model (`DashboardLayout`) shared by drag, resize, visibility,
  gravity fill, and reset.
- Pure layout functions, unit-tested in Node (no React, no Skia).
- `DashboardGrid` container that maps grid cells to pixels and hosts module cards.
- `ModuleCard` shell: label, drag entry point, resize handle (edit mode only).
- `ModuleTray` for hidden modules (restore path).
- Edit-mode / non-edit-mode separation: outside edit mode nothing is draggable.
- Storybook previews for stable layout, edit interactions, gravity fill, restore,
  and several grid configurations.

Non-goals (unchanged from `overview.md`):

- Persistence, routing, networking, scanning, auth.
- Theme selection UI (host owns it).
- INI theme import (still deferred; no authoritative sample).
- Any change to Phase 3 module internals. The dashboard consumes modules; it does
  not modify them.

## 3. Layout data model

```ts
export type ModuleKind =
  | 'waveform'
  | 'oscilloscope'
  | 'vectorscope'
  | 'spectrum'
  | 'vu'
  | 'loudness'
  | 'spectrogram';

/** Grid placement in integer cells. Never pixels. */
export interface GridPlacement {
  readonly col: number;
  readonly row: number;
  readonly colSpan: number;
  readonly rowSpan: number;
}

export interface DashboardItem {
  /** Host-owned identity. Stable across reorders; never derived from position. */
  readonly id: string;
  readonly kind: ModuleKind;
  readonly visible: boolean;
  readonly placement: GridPlacement;
  /** Optional per-item label override; falls back to the module default. */
  readonly label?: string;
}

export interface DashboardLayout {
  readonly items: readonly DashboardItem[];
}

export interface GridConfig {
  readonly columns: number;
  /** Minimum spans, enforced by resize and normalization. */
  readonly minColSpan: number;
  readonly minRowSpan: number;
  /** Maximum spans, so no module can swallow the whole viewport. */
  readonly maxColSpan: number;
  readonly maxRowSpan: number;
}

export interface GridMetrics {
  readonly columns: number;
  /** Rendered height of one grid row, in points. */
  readonly rowHeight: number;
  readonly gap: number;
  readonly padding: number;
}
```

Rules that the type system cannot express, and which every function must uphold:

1. **Hidden items stay in the array.** `visible: false` items keep their
   `placement` so restoring them returns them to their prior order and slot
   (subject to compaction, which only ever moves visible items).
2. **Placements are integer cells inside bounds.** `0 <= col`, `0 <= row`,
   `col + colSpan <= columns`, `0 < rowSpan`. There is no total row count: the
   grid grows downward as far as the layout needs.
3. **Spans are clamped to `[minColSpan, maxColSpan] × [minRowSpan, maxRowSpan]`
   and to the column count.** A config whose `maxColSpan` exceeds `columns` is
   itself invalid and rejected at function entry (throw, not silent clamp — a
   misconfigured grid is a programming error, not user data).
4. **Item order in the array is the tie-breaker.** Compaction and auto placement
   are deterministic for a given array; identical input yields identical output.

## 4. Pure function contracts

All of these live in `src/dashboard/layout.ts` (single module, no React imports)
so Node tests can require the compiled file directly.

```ts
export interface Rect { readonly col: number; readonly row: number; readonly colSpan: number; readonly rowSpan: number }

export function rectsOverlap(a: GridPlacement, b: GridPlacement): boolean;
export function fitsInColumns(placement: GridPlacement, columns: number): boolean;

/** First free slot scanning top→bottom, left→right, in item-array order. */
export function findSlot(
  items: readonly DashboardItem[],
  candidate: { id: string; colSpan: number; rowSpan: number },
  columns: number,
): GridPlacement | null;

/** Gravity fill: move every visible item up, then left, as far as it can go. */
export function compact(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[];

/** Clamp spans and positions and repack overlaps, preserving order. */
export function normalizeLayout(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[];

/** Deterministic placement for items with no valid slot. */
export function autoPlace(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[];

/** Drag result: place `id` at the target cell, displacing occupants downward. */
export function moveItem(
  items: readonly DashboardItem[],
  id: string,
  target: { col: number; row: number },
  config: GridConfig,
): DashboardItem[];

/** Resize result: clamp spans, then compact. */
export function resizeItem(
  items: readonly DashboardItem[],
  id: string,
  span: { colSpan: number; rowSpan: number },
  config: GridConfig,
): DashboardItem[];

export function setVisibility(
  items: readonly DashboardItem[],
  id: string,
  visible: boolean,
  config: GridConfig,
): DashboardItem[];

/** Host-facing reset: restore spans/order, all visible, compacted. */
export function resetLayout(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[];

/** Visible items in array order — the render list. */
export function visibleItems(items: readonly DashboardItem[]): DashboardItem[];
```

### 4.1 Collision semantics

`moveItem` and `resizeItem` **displace**, they do not swap. The moved item wins
its target rectangle; every visible item it now overlaps is pushed down to the
first free row at its own column, and the resulting layout is then compacted.
Rationale: a drag is a placement intent, and swapping would make a 1×1 and a 2×2
exchange shapes, which reads as a layout bug to the user.

Overlap detection is per-rectangle (`rectsOverlap`), not per-cell, so a drag that
merely passes over another module never leaves a hole.

### 4.2 Gravity fill semantics

`compact` runs two passes, repeated until stable:

1. For each visible item in array order, move it up while the row above is free.
2. For each visible item in array order, move it left while the column to the
   left is free.

Hidden items never move and never block: they are skipped in both passes, so
restoring one afterwards goes through `autoPlace` if its old slot is taken. The
layout is never stretched — spans are untouched, so a hole is filled by another
module moving into it, never by growing a neighbour.

### 4.3 Auto placement semantics

`findSlot` scans rows top→bottom and columns left→right for the first rectangle
of the requested span that does not overlap any visible item and stays inside
`columns`. `autoPlace` gives every visible item without a valid slot the result
of `findSlot` in array order, then compacts. If `findSlot` returns `null` (the
grid is full at that width), the item is placed in a fresh row below every
existing item at column `0` — the grid grows, it never drops an item.

## 5. Rendering

### 5.1 Geometry

```ts
export interface CellRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export function layoutRects(
  items: readonly DashboardItem[],
  metrics: GridMetrics,
): ReadonlyArray<{ item: DashboardItem; rect: CellRect }>;

export function gridHeight(
  items: readonly DashboardItem[],
  metrics: GridMetrics,
): number;
```

`layoutRects` is pure and only turns cells into points:

- `cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns`, computed by
  the caller and passed in as part of metrics — see note below.
- `x = padding + col * (cellWidth + gap)`
- `y = padding + row * (rowHeight + gap)`
- `width = colSpan * cellWidth + (colSpan - 1) * gap`
- `height = rowSpan * rowHeight + (rowSpan - 1) * gap`

Because the container measures itself, the pixel-width-dependent part is passed
in explicitly: `layoutRects` takes `metrics` plus a `cellWidth` number. That keeps
the function pure and testable without a layout engine.

`gridHeight` returns the bottom edge of the lowest visible item plus `padding`, so
the container can scroll instead of clipping.

### 5.2 Components

```tsx
export interface DashboardGridProps {
  readonly layout: DashboardLayout;
  readonly theme: VisualizationTheme;
  readonly config: GridConfig;
  readonly metrics: GridMetrics;
  readonly editing?: boolean;
  /** Render the module body for an item; the host owns data injection. */
  readonly renderModule: (item: DashboardItem) => ReactNode;
  readonly onLayoutChange: (layout: DashboardLayout) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export interface ModuleCardProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly editing: boolean;
  readonly rect: CellRect;
  readonly onDragStart?: () => void;
  readonly onDragMove?: (dx: number, dy: number) => void;
  readonly onDragEnd?: (dx: number, dy: number) => void;
  readonly onResizeMove?: (dCols: number, dRows: number) => void;
  readonly onResizeEnd?: (dCols: number, dRows: number) => void;
  readonly onHide?: () => void;
  readonly children: ReactNode;
}

export interface ModuleTrayProps {
  readonly hidden: readonly DashboardItem[];
  readonly theme: VisualizationTheme;
  readonly onRestore: (id: string) => void;
}
```

- `DashboardGrid` is a `View` with `position: absolute` children positioned from
  `layoutRects`. It calls `renderModule` per visible item; the host decides which
  Phase 3 module and which data. The grid never inspects module data.
- `ModuleCard` renders the label, hosts the module body, and in `editing` mode
  shows a drag area and a resize handle. Outside edit mode it renders no gesture
  handlers at all — not disabled ones.
- `renderModule` returning a module is the only coupling point between phases, so
  a new module kind never requires a dashboard change.

### 5.3 Interaction

Drag and resize use React Native's own `PanResponder` — no new dependency, and
no gesture library that would need its own Skia/Worklets version alignment.

Pure helpers keep the arithmetic testable:

```ts
export function dragDeltaToCells(
  dx: number,
  dy: number,
  cellWidth: number,
  rowHeight: number,
  gap: number,
): { dCol: number; dRow: number };

export function resizeDeltaToSpans(
  dx: number,
  dy: number,
  cellWidth: number,
  rowHeight: number,
  gap: number,
): { dColSpan: number; dRowSpan: number };
```

Both round toward the nearest cell boundary with a half-cell threshold, so a
short drag is not mistaken for a move, and they clamp to `±` the current
placement bounds.

`DashboardGrid` holds transient gesture state (the dragged item and its cell
delta) and only calls `onLayoutChange` on release. Mid-drag it repositions the
dragged card in pixel space via `transform`; the array is not mutated per frame.
That keeps `onLayoutChange` a settled-layout event the host can persist directly.

## 6. Responsive configuration

`metrics.columns` and `rowHeight` come from the host, so the same layout serves
different screens. The library exports two presets:

```ts
export const GRID_PRESETS = {
  phone: { columns: 2, rowHeight: 96, gap: 8, padding: 12 },
  tablet: { columns: 4, rowHeight: 120, gap: 12, padding: 16 },
} as const satisfies Record<string, GridMetrics>;
```

When the column count changes (rotation, split view), the host calls
`normalizeLayout` with the new config; spans wider than the new column count are
clamped (never silently dropped) and then compacted. Stories cover 2, 3, and 4
columns, and both orientations of a phone-sized frame.

## 7. Testing strategy

Node tests (`tests/dashboard.test.cjs`, requiring compiled `dist/dashboard/*`):

- `rectsOverlap` / `fitsInColumns` boundaries (edge-adjacent rects do not overlap).
- `findSlot`: top-left first, respects array order, returns `null` on a full grid.
- `compact`: gravity fill after hiding, idempotence (compact twice = once),
  hidden items unmoved, spans never changed.
- `moveItem`: target wins, displaced occupant pushed down and compacted, no
  overlap remains, no item lost (id multiset preserved).
- `resizeItem`: span clamping at min and max, overlap displacement, compaction.
- `setVisibility`: hidden item retained with placement, restore lands in a valid
  non-overlapping slot.
- `autoPlace` / `normalizeLayout`: deterministic for identical input, invalid
  config throws, over-wide spans clamped.
- `layoutRects` / `gridHeight`: pixel maths for 1×1 and 2×2, gap accounting,
  empty layout.
- `dragDeltaToCells` / `resizeDeltaToSpans`: half-cell thresholds, clamping.

Storybook stories (on-device, isolated example):

- Stable non-edit layout with the seven Phase 3 modules in fixtures.
- Edit mode: drag entry points and resize handles visible; non-edit mode: absent.
- Gravity fill after hiding a middle module.
- Restore from the tray with auto placement.
- 2/3/4-column configurations and a phone-landscape frame.

Gesture behaviour itself is verified on device; the arithmetic behind it is
verified in Node.

## 8. Risks and open questions

- **Gesture feel.** `PanResponder` is dependency-free but has no inertia or
  auto-scroll. Acceptable for a grid that fits the viewport; a scrolling grid may
  later want a gesture library. Documented rather than pre-solved.
- **Absolute positioning vs. flex.** Absolute pixel placement keeps grid maths in
  one tested function and makes drag previews trivial; the cost is that the
  container must know its own width. Handled by measuring the container and
  passing `cellWidth` in.
- **No layout persistence.** Intentional per `overview.md` §4.3. The host owns it.
- **Accessibility.** Hide/restore and resize are reachable only through gesture
  handles in this phase. `ModuleCard` exposes `accessibilityLabel`/`accessibilityRole`
  for the handles, and a host can drive `onLayoutChange` from its own controls;
  a full keyboard/switch story is out of scope here and recorded in `TODO.md`.
