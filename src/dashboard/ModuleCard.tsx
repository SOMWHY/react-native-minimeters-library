import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderHandlers, ViewProps } from 'react-native';
import type { ReactNode } from 'react';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import { cardAffordances } from './affordances';
import { cornerZoneSize } from './gestures';
import type { ResizeCorner } from './gestures';
import type { CellRect, DashboardItem } from './types';

/** Animated feedback values owned by `DraggableCard`. */
export interface ModuleCardAnimation {
  readonly translateX: Animated.Value;
  readonly translateY: Animated.Value;
  readonly width: Animated.Value;
  readonly height: Animated.Value;
}

/** Pan handlers merged with the raw touch hooks used to detect the hold. */
export type ModuleCardDragHandlers = GestureResponderHandlers &
  Pick<ViewProps, 'onTouchStart' | 'onTouchEnd' | 'onTouchCancel'>;

export interface ModuleCardProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly editing: boolean;
  readonly rect: CellRect;
  readonly onHide?: () => void;
  /** Drag responders owned by the grid, spread across the whole card. */
  readonly dragHandlers?: ModuleCardDragHandlers;
  /** One set of pan responders per corner; corners without one are inert. */
  readonly resizeHandlers?: Partial<Record<ResizeCorner, GestureResponderHandlers>>;
  /**
   * Transient mid-gesture values. When omitted the card renders its committed
   * geometry, which is what static hosts and stories want.
   */
  readonly animated?: ModuleCardAnimation;
  /** True while this card is being dragged or resized. */
  readonly active?: boolean;
  /** 0 → 1 highlight ramp, driven natively by `DraggableCard`. */
  readonly glow?: Animated.Value;
  readonly children: ReactNode;
}

const DEFAULT_LABEL: Record<DashboardItem['kind'], string> = {
  waveform: 'WAVEFORM',
  oscilloscope: 'OSCILLOSCOPE',
  vectorscope: 'VECTORSCOPE',
  spectrum: 'SPECTRUM',
  vu: 'VU',
  loudness: 'LOUDNESS',
  spectrogram: 'SPECTROGRAM',
};

/** Outward-only slop: an inner slop would overlap the opposite corner's zone. */
const CORNER_HIT_SLOP = 8;

/** HIDE is text; the slop takes its 24 dp pill up to a 44 dp target. */
const HIDE_HIT_SLOP = 10;

const CORNERS: readonly ResizeCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

const CORNER_SLOP: Record<ResizeCorner, ViewProps['hitSlop']> = {
  'top-left': { top: CORNER_HIT_SLOP, left: CORNER_HIT_SLOP, right: CORNER_HIT_SLOP },
  'top-right': { top: CORNER_HIT_SLOP, right: CORNER_HIT_SLOP, left: CORNER_HIT_SLOP },
  'bottom-left': {
    bottom: CORNER_HIT_SLOP,
    left: CORNER_HIT_SLOP,
    right: CORNER_HIT_SLOP,
  },
  'bottom-right': {
    bottom: CORNER_HIT_SLOP,
    right: CORNER_HIT_SLOP,
    left: CORNER_HIT_SLOP,
  },
};

const CORNER_LABEL: Record<ResizeCorner, string> = {
  'top-left': 'top-left corner',
  'top-right': 'top-right corner',
  'bottom-left': 'bottom-left corner',
  'bottom-right': 'bottom-right corner',
};

/** Which hairlines the bracket draws: the two edges facing into the card. */
const CORNER_STYLE: Record<ResizeCorner, object> = {
  'top-left': {
    left: 0,
    top: 0,
    borderRightWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderBottomWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderBottomRightRadius: STRUCTURAL_TOKENS.radii.md,
  },
  'top-right': {
    right: 0,
    top: 0,
    borderLeftWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderBottomWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderBottomLeftRadius: STRUCTURAL_TOKENS.radii.md,
  },
  'bottom-left': {
    left: 0,
    bottom: 0,
    borderRightWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderTopWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderTopRightRadius: STRUCTURAL_TOKENS.radii.md,
  },
  'bottom-right': {
    right: 0,
    bottom: 0,
    borderLeftWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderTopWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderTopLeftRadius: STRUCTURAL_TOKENS.radii.md,
  },
};

