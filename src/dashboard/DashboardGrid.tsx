import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import { gridHeight, layoutRects } from './geometry';
import type {
  CellRect,
  DashboardItem,
  DashboardLayout,
  GridConfig,
  GridMetrics,
} from './types';

export interface DashboardGridProps {
  readonly layout: DashboardLayout;
  readonly theme: VisualizationTheme;
  readonly config: GridConfig;
  readonly metrics: GridMetrics;
  readonly editing?: boolean;
  /** Render the module body for an item; the host owns data injection. */
  readonly renderModule: (item: DashboardItem) => ReactNode;
  readonly onLayoutChange: (layout: DashboardLayout) => void;
  readonly style?: StyleProp<ViewStyle>;
}

interface CardShellProps {
  readonly item: DashboardItem;
  readonly theme: VisualizationTheme;
  readonly rect: CellRect;
  readonly children: ReactNode;
}

/**
 * Positioned card placeholder.
 *
 * The interactive shell (label, handles, hide action) arrives with `ModuleCard`;
 * this only proves the cell-to-pixel mapping on device, so the geometry can be
 * verified before gestures exist.
 */
function CardShell({ item, theme, rect, children }: CardShellProps) {
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
      <View style={styles.body}>{children}</View>
      {item.label === undefined ? null : (
        <View style={styles.labelRow} pointerEvents="none">
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>
            {item.label}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Dashboard container.
 *
 * It measures itself once, converts cells to points through `layoutRects`, and
 * hosts one absolutely positioned card per visible item. It never inspects
 * module data: `renderModule` is the only coupling to the visualization phase.
 */
export function DashboardGrid({
  layout,
  theme,
  config,
  metrics,
  renderModule,
  style,
}: DashboardGridProps) {
  const [width, setWidth] = useState(0);

  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const next = event.nativeEvent.layout.width;

      setWidth((current) => (current === next ? current : next));
    },
    [],
  );

  // Column width is the only value that needs measurement; everything else comes
  // from the metrics the host supplied.
  const cellWidth = Math.max(
    0,
    (width - metrics.padding * 2 - metrics.gap * (config.columns - 1)) /
      config.columns,
  );

  const placed = layoutRects(layout.items, metrics, cellWidth);
  const height = gridHeight(layout.items, metrics);

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, { height }, style]}
    >
      {width === 0
        ? null
        : placed.map(({ item, rect }) => (
            <CardShell
              key={item.id}
              item={item}
              theme={theme}
              rect={rect}
            >
              {renderModule(item)}
            </CardShell>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: STRUCTURAL_TOKENS.radii.md,
  },
  body: {
    flex: 1,
  },
  labelRow: {
    position: 'absolute',
    top: STRUCTURAL_TOKENS.spacing.xs,
    left: STRUCTURAL_TOKENS.spacing.sm,
  },
  label: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
