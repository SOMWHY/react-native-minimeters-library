import type { GridConfig, GridPlacement } from './types';

/** Pixel distance a drag must cover before it claims one cell. */
export interface DragContext {
  /** Measured column width. Zero means the container has not laid out yet. */
  readonly cellWidth: number;
  readonly rowHeight: number;
  readonly gap: number;
  /** Column count, when known; omitted means "no right-edge limit". */
  readonly columns?: number;
  readonly placement: GridPlacement;
}

export interface CellTarget {
  readonly col: number;
  readonly row: number;
}

/** Round half a cell away from the origin so a deliberate drag always commits. */
function cellsFor(pixels: number, pitch: number): number {
  if (pitch <= 0) {
    return 0;
  }

  return Math.round(pixels / pitch);
}

/**
 * Snap a drag offset to the cell the card should land on.
 *
 * Returns an absolute cell rather than a delta so the caller can hand it straight
 * to `moveItem`; the item's own span keeps it inside the grid.
 */
export function dragDeltaToCells(
  delta: { readonly dx: number; readonly dy: number },
  context: DragContext,
): CellTarget {
  const { cellWidth, rowHeight, gap, columns, placement } = context;

  if (cellWidth <= 0) {
    return { col: placement.col, row: placement.row };
  }

  const dCol = cellsFor(delta.dx, cellWidth + gap);
  const dRow = cellsFor(delta.dy, rowHeight + gap);

  const maxCol =
    columns === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, columns - placement.colSpan);

  return {
    col: Math.min(maxCol, Math.max(0, placement.col + dCol)),
    row: Math.max(0, placement.row + dRow),
  };
}

/** Context for a resize: the same pixel metrics plus the span limits. */
export interface ResizeContext extends DragContext {
  readonly config: GridConfig;
}

export interface SpanTarget {
  readonly colSpan: number;
  readonly rowSpan: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Snap a resize drag to whole cells, honouring the configured span limits and the
 * room left between the card and the right edge.
 *
 * Never returns a span the grid cannot hold, so the caller can hand the result to
 * `resizeItem` without a second validation pass.
 */
export function resizeDeltaToSpans(
  delta: { readonly dx: number; readonly dy: number },
  context: ResizeContext,
): SpanTarget {
  const { cellWidth, rowHeight, gap, columns, placement, config } = context;

  if (cellWidth <= 0) {
    return { colSpan: placement.colSpan, rowSpan: placement.rowSpan };
  }

  const dCols = cellsFor(delta.dx, cellWidth + gap);
  const dRows = cellsFor(delta.dy, rowHeight + gap);

  const roomForColumns =
    columns === undefined ? config.maxColSpan : columns - placement.col;
  const maxColSpan = Math.max(
    config.minColSpan,
    Math.min(config.maxColSpan, roomForColumns),
  );

  return {
    colSpan: clamp(
      placement.colSpan + dCols,
      config.minColSpan,
      maxColSpan,
    ),
    rowSpan: clamp(
      placement.rowSpan + dRows,
      config.minRowSpan,
      config.maxRowSpan,
    ),
  };
}
