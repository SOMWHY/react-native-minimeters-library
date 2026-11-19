import { PanResponder } from 'react-native';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ModuleCard } from './ModuleCard';
import { dragDeltaToCells } from './gestures';
import type { CellTarget } from './gestures';
import type { CellRect, DashboardItem, GridMetrics } from './types';
import type { VisualizationTheme } from '../theme/types';

export interface DraggableCardProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly editing: boolean;
  readonly rect: CellRect;
  readonly cellWidth: number;
  readonly metrics: GridMetrics;
  readonly config: { readonly columns: number };
  /** Called once, on release, with the cell the card should settle into. */
  readonly onDragEnd: (target: CellTarget) => void;
  readonly children: ReactNode;
}

/** Below this many pixels a touch is a tap, not a drag. */
const DRAG_THRESHOLD = 2;

/**
 * A card plus its drag gesture.
 *
 * Mid-drag the card follows the finger through a transform only; the layout array
 * is untouched until release, so `onLayoutChange` stays a settled event the host
 * can persist. Outside edit mode no responder is created at all.
 */
export function DraggableCard({
  item,
  theme,
  editing,
  rect,
  cellWidth,
  metrics,
  config,
  onDragEnd,
  children,
}: DraggableCardProps) {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });

  const responder = useMemo(() => {
    if (!editing) {
      return null;
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD ||
        Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        setOffset({ dx: 0, dy: 0 });
      },
      onPanResponderMove: (_event, gesture) => {
        setOffset({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        setOffset({ dx: 0, dy: 0 });
        onDragEnd(
          dragDeltaToCells(
            { dx: gesture.dx, dy: gesture.dy },
            {
              cellWidth,
              rowHeight: metrics.rowHeight,
              gap: metrics.gap,
              columns: config.columns,
              placement: item.placement,
            },
          ),
        );
      },
      onPanResponderTerminate: () => {
        setOffset({ dx: 0, dy: 0 });
      },
    });
  }, [cellWidth, config.columns, editing, item.placement, metrics.gap, metrics.rowHeight, onDragEnd]);

  return (
    <ModuleCard
      item={item}
      theme={theme}
      editing={editing}
      rect={rect}
      dragHandlers={responder?.panHandlers}
      offset={offset}
    >
      {children}
    </ModuleCard>
  );
}
