import { Animated, PanResponder } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { DRAG_HOLD_MS, shouldArmDrag, shouldCancelArm } from './drag-arm';
import { ModuleCard } from './ModuleCard';
import { dragDeltaToCells, resizeCornerToPlacement } from './gestures';
import type { CellTarget, ResizeCorner } from './gestures';
import type {
  CellRect,
  DashboardItem,
  GridConfig,
  GridMetrics,
  GridPlacement,
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
  /** Called once, on release, with the placement the card should settle into. */
  readonly onResizeEnd: (target: GridPlacement) => void;
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

/** Highlight ramp: short enough to feel instant, long enough to read as motion. */
const GLOW_DURATION_MS = 120;

const CORNERS: readonly ResizeCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

function isLeadingCorner(corner: ResizeCorner): boolean {
  return corner === 'top-left' || corner === 'bottom-left';
}

function isTopCorner(corner: ResizeCorner): boolean {
  return corner === 'top-left' || corner === 'top-right';
}

interface LatestValues {
  readonly cellWidth: number;
  readonly config: GridConfig;
  readonly metrics: GridMetrics;
  readonly item: DashboardItem;
  readonly rect: CellRect;
  readonly onDragEnd: (target: CellTarget) => void;
  readonly onResizeEnd: (target: GridPlacement) => void;
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
 * All four corners resize. A corner that holds the left or top edge moves the
 * card's origin as well as its size, so the preview translates while it grows and
 * the opposite corner stays nailed under the finger.
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
  const glow = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

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

  const notifyGesture = useCallback((inFlight: boolean) => {
    latest.current.onGestureStateChange?.(inFlight);
  }, []);

  /**
   * Light the card up on gesture start and fade it back on release.
   *
   * The ring is a plain state flip (one render, on grant) and the brightness is a
   * native-driver opacity ramp: interpolating `backgroundColor` instead would drag
   * the whole animation onto the JS thread, which is the thread already busy
   * decoding PCM.
   */
  const highlight = useCallback(
    (on: boolean) => {
      if (on) {
        setActive(true);
        Animated.timing(glow, {
          toValue: 1,
          duration: GLOW_DURATION_MS,
          useNativeDriver: true,
        }).start();
        return;
      }

      Animated.timing(glow, {
        toValue: 0,
        duration: GLOW_DURATION_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setActive(false);
        }
      });
    },
    [glow],
  );

  const resetPreview = useCallback(() => {
    const values = latest.current;

    translateX.setValue(0);
    translateY.setValue(0);
    width.setValue(Math.max(0, values.rect.width));
    height.setValue(Math.max(0, values.rect.height));
  }, [height, translateX, translateY, width]);

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
        highlight(true);
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
        highlight(false);
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
        highlight(false);
        translateX.setValue(0);
        translateY.setValue(0);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [
    clearHold,
    editing,
    highlight,
    notifyGesture,
    trackDrift,
    translateX,
    translateY,
  ]);

  const resizeResponders = useMemo(() => {
    if (!editing) {
      return null;
    }

    const previewFor = (corner: ResizeCorner, dx: number, dy: number) => {
      const base = baseSize.current;
      const left = isLeadingCorner(corner);
      const top = isTopCorner(corner);

      // A leading edge may only move inwards until the card hits the minimum
      // size; outwards there is no pixel limit — the cell snap does the clamping.
      const offsetX = left
        ? Math.min(dx, Math.max(0, base.width - MIN_PREVIEW_SIZE))
        : 0;
      const offsetY = top
        ? Math.min(dy, Math.max(0, base.height - MIN_PREVIEW_SIZE))
        : 0;

      translateX.setValue(offsetX);
      translateY.setValue(offsetY);
      width.setValue(
        Math.max(
          MIN_PREVIEW_SIZE,
          base.width + (left ? -offsetX : dx),
        ),
      );
      height.setValue(
        Math.max(
          MIN_PREVIEW_SIZE,
          base.height + (top ? -offsetY : dy),
        ),
      );
    };

    const responders: Partial<
      Record<ResizeCorner, ReturnType<typeof PanResponder.create>>
    > = {};

    for (const corner of CORNERS) {
      responders[corner] = PanResponder.create({
        // The corner is a dedicated target, so it can claim on contact.
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          notifyGesture(true);
          highlight(true);
          moved.current = 0;
        },
        onPanResponderMove: (_event, gesture) => {
          previewFor(corner, gesture.dx, gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          const values = latest.current;

          notifyGesture(false);
          highlight(false);
          resetPreview();

          values.onResizeEnd(
            resizeCornerToPlacement(
              corner,
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
          notifyGesture(false);
          highlight(false);
          resetPreview();
        },
        onPanResponderTerminationRequest: () => false,
      });
    }

    return responders;
  }, [
    editing,
    height,
    highlight,
    notifyGesture,
    resetPreview,
    translateX,
    translateY,
    width,
  ]);

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

  const resizeHandlers = useMemo(() => {
    if (resizeResponders === null) {
      return undefined;
    }

    const handlers: Partial<
      Record<ResizeCorner, ReturnType<typeof PanResponder.create>['panHandlers']>
    > = {};

    for (const corner of CORNERS) {
      handlers[corner] = resizeResponders[corner]?.panHandlers;
    }

    return handlers;
  }, [resizeResponders]);

  return (
    <ModuleCard
      item={item}
      theme={theme}
      editing={editing}
      rect={rect}
      onHide={onHide}
      dragHandlers={dragHandlers}
      resizeHandlers={resizeHandlers}
      animated={{ translateX, translateY, width, height }}
      active={active}
      glow={glow}
    >
      {children}
    </ModuleCard>
  );
}
