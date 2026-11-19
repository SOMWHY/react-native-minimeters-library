import type {
  CellRect,
  DashboardItem,
  GridConfig,
  GridMetrics,
  PlacedDashboardItem,
} from './types';

/** Default span limits: a module is at least one cell and at most half the row. */
export const DEFAULT_GRID_CONFIG: GridConfig = Object.freeze({
  columns: 2,
  minColSpan: 1,
  minRowSpan: 1,
  maxColSpan: 2,
  maxRowSpan: 4,
});

/**
 * Ready-made metrics for the two form factors the library promises to support.
 * The host may pass anything else; these exist so the common cases are not
 * re-invented per screen.
 */
export const GRID_PRESETS = Object.freeze({
  phone: Object.freeze({ columns: 2, rowHeight: 96, gap: 8, padding: 12 }),
  tablet: Object.freeze({ columns: 4, rowHeight: 120, gap: 12, padding: 16 }),
}) satisfies Record<string, GridMetrics>;

function cellX(col: number, cellWidth: number, metrics: GridMetrics): number {
  return metrics.padding + col * (cellWidth + metrics.gap);
}

function cellY(row: number, metrics: GridMetrics): number {
  return metrics.padding + row * (metrics.rowHeight + metrics.gap);
}

/**
 * Map grid cells to points.
 *
 * `cellWidth` is measured by the caller because a pure function cannot measure a
 * container; everything else comes from `metrics`.
 */
export function layoutRects(
  items: readonly DashboardItem[],
  metrics: GridMetrics,
  cellWidth: number,
): PlacedDashboardItem[] {
  return items
    .filter((item) => item.visible)
    .map((item) => {
      const { col, row, colSpan, rowSpan } = item.placement;
      const rect: CellRect = {
        x: cellX(col, cellWidth, metrics),
        y: cellY(row, metrics),
        width: colSpan * cellWidth + (colSpan - 1) * metrics.gap,
        height: rowSpan * metrics.rowHeight + (rowSpan - 1) * metrics.gap,
      };

      return { item, rect };
    });
}

/** Bottom edge of the lowest visible item, plus the container padding. */
export function gridHeight(
  items: readonly DashboardItem[],
  metrics: GridMetrics,
): number {
  let rows = 0;

  for (const item of items) {
    if (!item.visible) {
      continue;
    }

    rows = Math.max(rows, item.placement.row + item.placement.rowSpan);
  }

  if (rows === 0) {
    return 0;
  }

  return (
    metrics.padding * 2 + rows * metrics.rowHeight + (rows - 1) * metrics.gap
  );
}
