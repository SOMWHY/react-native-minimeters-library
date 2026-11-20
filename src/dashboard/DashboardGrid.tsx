import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { VisualizationTheme } from '../theme/types';
import { DraggableCard } from './DraggableCard';
import { gridHeight, layoutRects } from './geometry';
import { moveItem, resizeItem, setVisibility } from './layout';
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
  /**
   * Render the module body for an item; the host owns data injection.
   *
   * The resolved cell rect is handed back so the host can size the module to the
   * card it lives in without re-deriving the grid geometry itself.
   */
  readonly renderModule: (item: DashboardItem, rect: CellRect) => ReactNode;
  readonly onLayoutChange: (layout: DashboardLayout) => void;
  /** Test hook for hosts and their integration tests; forwarded to the container. */
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
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
  editing = false,
  renderModule,
  onLayoutChange,
  testID,
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

  const handleDragEnd = useCallback(
    (id: string, target: { readonly col: number; readonly row: number }) => {
      onLayoutChange({ items: moveItem(layout.items, id, target, config) });
    },
    [config, layout.items, onLayoutChange],
  );

  const handleHide = useCallback(
    (id: string) => {
      onLayoutChange({ items: setVisibility(layout.items, id, false, config) });
    },
    [config, layout.items, onLayoutChange],
  );

  const handleResizeEnd = useCallback(
    (id: string, target: { readonly colSpan: number; readonly rowSpan: number }) => {
      onLayoutChange({ items: resizeItem(layout.items, id, target, config) });
    },
    [config, layout.items, onLayoutChange],
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
      testID={testID}
      onLayout={handleLayout}
      style={[styles.container, { height }, style]}
    >
      {width === 0
        ? null
        : placed.map(({ item, rect }) => (
            <DraggableCard
              key={item.id}
              item={item}
              theme={theme}
              editing={editing}
              rect={rect}
              cellWidth={cellWidth}
              metrics={metrics}
              config={config}
              onDragEnd={(target) => handleDragEnd(item.id, target)}
              onResizeEnd={(target) => handleResizeEnd(item.id, target)}
              onHide={() => handleHide(item.id)}
            >
              {renderModule(item, rect)}
            </DraggableCard>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
