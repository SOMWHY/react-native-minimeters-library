import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { VisualizationCanvas } from '../drawing/VisualizationCanvas';
import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import type { ModuleStatus } from './types';

export interface ModuleSurfaceProps {
  readonly theme: VisualizationTheme;
  readonly status: ModuleStatus;
  /** Fixed surface height in dp. */
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Optional caption rendered in the top-left corner. */
  readonly label?: string;
  /** Optional module readout (numbers, meter legends) rendered above the plot. */
  readonly overlay?: ReactNode;
  /** Skia content drawn inside the shared canvas; only rendered when ready. */
  readonly children?: ReactNode;
}

const PLACEHOLDER_TEXT: Record<Exclude<ModuleStatus, 'ready'>, string> = {
  waiting: 'WAITING FOR DATA',
  invalid: 'INVALID DATA',
};

const DEFAULT_HEIGHT = 160;

/**
 * Shared shell for every visualization module.
 *
 * It owns the measured host view, the single Skia canvas, and the React Native
 * text layer used for captions, readouts, and state placeholders. Text stays in
 * React Native so the library never has to bundle a Skia font asset; only data
 * drawing goes through `VisualizationCanvas`.
 */
export function ModuleSurface({
  theme,
  status,
  height = DEFAULT_HEIGHT,
  style,
  label,
  overlay,
  children,
}: ModuleSurfaceProps) {
  const placeholder = status === 'ready' ? null : PLACEHOLDER_TEXT[status];

  return (
    <View style={[styles.host, { height }, style]}>
      <VisualizationCanvas theme={theme}>
        {status === 'ready' ? children : null}
      </VisualizationCanvas>
      <View style={styles.overlay} pointerEvents="none">
        {label === undefined ? null : (
          <Text style={[styles.caption, { color: theme.colors.textMuted }]}>
            {label}
          </Text>
        )}
        {placeholder === null ? null : (
          <View style={styles.centered}>
            <Text style={[styles.placeholder, { color: theme.colors.textMuted }]}>
              {placeholder}
            </Text>
          </View>
        )}
        {overlay}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: 'hidden',
    borderRadius: STRUCTURAL_TOKENS.radii.md,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: STRUCTURAL_TOKENS.spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.label,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
  },
  placeholder: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
  },
});
