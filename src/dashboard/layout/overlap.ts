import type { GridConfig, GridPlacement } from '../types';

/** Two rectangles share at least one cell. Edge-adjacent rects do not overlap. */
export function rectsOverlap(a: GridPlacement, b: GridPlacement): boolean {
  const aRight = a.col + a.colSpan;
  const bRight = b.col + b.colSpan;
  const aBottom = a.row + a.rowSpan;
  const bBottom = b.row + b.rowSpan;

  return a.col < bRight && b.col < aRight && a.row < bBottom && b.row < aBottom;
}

/** Every column of the placement exists in the grid. */
export function fitsInColumns(
  placement: GridPlacement,
  columns: number,
): boolean {
  return placement.col >= 0 && placement.col + placement.colSpan <= columns;
}

/**
 * A misconfigured grid is a programming error, not user data, so it throws
 * rather than silently clamping: a silent clamp hides the bug at the call site.
 */
export function assertGridConfig(config: GridConfig): void {
  const {
    columns,
    maxColSpan,
    maxRowSpan,
    minColSpan,
    minRowSpan,
  } = config;

  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError(`grid columns must be a positive integer, got ${columns}`);
  }

  if (!Number.isInteger(minColSpan) || minColSpan < 1) {
    throw new RangeError(`minColSpan must be a positive integer, got ${minColSpan}`);
  }

  if (!Number.isInteger(minRowSpan) || minRowSpan < 1) {
    throw new RangeError(`minRowSpan must be a positive integer, got ${minRowSpan}`);
  }

  if (maxColSpan < minColSpan) {
    throw new RangeError(
      `maxColSpan (${maxColSpan}) must be >= minColSpan (${minColSpan})`,
    );
  }

  if (maxRowSpan < minRowSpan) {
    throw new RangeError(
      `maxRowSpan (${maxRowSpan}) must be >= minRowSpan (${minRowSpan})`,
    );
  }

  if (maxColSpan > columns) {
    throw new RangeError(
      `maxColSpan (${maxColSpan}) cannot exceed columns (${columns})`,
    );
  }
}
