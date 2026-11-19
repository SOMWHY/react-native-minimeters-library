import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia';
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import { isCanvasReady } from './canvas-size';
import { DrawingContext } from './DrawingContext';
import { mapLinear, type NumericRange } from './coordinates';
import type { DrawingContextValue } from './types';
import { useAnimatedThemeColors } from './useAnimatedThemeColors';

export interface VisualizationCanvasProps {
  theme: VisualizationTheme;
  showGrid?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * The only component that creates a Skia `Canvas`.
 *
 * It measures its host `View`, paints the shared background and grid, and
 * exposes a `DrawingContextValue` (measured bounds, animated theme colors,
 * structural tokens, and coordinate mappers) to every module drawn inside it.
 * A zero-sized or non-finite measurement renders nothing and never throws.
 */
export function VisualizationCanvas({
  theme,
  showGrid = true,
  style,
  children,
}: VisualizationCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const colors = useAnimatedThemeColors(theme);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: measuredWidth, height: measuredHeight } =
      event.nativeEvent.layout;
    setSize({ width: measuredWidth, height: measuredHeight });
  }, []);

  const mapX = useCallback(
    (value: number, domain: NumericRange) => mapLinear(value, domain, [0, width]),
    [width],
  );
  const mapY = useCallback(
    (value: number, domain: NumericRange) =>
      mapLinear(value, domain, [height, 0]),
    [height],
  );

  const context = useMemo<DrawingContextValue>(
    () => ({
      width,
      height,
      theme,
      colors,
      tokens: STRUCTURAL_TOKENS,
      mapX,
      mapY,
    }),
    [colors, height, mapX, mapY, theme, width],
  );

  const gridLines = useMemo(() => {
    if (!showGrid || !isCanvasReady(width, height)) {
      return [];
    }

    const { subdivisions } = STRUCTURAL_TOKENS.grid;
    const { hairline } = STRUCTURAL_TOKENS.strokeWidth;
    const lines: { key: string; p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];

    for (let index = 1; index < subdivisions; index += 1) {
      const position = index / subdivisions;

      lines.push({
        key: `vertical-${index}`,
        p1: { x: width * position, y: 0 },
        p2: { x: width * position, y: height },
      });
      lines.push({
        key: `horizontal-${index}`,
        p1: { x: 0, y: height * position },
        p2: { x: width, y: height * position },
      });
    }

    return lines.map((line) => ({ ...line, strokeWidth: hairline }));
  }, [height, showGrid, width]);

  return (
    <View style={style} onLayout={handleLayout}>
      {isCanvasReady(width, height) ? (
        <DrawingContext.Provider value={context}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              color={colors.canvas}
            />
            {gridLines.map((line) => (
              <Line
                key={line.key}
                p1={vec(line.p1.x, line.p1.y)}
                p2={vec(line.p2.x, line.p2.y)}
                color={colors.grid}
                strokeWidth={line.strokeWidth}
              />
            ))}
            {children}
          </Canvas>
        </DrawingContext.Provider>
      ) : null}
    </View>
  );
}
