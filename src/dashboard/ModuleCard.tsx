import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderHandlers, ViewProps } from 'react-native';
import type { ReactNode } from 'react';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import { cardAffordances } from './affordances';
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
  /** Pan responders for the resize corner. */
  readonly resizeHandlers?: GestureResponderHandlers;
  /**
   * Transient mid-gesture values. When omitted the card renders its committed
   * geometry, which is what static hosts and stories want.
   */
  readonly animated?: ModuleCardAnimation;
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

/** Resize corner: 32 dp plus 8 dp of slop clears the 48 dp touch-target floor. */
const RESIZE_HANDLE = 32;
const RESIZE_HIT_SLOP = 8;

/** HIDE is text; the slop takes its 24 dp pill up to a 44 dp target. */
const HIDE_HIT_SLOP = 10;

/**
 * Card shell: the module's only title, its body, and — only while editing — the
 * whole-card drag surface plus the resize corner.
 *
 * The title lives here and nowhere else: modules render no caption of their own,
 * so a card never shows the same label twice.
 *
 * Outside edit mode the handlers are not rendered at all rather than merely
 * switched off: an inert view still steals touches from the module underneath.
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
  children,
}: ModuleCardProps) {
  const affordances = cardAffordances(editing);
  const label = item.label ?? DEFAULT_LABEL[item.kind];

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

      {affordances.hideable && onHide !== undefined ? (
        <Pressable
          onPress={onHide}
          style={styles.hideButton}
          hitSlop={HIDE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Hide ${label}`}
        >
          <Text style={[styles.hideLabel, { color: theme.colors.textMuted }]}>
            HIDE
          </Text>
        </Pressable>
      ) : null}

      {affordances.resizable ? (
        <View
          style={[styles.resizeHandle, { borderColor: theme.colors.accent }]}
          hitSlop={RESIZE_HIT_SLOP}
          accessibilityRole="adjustable"
          accessibilityLabel={`Resize ${label}`}
          accessibilityHint="Drag to change this module’s grid size"
          {...resizeHandlers}
        />
      ) : null}
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
    right: 0,
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
   * here" without covering the plot the way a solid square did.
   */
  resizeHandle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: RESIZE_HANDLE,
    height: RESIZE_HANDLE,
    borderTopWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderLeftWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    borderTopLeftRadius: STRUCTURAL_TOKENS.radii.md,
    opacity: 0.8,
  },
});