/**
 * Card shell: the module's only title, its body, and — only while editing — the
 * whole-card drag surface plus four corner resize handles.
 *
 * The title lives here and nowhere else: modules render no caption of their own,
 * so a card never shows the same label twice.
 *
 * Outside edit mode the handlers are not rendered at all rather than merely
 * switched off: an inert view still steals touches from the module underneath.
 *
 * The active highlight is an opacity ramp on a white overlay plus a static ring,
 * never a `backgroundColor` interpolation — only opacity can run on the native
 * driver, and a JS-driven color animation would stutter exactly when the user is
 * dragging.
 */
export function ModuleCard({
  item,
  theme,
  editing,
  rect,
  onHide,
  dragHandlers,
  resizeHandlers,
  animated,
  active = false,
  glow,
  children,
}: ModuleCardProps) {
  const affordances = cardAffordances(editing);
  const label = item.label ?? DEFAULT_LABEL[item.kind];
  const zone = cornerZoneSize(rect.width, rect.height);
  const handleWidth = Math.max(1, Math.round(zone.width));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          left: rect.x,
          top: rect.y,
          width: animated?.width ?? Math.max(0, rect.width),
          height: animated?.height ?? Math.max(0, rect.height),
          backgroundColor: theme.colors.surface,
          borderColor: active ? theme.colors.accent : 'transparent',
          borderWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
          zIndex: active ? STRUCTURAL_TOKENS.hierarchy.raised : 0,          elevation: active ? 8 : 0,
          transform:
            animated === undefined
              ? undefined
              : [
                  { translateX: animated.translateX },
                  { translateY: animated.translateY },
                ],
        },
      ]}
      accessibilityRole={affordances.draggable ? 'button' : undefined}
      accessibilityLabel={affordances.draggable ? `Move ${label}` : undefined}
      accessibilityHint={
        affordances.draggable
          ? 'Press and hold, then drag to change this module’s grid position'
          : undefined
      }
      {...dragHandlers}
    >
      <View style={styles.header} pointerEvents="none">
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      </View>

      <View style={styles.body}>{children}</View>

      {glow === undefined ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.text,
              opacity: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.18],
              }),
            },
          ]}
        />
      )}

      {affordances.hideable && onHide !== undefined ? (
        <Pressable
          onPress={onHide}
          style={[styles.hideButton, { right: handleWidth }]}
          hitSlop={HIDE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Hide ${label}`}
        >
          <Text style={[styles.hideLabel, { color: theme.colors.textMuted }]}>
            HIDE
          </Text>
        </Pressable>
      ) : null}

      {affordances.resizable
        ? CORNERS.map((corner) => (
            <View
              key={corner}
              style={[
                styles.resizeHandle,
                CORNER_STYLE[corner],
                {
                  width: zone.width,
                  height: zone.height,
                  borderColor: theme.colors.accent,
                },
              ]}
              hitSlop={CORNER_SLOP[corner]}
              accessibilityRole="adjustable"
              accessibilityLabel={`Resize ${label} from the ${CORNER_LABEL[corner]}`}
              accessibilityHint="Drag to change this module’s grid size"
              {...resizeHandlers?.[corner]}
            />
          ))
        : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: STRUCTURAL_TOKENS.radii.md,
  },
  header: {
    position: 'absolute',
    top: STRUCTURAL_TOKENS.spacing.xs,
    left: STRUCTURAL_TOKENS.spacing.sm,
    right: STRUCTURAL_TOKENS.spacing.lg,
    zIndex: STRUCTURAL_TOKENS.hierarchy.overlay,
  },
  label: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  hideButton: {
    position: 'absolute',
    top: 0,
    height: 24,
    paddingHorizontal: STRUCTURAL_TOKENS.spacing.sm,
    justifyContent: 'center',
    zIndex: STRUCTURAL_TOKENS.hierarchy.overlay,
  },
  hideLabel: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  /**
   * Two hairlines instead of a filled block: a corner bracket reads as "pull
   * here" without covering the plot the way a solid square did. Size comes from
   * `cornerZoneSize`, so top and bottom brackets never overlap on a short card.
   */
  resizeHandle: {
    position: 'absolute',
    opacity: 0.8,
  },
});
