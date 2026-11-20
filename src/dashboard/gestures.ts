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
 * Snap a bottom-right resize drag to whole cells, honouring the configured span
 * limits and the room left between the card and the right edge.
 *
 * Never returns a span the grid cannot hold, so the caller can hand the result to
 * `resizeItem` without a second validation pass.
 */
export function resizeDeltaToSpans(
  delta: { readonly dx: number; readonly dy: number },
  context: ResizeContext,
): SpanTarget {
  const placement = resizeCornerToPlacement('bottom-right', delta, context);

  return { colSpan: placement.colSpan, rowSpan: placement.rowSpan };
}

/** Which of the card's corners owns a resize drag. */
export type ResizeCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

function isLeadingCorner(corner: ResizeCorner): boolean {
  return corner === 'top-left' || corner === 'bottom-left';
}

function isTopCorner(corner: ResizeCorner): boolean {
  return corner === 'top-left' || corner === 'top-right';
}

interface AxisResult {
  readonly start: number;
  readonly span: number;
}

/**
 * Clamp one axis of a corner resize.
 *
 * `deltaCells` is always positive towards greater coordinates. The edge the finger
 * is not holding stays put: holding the right edge grows the span, holding the left
 * edge moves the origin and grows the span by the same amount. Growth stops at the
 * configured maximum span, at `limit` (the column count, when known) and at the grid
 * origin. When the grid cannot hold the configured minimum the available room wins,
 * because drawing a card outside the grid would be worse than a smaller card.
 */
function resizeAxis(
  start: number,
  span: number,
  deltaCells: number,
  draggedStart: boolean,
  minSpan: number,
  maxSpan: number,
  limit: number | undefined,
): AxisResult {
  if (draggedStart) {
    const end = start + span;
    const room = limit === undefined ? end : Math.min(end, limit);
    const cap = Math.max(1, Math.min(maxSpan, room));
    const nextSpan = clamp(span - deltaCells, Math.min(minSpan, cap), cap);

    return { start: end - nextSpan, span: nextSpan };
  }

  const room = limit === undefined ? Number.POSITIVE_INFINITY : limit - start;
  const cap = Math.max(1, Math.min(maxSpan, room));

  return {
    start: Math.max(0, start),
    span: clamp(span + deltaCells, Math.min(minSpan, cap), cap),
  };
}

/**
 * Snap a resize drag at any corner to a whole-cell placement.
 *
 * Returns the complete `GridPlacement`, not just spans, because holding the left
 * or top edge moves the origin: the bottom-right corner of the card is the anchor
 * in that case. The caller can hand the result straight to
 * `resizeItemToPlacement`.
 */
export function resizeCornerToPlacement(
  corner: ResizeCorner,
  delta: { readonly dx: number; readonly dy: number },
  context: ResizeContext,
): GridPlacement {
  const { cellWidth, rowHeight, gap, columns, placement, config } = context;

  if (cellWidth <= 0) {
    return placement;
  }

  const horizontal = resizeAxis(
    placement.col,
    placement.colSpan,
    cellsFor(delta.dx, cellWidth + gap),
    isLeadingCorner(corner),
    config.minColSpan,
    config.maxColSpan,
    columns,
  );
  const vertical = resizeAxis(
    placement.row,
    placement.rowSpan,
    cellsFor(delta.dy, rowHeight + gap),
    isTopCorner(corner),
    config.minRowSpan,
    config.maxRowSpan,
    undefined,
  );

  return {
    col: horizontal.start,
    row: vertical.start,
    colSpan: horizontal.span,
    rowSpan: vertical.span,
  };
}

/** Size of one corner handle on a card of the given size. */
export interface CornerZoneSize {
  readonly width: number;
  readonly height: number;
}

/** Corner handles cap out here, so a tall card does not grow a huge touch target. */
export const MAX_CORNER_WIDTH = 64;
export const MAX_CORNER_HEIGHT = 40;

/**
 * Adaptive corner handle size: half the card, capped.
 *
 * Halving is what keeps the top and bottom handles from overlapping on a one-row
 * card, so every corner stays independently hittable.
 */
export function cornerZoneSize(
  cardWidth: number,
  cardHeight: number,
): CornerZoneSize {
  return {
    width: Math.max(1, Math.min(cardWidth / 2, MAX_CORNER_WIDTH)),
    height: Math.max(1, Math.min(cardHeight / 2, MAX_CORNER_HEIGHT)),
  };
}

/** Card-local rectangles for the four corner handles, for tests and for laying out. */
export function cornerZones(
  cardWidth: number,
  cardHeight: number,
): Record<ResizeCorner, { x: number; y: number; width: number; height: number }> {
  const { width, height } = cornerZoneSize(cardWidth, cardHeight);

  return {
    'top-left': { x: 0, y: 0, width, height },
    'top-right': { x: cardWidth - width, y: 0, width, height },
    'bottom-left': { x: 0, y: cardHeight - height, width, height },
    'bottom-right': {
      x: cardWidth - width,
      y: cardHeight - height,
      width,
      height,
    },
  };
}
