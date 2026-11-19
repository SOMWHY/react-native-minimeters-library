import { useEffect, useMemo } from 'react';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationColors, VisualizationTheme } from '../theme/types';
import {
  interpolateColor,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from './reanimated';
import type { AnimatedVisualizationColors } from './types';

/**
 * Derives one animated color role per theme color role.
 *
 * Theme changes animate colors only: the progress value moves from the previous
 * palette to the target palette over `STRUCTURAL_TOKENS.motion.themeTransitionMs`
 * and every role is interpolated on the UI thread. No structural token is
 * animated or mutated.
 */
export function useAnimatedThemeColors(
  theme: VisualizationTheme,
): AnimatedVisualizationColors {
  const previousColors = useSharedValue<VisualizationColors>(theme.colors);
  const targetColors = useSharedValue<VisualizationColors>(theme.colors);
  const progress = useSharedValue(1);

  const canvas = useSharedValue(theme.colors.canvas);
  const surface = useSharedValue(theme.colors.surface);
  const grid = useSharedValue(theme.colors.grid);
  const axis = useSharedValue(theme.colors.axis);
  const text = useSharedValue(theme.colors.text);
  const textMuted = useSharedValue(theme.colors.textMuted);
  const accent = useSharedValue(theme.colors.accent);
  const primary = useSharedValue(theme.colors.traces.primary);
  const secondary = useSharedValue(theme.colors.traces.secondary);
  const left = useSharedValue(theme.colors.traces.left);
  const right = useSharedValue(theme.colors.traces.right);
  const low = useSharedValue(theme.colors.traces.low);
  const mid = useSharedValue(theme.colors.traces.mid);
  const high = useSharedValue(theme.colors.traces.high);

  useAnimatedReaction(
    () => progress.value,
    (value: number) => {
      'worklet';

      const previous = previousColors.value;
      const target = targetColors.value;
      const mix = (from: string, to: string): string =>
        interpolateColor(value, [0, 1], [from, to]);

      canvas.value = mix(previous.canvas, target.canvas);
      surface.value = mix(previous.surface, target.surface);
      grid.value = mix(previous.grid, target.grid);
      axis.value = mix(previous.axis, target.axis);
      text.value = mix(previous.text, target.text);
      textMuted.value = mix(previous.textMuted, target.textMuted);
      accent.value = mix(previous.accent, target.accent);
      primary.value = mix(previous.traces.primary, target.traces.primary);
      secondary.value = mix(previous.traces.secondary, target.traces.secondary);
      left.value = mix(previous.traces.left, target.traces.left);
      right.value = mix(previous.traces.right, target.traces.right);
      low.value = mix(previous.traces.low, target.traces.low);
      mid.value = mix(previous.traces.mid, target.traces.mid);
      high.value = mix(previous.traces.high, target.traces.high);
    },
  );

  useEffect(() => {
    if (targetColors.value === theme.colors) {
      return;
    }

    previousColors.value = targetColors.value;
    targetColors.value = theme.colors;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: STRUCTURAL_TOKENS.motion.themeTransitionMs,
    });
  }, [previousColors, progress, targetColors, theme.colors]);

  return useMemo(
    () => ({
      canvas,
      surface,
      grid,
      axis,
      text,
      textMuted,
      accent,
      traces: {
        primary,
        secondary,
        left,
        right,
        low,
        mid,
        high,
      },
    }),
    [
      accent,
      axis,
      canvas,
      grid,
      high,
      left,
      low,
      mid,
      primary,
      right,
      secondary,
      surface,
      text,
      textMuted,
    ],
  );
}
