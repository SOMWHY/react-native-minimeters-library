import type { DashboardItem, GridConfig, GridPlacement } from '../types';
import { compact } from './compact';
import { assertGridConfig, fitsInColumns, rectsOverlap } from './overlap';
import { autoPlace, findSlot } from './placement';

function clampSpan(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function placementOf(items: readonly DashboardItem[], id: string): GridPlacement | undefined {
  return items.find((item) => item.id === id)?.placement;
}

/**
 * Resolve overlaps so that a chosen item keeps its cell and everyone else moves
 * out of the way into the first free hole (or a fresh row when the grid is full).
 *
 * `priorityId` is the item the user is manipulating — a drag or resize must land
 * where it was dropped, so it is placed before anything else. Without it, array
 * order decides. Span and column validity are clamped here as well, because a
 * displacement must never produce a placement the grid cannot show.
 */
function resolveOverlaps(
  items: readonly DashboardItem[],
  columns: number,
  priorityId?: string,
): DashboardItem[] {
  const ordered = priorityId
    ? [
        ...items.filter((item) => item.id === priorityId),
        ...items.filter((item) => item.id !== priorityId),
      ]
    : items;

  const placed: DashboardItem[] = [];

  for (const item of ordered) {
    if (!item.visible) {
      placed.push(item);
      continue;
    }

    const colSpan = Math.min(Math.max(1, item.placement.colSpan), columns);
    const rowSpan = Math.max(1, item.placement.rowSpan);
    let placement: GridPlacement = {
      colSpan,
      rowSpan,
      col: Math.min(
        Math.max(0, item.placement.col),
        Math.max(0, columns - colSpan),
      ),
      row: Math.max(0, item.placement.row),
    };

    const clashes = placed.some(
      (other) => other.visible && rectsOverlap(other.placement, placement),
    );

    if (clashes) {
      const slot = findSlot(
        placed,
        { id: item.id, colSpan, rowSpan },
        columns,
      );

      placement =
        slot ??
        {
          col: 0,
          row: placed
            .filter((other) => other.visible)
            .reduce(
              (max, other) => Math.max(max, other.placement.row + other.placement.rowSpan),
              0,
            ),
          colSpan,
          rowSpan,
        };
    }

    placed.push({ ...item, placement });
  }

  // Restore the caller's array order so host-side rendering order is stable.
  return items.map((item) => placed.find((entry) => entry.id === item.id) ?? item);
}

/** Apply a span change to one item, keeping it inside the column count. */
function withSpan(
  item: DashboardItem,
  span: { colSpan: number; rowSpan: number },
  config: GridConfig,
): DashboardItem {
  const colSpan = clampSpan(span.colSpan, config.minColSpan, config.maxColSpan);
  const rowSpan = clampSpan(span.rowSpan, config.minRowSpan, config.maxRowSpan);

  return {
    ...item,
    placement: {
      ...item.placement,
      colSpan,
      rowSpan,
      col: Math.min(item.placement.col, Math.max(0, config.columns - colSpan)),
    },
  };
}

/** Apply a position change to one item, clamped inside the grid. */
function withPosition(
  item: DashboardItem,
  target: { col: number; row: number },
  config: GridConfig,
): DashboardItem {
  const colSpan = Math.min(item.placement.colSpan, config.columns);

  return {
    ...item,
    placement: {
      ...item.placement,
      colSpan,
      col: Math.min(
        Math.max(0, Math.round(target.col)),
        Math.max(0, config.columns - colSpan),
      ),
      row: Math.max(0, Math.round(target.row)),
    },
  };
}

/**
 * Drag result: the moved item wins its target cell and everything it lands on is
 * pushed down. A drag is a placement intent, so shapes never swap.
 *
 * The grid is deliberately **not** compacted: a drop is a placement the user just
 * chose, and closing the gap it left behind would shuffle every card below it out
 * from under the finger. Compaction belongs to visibility changes and resets.
 */
export function moveItem(
  items: readonly DashboardItem[],
  id: string,
  target: { readonly col: number; readonly row: number },
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const next = items.map((item) =>
    item.id === id && item.visible ? withPosition(item, target, config) : item,
  );

  return resolveOverlaps(next, config.columns, id);
}

/** Apply a whole placement to one item, clamped to the grid. */
function withPlacement(
  item: DashboardItem,
  placement: GridPlacement,
  config: GridConfig,
): DashboardItem {
  const colSpan = clampSpan(
    placement.colSpan,
    config.minColSpan,
    Math.min(config.maxColSpan, config.columns),
  );
  const rowSpan = clampSpan(
    placement.rowSpan,
    config.minRowSpan,
    config.maxRowSpan,
  );

  return {
    ...item,
    placement: {
      colSpan,
      rowSpan,
      col: Math.min(
        Math.max(0, Math.round(placement.col)),
        Math.max(0, config.columns - colSpan),
      ),
      row: Math.max(0, Math.round(placement.row)),
    },
  };
}

/**
 * Resize result: spans clamp to the configured limits.
 *
 * Like a drag, a resize keeps its hole open — the card the user just widened
 * should not also be teleported upward by a compaction pass.
 */
export function resizeItem(
  items: readonly DashboardItem[],
  id: string,
  span: { readonly colSpan: number; readonly rowSpan: number },
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const next = items.map((item) =>
    item.id === id && item.visible ? withSpan(item, span, config) : item,
  );

  return resolveOverlaps(next, config.columns, id);
}

/**
 * Corner-resize result: the card takes the complete snapped placement.
 *
 * Unlike `resizeItem` this moves the origin too, because holding the left or top
 * edge pulls the card's top-left corner with the finger while the opposite corner
 * stays anchored. The priority item keeps its drop placement and everything it now
 * covers is pushed into the next free hole, same as a drag.
 */
export function resizeItemToPlacement(
  items: readonly DashboardItem[],
  id: string,
  placement: GridPlacement,
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const next = items.map((item) =>
    item.id === id && item.visible
      ? withPlacement(item, placement, config)
      : item,
  );

  return resolveOverlaps(next, config.columns, id);
}

/**
 * Visibility toggle.
 *
 * Hiding compacts the remaining modules. Showing gives the item its prior slot
 * when it is still free, otherwise the first free hole, otherwise a new row.
 */
export function setVisibility(
  items: readonly DashboardItem[],
  id: string,
  visible: boolean,
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const next = items.map((item) =>
    item.id === id ? { ...item, visible } : item,
  );

  if (!visible) {
    return compact(next, config);
  }

  const shown = next.find((item) => item.id === id);

  if (shown === undefined) {
    return compact(next, config);
  }

  const others = next.filter((item) => item.id !== id);
  const slot =
    findSlot(
      others,
      {
        id,
        colSpan: Math.min(shown.placement.colSpan, config.columns),
        rowSpan: shown.placement.rowSpan,
      },
      config.columns,
    ) ?? shown.placement;

  const restored = next.map((item) =>
    item.id === id ? { ...item, placement: slot } : item,
  );

  return compact(resolveOverlaps(restored, config.columns), config);
}

/**
 * Clamp spans and positions to the current grid and repack overlaps, preserving
 * array order. The host calls this after a column-count change (rotation).
 */
export function normalizeLayout(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const clamped = items.map((item) =>
    item.visible ? withSpan(item, item.placement, config) : item,
  );

  return compact(resolveOverlaps(clamped, config.columns), config);
}

/**
 * Host-facing reset: show every module and repack the grid.
 *
 * Spans are preserved — the library never stored the original sizes, so claiming
 * to restore them would be a guess. Hosts that need pristine sizes keep their own
 * copy of the layout.
 */
export function resetLayout(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[] {
  assertGridConfig(config);

  const allVisible = items.map((item) => ({ ...item, visible: true }));

  return compact(
    resolveOverlaps(autoPlace(allVisible, config), config.columns),
    config,
  );
}

/**
 * The hidden modules, in layout order.
 *
 * The tray lists exactly this, so the host never has to filter twice and the two
 * views cannot disagree about what is hidden.
 */
export function hiddenItems(
  items: readonly DashboardItem[],
): DashboardItem[] {
  return items.filter((item) => !item.visible);
}

/** Whether a placement is valid in the given grid without overlapping `others`. */
export function placementIsFree(
  others: readonly DashboardItem[],
  placement: GridPlacement,
  columns: number,
): boolean {
  return (
    fitsInColumns(placement, columns) &&
    !others.some(
      (item) => item.visible && rectsOverlap(item.placement, placement),
    )
  );
}

export { placementOf };
