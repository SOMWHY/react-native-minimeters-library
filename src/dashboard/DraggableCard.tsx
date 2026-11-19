import { PanResponder } from 'react-native';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ModuleCard } from './ModuleCard';
import { dragDeltaToCells, resizeDeltaToSpans } from './gestures';
import type { CellTarget, SpanTarget } from './gestures';
import type {
  CellRect,
  DashboardItem,
  GridConfig,
  GridMetrics,
} from './types';
import type { VisualizationTheme } from '../theme/types';

export interface DraggableCardProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly editing: boolean;
  readonly rect: CellRect;
  readonly cellWidth: number;
  readonly metrics: GridMetrics;
  readonly config: GridConfig;
  /** Called once, on release, with the cell the card should settle into. */
  readonly onDragEnd: (target: CellTarget) => void;
  /** Called once, on release, with the spans the card should settle into. */
  readonly onResizeEnd: (target: SpanTarget) => void;
  readonly children: ReactNode;
}

/** Below this many pixels a touch is a tap, not a drag. */
const DRAG_THRESHOLD = 2;

const NO_OFFSET = { dx: 0, dy: 0 };
const NO_SIZE = { dw: 0, dh: 0 };

/**
 * A card plus its drag and resize gestures.
 *
 * Mid-gesture the card follows the finger through a transform (drag) or a pixel
 * size delta (resize); the layout array is untouched until release, so
 * `onLayoutChange` stays a settled event the host can persist. Outside edit mode
 * no responder is created at all.
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
  onResizeEnd,
  children,
}: DraggableCardProps) {
  const [offset, setOffset] = useState(NO_OFFSET);
  const [sizeDelta, setSizeDelta] = useState(NO_SIZE);

  const dragResponder = useMemo(() => {
    if (!editing) {
      return null;
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD ||
        Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        setOffset(NO_OFFSET);
      },
      onPanResponderMove: (_event, gesture) => {
        setOffset({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        setOffset(NO_OFFSET);
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
        setOffset(NO_OFFSET);
      },
    });
  }, [
    cellWidth,
    config.columns,
    editing,
    item.placement,
    metrics.gap,
    metrics.rowHeight,
    onDragEnd,
  ]);

  const resizeResponder = useMemo(() => {
    if (!editing) {
      return null;
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD ||
        Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        setSizeDelta(NO_SIZE);
      },
      onPanResponderMove: (_event, gesture) => {
        // Never preview a card smaller than a touch target.
        setSizeDelta({
          dw: Math.max(-rect.width + 32, gesture.dx),
          dh: Math.max(-rect.height + 32, gesture.dy),
        });
      },
      onPanResponderRelease: (_event, gesture) => {
        setSizeDelta(NO_SIZE);
        onResizeEnd(
          resizeDeltaToSpans(
            { dx: gesture.dx, dy: gesture.dy },
            {
              cellWidth,
              rowHeight: metrics.rowHeight,
              gap: metrics.gap,
              columns: config.columns,
              placement: item.placement,
              config,
            },
          ),
        );
      },
      onPanResponderTerminate: () => {
        setSizeDelta(NO_SIZE);
      },
    });
  }, [
    cellWidth,
    config,
    editing,
    item.placement,
    metrics.gap,
    metrics.rowHeight,
    onResizeEnd,
    rect.height,
    rect.width,
  ]);

  return (
    <ModuleCard
      item={item}
      theme={theme}
      editing={editing}
      rect={rect}
      dragHandlers={dragResponder?.panHandlers}
      resizeHandlers={resizeResponder?.panHandlers}
      offset={offset}
      sizeDelta={sizeDelta}
    >
      {children}
    </ModuleCard>
  );
}
