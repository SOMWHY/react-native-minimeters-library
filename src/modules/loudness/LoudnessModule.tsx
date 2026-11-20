import { Rect } from '@shopify/react-native-skia';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDrawingContext } from '../../drawing';
import { STRUCTURAL_TOKENS } from '../../theme/structural-tokens';
import { toMeterScale } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps } from '../types';
import { resolveLoudnessState, type LoudnessValues } from './state';

const DEFAULT_DB_RANGE: readonly [number, number] = [-60, 0];
const ROWS = 3;

export interface LoudnessModuleProps extends ModuleBaseProps {
  /** Host-computed levels; absence renders the `waiting` state. */
  readonly data?: LoudnessValues | null;
  /** dB window mapped across the bar width. */
  readonly dbRange?: readonly [number, number];
}

interface LoudnessBarsProps {
  readonly data: LoudnessValues;
  readonly dbRange: readonly [number, number];
}

function LoudnessBars({ data, dbRange }: LoudnessBarsProps) {
  const { colors, height, tokens, width } = useDrawingContext();

  const inset = tokens.spacing.sm;
  const rowHeight = height / ROWS;
  const barHeight = Math.max(
    tokens.strokeWidth.strong,
    rowHeight - tokens.spacing.md,
  );
  const trackWidth = Math.max(0, width - inset * 2);
  const rows = [
    { key: 'peak', value: data.peak, color: colors.traces.high },
    { key: 'rms', value: data.rms, color: colors.traces.mid },
    { key: 'lufs', value: data.lufs, color: colors.traces.primary },
  ];

  return (
    <>
      {rows.map((row, index) => {
        const y = index * rowHeight + (rowHeight - barHeight) / 2;
        const filled = toMeterScale(row.value, dbRange) * trackWidth;

        return (
          <Fragment key={row.key}>
            <Rect
              x={inset}
              y={y}
              width={trackWidth}
              height={barHeight}
              color={colors.surface}
            />
            <Rect
              x={inset}
              y={y}
              width={filled}
              height={barHeight}
              color={row.color}
            />
          </Fragment>
        );
      })}
    </>
  );
}

function LoudnessReadout({
  data,
  color,
  labelColor,
}: {
  data: LoudnessValues;
  color: string;
  labelColor: string;
}) {
  const rows = [
    { key: 'peak', label: 'PEAK', value: data.peak },
    { key: 'rms', label: 'RMS', value: data.rms },
    { key: 'lufs', label: 'LUFS', value: data.lufs },
  ];

  return (
    <View style={styles.readout}>
      {rows.map((row) => (
        <View key={row.key} style={styles.readoutRow}>
          <Text style={[styles.readoutLabel, { color: labelColor }]}>
            {row.label}
          </Text>
          <Text style={[styles.readoutValue, { color }]}>
            {`${row.value.toFixed(1)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Horizontal peak / RMS / LUFS meter module. */
export function LoudnessModule({
  theme,
  height,
  label,
  style,
  data,
  dbRange = DEFAULT_DB_RANGE,
}: LoudnessModuleProps) {
  const status = resolveLoudnessState(data);

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
      overlay={
        status === 'ready' && data !== null && data !== undefined ? (
          <LoudnessReadout
            data={data}
            color={theme.colors.text}
            labelColor={theme.colors.textMuted}
          />
        ) : undefined
      }
    >
      {data === null || data === undefined ? null : (
        <LoudnessBars data={data} dbRange={dbRange} />
      )}
    </ModuleSurface>
  );
}

const styles = StyleSheet.create({
  readout: {
    flex: 1,
    justifyContent: 'space-between',
  },
  readoutRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readoutLabel: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
  },
  readoutValue: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.bold,
  },
});
