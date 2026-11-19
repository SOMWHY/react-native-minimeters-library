import type { DashboardItem, GridConfig, GridPlacement } from '../types';
import { rectsOverlap } from './overlap';

function collides(
  candidate: GridPlacement,
  items: readonly DashboardItem[],
  ignoreId: string,
): boolean {
  return items.some(
    (item) =>
      item.visible &&
      item.id !== ignoreId &&
      rectsOverlap(item.placement, candidate),
  );
}

function moveTo(item: DashboardItem, placement: GridPlacement): DashboardItem {
  return { ...item, placement };
}

/** One up-pass and one left-pass; returns the next layout and whether it moved. */
function settle(
  items: readonly DashboardItem[],
  columns: number,
): { items: DashboardItem[]; moved: boolean } {
  let moved = false;
  let current = items as readonly DashboardItem[];

  // Gravity: every module falls upward.
  for (const item of items) {
    if (!item.visible) {
      continue;
    }

    let { placement } = current.find((entry) => entry.id === item.id) ?? item;
    let next = placement;

    while (next.row > 0) {
      const candidate = { ...next, row: next.row - 1 };

      if (collides(candidate, current, item.id)) {
        break;
      }

      next = candidate;
    }

    if (next.row !== placement.row) {
      current = current.map((entry) =>
        entry.id === item.id ? moveTo(entry, next) : entry,
      );
      moved = true;
      placement = next;
    }
  }

  // Then they slide left into any remaining hole.
  for (const item of items) {
    if (!item.visible) {
      continue;
    }

    const { placement } = current.find((entry) => entry.id === item.id) ?? item;
    let next = placement;

    while (next.col > 0 && next.col - 1 + next.colSpan <= columns) {
      const candidate = { ...next, col: next.col - 1 };

      if (collides(candidate, current, item.id)) {
        break;
      }

      next = candidate;
    }

    if (next.col !== placement.col) {
      current = current.map((entry) =>
        entry.id === item.id ? moveTo(entry, next) : entry,
      );
      moved = true;
    }
  }

  return { items: [...current], moved };
}

/**
 * Gravity fill: pull every visible module up, then left, until nothing moves.
 *
 * Spans are never touched — a hole is closed by a neighbour moving into it, not
 * by stretching anything. Hidden items keep their placement and never block.
 */
export function compact(
  items: readonly DashboardItem[],
  config: GridConfig,
): DashboardItem[] {
  const columns = config.columns;
  let current: DashboardItem[] = items.map((item) => ({ ...item }));

  // Each pass either moves something or stops. The cap guarantees termination
  // even for adversarial input.
  const cap = Math.max(1, current.length * (current.length + 2));

  for (let pass = 0; pass < cap; pass += 1) {
    const result = settle(current, columns);
    current = result.items;

    if (!result.moved) {
      break;
    }
  }

  return current;
}
