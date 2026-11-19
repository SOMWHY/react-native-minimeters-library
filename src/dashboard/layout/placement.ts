import type { DashboardItem, GridConfig, GridPlacement } from '../types';
import { fitsInColumns, rectsOverlap } from './overlap';

/** Occupied rectangles of the visible items, optionally ignoring one id. */
function occupiedRects(
  items: readonly DashboardItem[],
  ignoreId?: string,
): GridPlacement[] {
  return items
    .filter((item) => item.visible && item.id !== ignoreId)
    .map((item) => item.placement);
}

/**
 * First free rectangle *inside the rows that already exist*, scanning rows
 * top→bottom and columns left→right.
 *
 * Deliberately does not grow the grid: returning `null` tells the caller "there
 * is no hole here", and the caller (see `autoPlace`) decides to add a row. That
 * keeps hole-filling and growth as two separate, separately testable decisions.
 *
 * Deterministic: the scan order is fixed, so identical input always yields the
 * same slot.
 */
export function findSlot(
  items: readonly DashboardItem[],
  candidate: {
    readonly id: string;
    readonly colSpan: number;
    readonly rowSpan: number;
  },
  columns: number,
): GridPlacement | null {
  const occupied = occupiedRects(items, candidate.id);
  const colSpan = Math.min(candidate.colSpan, columns);
  const rowSpan = Math.max(1, candidate.rowSpan);

  // Only rows that already contain something are searched; an empty layout has
  // no rows at all, so the caller must grow it.
  const existingRows = occupied.reduce(
    (max, rect) => Math.max(max, rect.row + rect.rowSpan),
    0,
  );

  for (let row = 0; row < existingRows; row += 1) {
    for (let col = 0; col + colSpan <= columns; col += 1) {
      const placement = { col, row, colSpan, rowSpan };
      const clashes = occupied.some((rect) => rectsOverlap(rect, placement));

      if (!clashes) {
        return placement;
      }
    }
  }

  return null;
}

/**
 * Give every visible item a slot that does not overlap.
 *
 * Items keep the placement they already hold when it is still valid; anything
 * else is placed through `findSlot`. When the grid is full at the current width,
 * the item goes to a fresh row at column 0 — the grid grows downward rather than
 * dropping a module.
 */
export function autoPlace(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[] {
  const columns = config.columns;
  const placed: DashboardItem[] = [];

  for (const item of items) {
    if (!item.visible) {
      placed.push(item);
      continue;
    }

    const current = item.placement;
    const currentFits =
      fitsInColumns(current, columns) &&
      !occupiedRects(placed).some((rect) => rectsOverlap(rect, current));

    if (currentFits) {
      placed.push(item);
      continue;
    }

    const slot = findSlot(
      placed,
      { id: item.id, colSpan: current.colSpan, rowSpan: current.rowSpan },
      columns,
    );

    if (slot !== null) {
      placed.push({ ...item, placement: slot });
      continue;
    }

    const deepestRow = occupiedRects(placed).reduce(
      (max, rect) => Math.max(max, rect.row + rect.rowSpan),
      0,
    );

    placed.push({
      ...item,
      placement: {
        col: 0,
        row: deepestRow,
        colSpan: Math.min(current.colSpan, columns),
        rowSpan: current.rowSpan,
      },
    });
  }

  return placed;
}
