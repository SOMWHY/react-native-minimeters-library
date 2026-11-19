import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationTheme } from '../theme/types';
import type { DashboardItem } from './types';

export interface ModuleTrayProps {
  readonly hidden: readonly DashboardItem[];
  readonly theme: VisualizationTheme;
  readonly onRestore: (id: string) => void;
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
 * Hidden modules, ready to be brought back.
 *
 * Renders nothing when everything is visible, so a host can mount it
 * unconditionally: an empty edit bar is visual noise. Restoring goes through
 * `setVisibility`, which places the module in a free slot and compacts — the tray
 * never decides positions itself.
 */
export function ModuleTray({ hidden, theme, onRestore }: ModuleTrayProps) {
  if (hidden.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.tray, { borderTopColor: theme.colors.grid }]}
      accessibilityLabel="Hidden modules"
    >
      <Text style={[styles.title, { color: theme.colors.textMuted }]}>
        HIDDEN
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {hidden.map((item) => {
          const label = item.label ?? DEFAULT_LABEL[item.kind];

          return (
            <Pressable
              key={item.id}
              onPress={() => onRestore(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${label}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: theme.colors.grid,
                  backgroundColor: pressed ? theme.colors.accent : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: theme.colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderTopWidth: STRUCTURAL_TOKENS.strokeWidth.hairline,
    paddingVertical: STRUCTURAL_TOKENS.spacing.sm,
    paddingHorizontal: STRUCTURAL_TOKENS.spacing.sm,
  },
  title: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
    letterSpacing: 0.5,
    marginBottom: STRUCTURAL_TOKENS.spacing.xs,
  },
  list: {
    gap: STRUCTURAL_TOKENS.spacing.xs,
    paddingRight: STRUCTURAL_TOKENS.spacing.sm,
  },
  chip: {
    borderWidth: STRUCTURAL_TOKENS.strokeWidth.fine,
    borderRadius: STRUCTURAL_TOKENS.radii.sm,
    paddingHorizontal: STRUCTURAL_TOKENS.spacing.sm,
    paddingVertical: STRUCTURAL_TOKENS.spacing.xs,
  },
  chipLabel: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.label,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
  },
});
