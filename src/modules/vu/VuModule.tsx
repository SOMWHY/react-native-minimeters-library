import {
  LinearGradient,
  Line,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDrawingContext } from '../../drawing';
import { useDerivedValue } from '../../drawing/reanimated';
import { STRUCTURAL_TOKENS } from '../../theme/structural-tokens';
import { clampUnit } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps } from '../types';
import { resolveVuState, type VuLevels } from './state';


export interface VuModuleProps extends ModuleBaseProps {
  /** Normalized `0..1` levels; absence renders the `waiting` state. */
  readonly data?: VuLevels | null;
  /**
   * Optional numeric readout pinned to the top-right corner, e.g. `-14.2 LUFS`.
   * The desktop app puts the loudness figure inside the meter, and reading the
   * number where the bars are is what makes the meter actionable.
   */
  readonly readout?: string | null;
}

interface VuBarsProps {
  readonly data: VuLevels;
}

function useMeterGradient() {
  const { colors } = useDrawingContext();

  return useDerivedValue(() => [
    colors.traces.low.value,
    colors.traces.mid.value,
    colors.traces.high.value,
  ]);
}

/** Two vertical bars over a surface track, with optional peak ticks. */
function VuBars({ data }: VuBarsProps) {
  const { colors, height, tokens, width } = useDrawingContext();
  const gradientColors = useMeterGradient();

  const inset = tokens.spacing.sm;
  const gap = tokens.spacing.md;
  const barWidth = Math.max(0, (width - inset * 2 - gap) / 2);
  const channels = [
    { key: 'left', level: data.left, peak: data.leftPeak, x: inset },
    {
      key: 'right',
      level: data.right,
      peak: data.rightPeak,
      x: inset + barWidth + gap,
    },
  ];

  return (
    <>
      {channels.map((channel) => {
        const filled = clampUnit(channel.level) * height;
        const peakY = height - clampUnit(channel.peak ?? 0) * height;

        return (
          <Fragment key={channel.key}>
            <Rect
              x={channel.x}
              y={0}
              width={barWidth}
              height={height}
              color={colors.surface}
            />
            <Rect
              x={channel.x}
              y={height - filled}
              width={barWidth}
              height={filled}
            >
              <LinearGradient
                start={vec(0, height)}
                end={vec(0, 0)}
                colors={gradientColors}
              />
            </Rect>
            {channel.peak === undefined ? null : (
              <Line
                p1={vec(channel.x, peakY)}
                p2={vec(channel.x + barWidth, peakY)}
                color={colors.text}
                strokeWidth={tokens.strokeWidth.regular}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function VuLabels({ color }: { color: string }) {
  return (
    <View style={styles.labels}>
      <Text style={[styles.label, { color }]}>L</Text>
      <Text style={[styles.label, { color }]}>R</Text>
    </View>
  );
}

/** Peak/RMS VU meter module. */
export function VuModule({
  theme,
  height,
  label,
  style,
  data,
  readout,
}: VuModuleProps) {
  const status = resolveVuState(data);
  const hasReadout = typeof readout === 'string' && readout.length > 0;

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
      overlay={
        status === 'ready' ? (
          <View style={styles.overlay} pointerEvents="none">
            <VuLabels color={theme.colors.textMuted} />
            {hasReadout ? (
              <View
                style={[
                  styles.readout,
                  { backgroundColor: theme.colors.canvas },
                ]}
              >
                <Text
                  style={[styles.readoutLabel, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {readout}
                </Text>
              </View>
            ) : null}
          </View>
        ) : undefined
      }
    >
      {data === null || data === undefined ? null : <VuBars data={data} />}
    </ModuleSurface>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  readout: {
    position: 'absolute',
    top: 2,
    right: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  readoutLabel: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  labels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: STRUCTURAL_TOKENS.spacing.sm,
  },
  label: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
  },
});
