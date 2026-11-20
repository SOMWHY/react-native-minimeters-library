import { Animated, PanResponder } from 'react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { DRAG_HOLD_MS, shouldArmDrag, shouldCancelArm } from './drag-arm';
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
  /** Called when the host should hide the module (edit mode only). */
  readonly onHide: () => void;
  /**
   * Reports whether a drag or resize is in flight, so a host scroll container can
   * stop scrolling for the duration and stop fighting the gesture.
   */
  readonly onGestureStateChange?: (active: boolean) => void;
  readonly children: ReactNode;
}

/**
 * The smallest card a resize preview may collapse to, in dp.
 *
 * Mirrors the corner touch target: a preview smaller than this is neither usable
 * nor a truthful preview of the cell the card will snap into.
 */
const MIN_PREVIEW_SIZE = 32;

interface LatestValues {
  readonly cellWidth: number;
  readonly config: GridConfig;
  readonly metrics: GridMetrics;
  readonly item: DashboardItem;
  readonly rect: CellRect;
  readonly onDragEnd: (target: CellTarget) => void;
  readonly onResizeEnd: (target: SpanTarget) => void;
  readonly onGestureStateChange?: (active: boolean) => void;
}

/**
 * A card plus its drag and resize gestures.
 *
 * Both responders are created **once** per edit session and read their inputs from
 * a ref, because the host re-renders this card on every incoming frame: a responder
 * rebuilt mid-gesture is a responder React Native then loses track of, which is
 * exactly what made dragging feel unreliable.
 *
 * Mid-gesture feedback runs through `Animated.Value`s, so the card tracks the
 * finger without re-rendering the module it wraps. The layout array is untouched
 * until release, so `onLayoutChange` stays a settled event the host can persist.
 *
 * Outside edit mode no responder is created at all.
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
  onHide,
  onGestureStateChange,
  children,
}: DraggableCardProps) {
  const latest = useRef<LatestValues>({
    cellWidth,
    config,
    metrics,
    item,
    rect,
    onDragEnd,
    onResizeEnd,
    onGestureStateChange,
  });

  useEffect(() => {
    latest.current = {
      cellWidth,
      config,
      metrics,
      item,
      rect,
      onDragEnd,
      onResizeEnd,
      onGestureStateChange,
    };
  });

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(Math.max(0, rect.width))).current;
  const height = useRef(new Animated.Value(Math.max(0, rect.height))).current;

  /** Committed size, i.e. the base a resize preview is measured from. */
  const baseSize = useRef({ width: rect.width, height: rect.height });

  useEffect(() => {
    baseSize.current = { width: rect.width, height: rect.height };
    width.setValue(Math.max(0, rect.width));
    height.setValue(Math.max(0, rect.height));
  }, [height, rect.height, rect.width, width]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armed = useRef(false);
  const moved = useRef(0);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    armed.current = false;
  }, []);

  const startHold = useCallback(() => {
    clearHold();
    moved.current = 0;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;

      if (shouldArmDrag(DRAG_HOLD_MS, moved.current)) {
        armed.current = true;
      }
    }, DRAG_HOLD_MS);
  }, [clearHold]);

  /** Track drift so a swipe never arms the drag under the scroll view's feet. */
  const trackDrift = useCallback(
    (dx: number, dy: number) => {
      moved.current = Math.max(Math.abs(dx), Math.abs(dy));

      if (shouldCancelArm(moved.current)) {
        clearHold();
      }
    },
    [clearHold],
  );

  const notifyGesture = useCallback((active: boolean) => {
    latest.current.onGestureStateChange?.(active);
  }, []);

  // Leaving edit mode mid-gesture must not leave a card stuck under the finger.
  useEffect(() => {
    if (!editing) {
      clearHold();
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }, [clearHold, editing, translateX, translateY]);

  const dragResponder = useMemo(() => {
    if (!editing) {
      return null;
    }

    return PanResponder.create({
      // A touch is never claimed on contact: taps have to reach the hide button,
      // and swipes have to reach the scroll view.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) => {
        trackDrift(gesture.dx, gesture.dy);
        return armed.current;
      },
      onMoveShouldSetPanResponderCapture: (_event, gesture) => {
        trackDrift(gesture.dx, gesture.dy);
        return armed.current;
      },
      onPanResponderGrant: () => {
        notifyGesture(true);
        translateX.setValue(0);
        translateY.setValue(0);
      },
      onPanResponderMove: (_event, gesture) => {
        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const values = latest.current;

        clearHold();
        notifyGesture(false);
        translateX.setValue(0);
        translateY.setValue(0);

        values.onDragEnd(
          dragDeltaToCells(
            { dx: gesture.dx, dy: gesture.dy },
            {
              cellWidth: values.cellWidth,
              rowHeight: values.metrics.rowHeight,
              gap: values.metrics.gap,
              columns: values.config.columns,
              placement: values.item.placement,
            },
          ),
        );
      },
      onPanResponderTerminate: () => {
        clearHold();
        notifyGesture(false);
        translateX.setValue(0);
        translateY.setValue(0);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [clearHold, editing, notifyGesture, trackDrift, translateX, translateY]);

  const resizeResponder = useMemo(() => {
    if (!editing) {
      return null;
    }

    return PanResponder.create({
      // The corner is a dedicated target, so it can claim on contact.
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        notifyGesture(true);
        moved.current = 0;
      },
      onPanResponderMove: (_event, gesture) => {
        width.setValue(
          Math.max(MIN_PREVIEW_SIZE, baseSize.current.width + gesture.dx),
        );
        height.setValue(
          Math.max(MIN_PREVIEW_SIZE, baseSize.current.height + gesture.dy),
        );
      },
      onPanResponderRelease: (_event, gesture) => {
        const values = latest.current;

        notifyGesture(false);
        width.setValue(Math.max(0, values.rect.width));
        height.setValue(Math.max(0, values.rect.height));

        values.onResizeEnd(
          resizeDeltaToSpans(
            { dx: gesture.dx, dy: gesture.dy },
            {
              cellWidth: values.cellWidth,
              rowHeight: values.metrics.rowHeight,
              gap: values.metrics.gap,
              columns: values.config.columns,
              placement: values.item.placement,
              config: values.config,
            },
          ),
        );
      },
      onPanResponderTerminate: () => {
        const values = latest.current;

        notifyGesture(false);
        width.setValue(Math.max(0, values.rect.width));
        height.setValue(Math.max(0, values.rect.height));
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [editing, height, notifyGesture, width]);

  const holdHandlers = useMemo(() => {
    if (!editing) {
      return undefined;
    }

    return {
      onTouchStart: startHold,
      onTouchEnd: clearHold,
      onTouchCancel: clearHold,
    };
  }, [clearHold, editing, startHold]);

  const dragHandlers = useMemo(() => {
    if (dragResponder === null) {
      return undefined;
    }

    return { ...holdHandlers, ...dragResponder.panHandlers };
  }, [dragResponder, holdHandlers]);

  return (
    <ModuleCard
      item={item}
      theme={theme}
      editing={editing}
      rect={rect}
      onHide={onHide}
      dragHandlers={dragHandlers}
      resizeHandlers={resizeResponder?.panHandlers}
      animated={{ translateX, translateY, width, height }}
    >
      {children}
    </ModuleCard>
  );
}
