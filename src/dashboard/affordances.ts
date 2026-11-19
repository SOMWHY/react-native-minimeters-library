import type { GridConfig, GridPlacement } from './types';

/**
 * Which edit affordances a card exposes.
 *
 * Kept as a pure function so the "no gesture handlers outside edit mode" rule can
 * be tested without mounting a React Native tree — the rule is a contract, not a
 * styling detail.
 */
export interface CardAffordances {
  readonly draggable: boolean;
  readonly resizable: boolean;
  readonly hideable: boolean;
}

export function cardAffordances(editing: boolean): CardAffordances {
  return editing
    ? { draggable: true, resizable: true, hideable: true }
    : { draggable: false, resizable: false, hideable: false };
}

/**
 * Whether a resize in the given direction would still leave a legal placement.
 *
 * The handle is rendered even when a limit is reached (so the affordance does not
 * flicker); this predicate lets the card report why nothing is moving.
 */
export function canResize(
  placement: GridPlacement,
  delta: { readonly dCols: number; readonly dRows: number },
  config: GridConfig,
): boolean {
  const colSpan = placement.colSpan + delta.dCols;
  const rowSpan = placement.rowSpan + delta.dRows;

  return (
    colSpan >= config.minColSpan &&
    colSpan <= config.maxColSpan &&
    colSpan <= config.columns - placement.col &&
    rowSpan >= config.minRowSpan &&
    rowSpan <= config.maxRowSpan
  );
}
