import type { GridPlacement } from './types';

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
