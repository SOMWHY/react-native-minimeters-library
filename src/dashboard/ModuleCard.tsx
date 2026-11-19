import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import { cardAffordances } from './affordances';
import type { CellRect, DashboardItem } from './types';

export interface ModuleCardProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly editing: boolean;
  readonly rect: CellRect;
  readonly onDragStart?: () => void;
  readonly onDragMove?: (dx: number, dy: number) => void;
  readonly onDragEnd?: (dx: number, dy: number) => void;
  readonly onResizeMove?: (dCols: number, dRows: number) => void;
  readonly onResizeEnd?: (dCols: number, dRows: number) => void;
  readonly onHide?: () => void;
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

/**
 * Card shell: label, module body, and — only while editing — the grab bar and
 * resize corner.
 *
 * Outside edit mode the handlers are not rendered at all rather than merely
 * switched off: an inert view still steals touches from the module underneath.
 */
export function ModuleCard({
  item,
  theme,
  editing,
  rect,
  children,
}: ModuleCardProps) {
  const affordances = cardAffordances(editing);
  const label = item.label ?? DEFAULT_LABEL[item.kind];

  return (
    <View
      style={[
        styles.card,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.header} pointerEvents="none">
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      </View>

      <View style={styles.body}>{children}</View>

      {affordances.draggable ? (
        <View
          style={[styles.grabBar, { borderColor: theme.colors.grid }]}
          accessibilityRole="button"
          accessibilityLabel={`Move ${label}`}
          accessibilityHint="Drag to change this module's grid position"
        />
      ) : null}

      {affordances.resizable ? (
        <View
          style={[styles.resizeHandle, { backgroundColor: theme.colors.accent }]}
          accessibilityRole="adjustable"
          accessibilityLabel={`Resize ${label}`}
          accessibilityHint="Drag to change this module's grid size"
        />
      ) : null}
    </View>
  );
}

const HANDLE = STRUCTURAL_TOKENS.spacing.md;

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
    right: STRUCTURAL_TOKENS.spacing.sm,
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
  grabBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HANDLE,
    borderBottomWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    opacity: 0.6,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: HANDLE,
    height: HANDLE,
    borderTopLeftRadius: STRUCTURAL_TOKENS.radii.sm,
    opacity: 0.5,
  },
});
