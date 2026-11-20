import { Rect } from '@shopify/react-native-skia';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDrawingContext } from '../../drawing';
import { STRUCTURAL_TOKENS } from '../../theme/structural-tokens';
import { toMeterScale, meterRowBounds } from '../display';
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
  const bounds = meterRowBounds({
    height,
    rows: ROWS,
    inset,
    gap: tokens.spacing.md - inset,
    minBarHeight: tokens.strokeWidth.strong,
  });
  const trackWidth = Math.max(0, width - inset * 2);
  const rows = [
    { key: 'peak', value: data.peak, color: colors.traces.high },
    { key: 'rms', value: data.rms, color: colors.traces.mid },
    { key: 'lufs', value: data.lufs, color: colors.traces.primary },
  ];

  return (
    <>
      {rows.map((row, index) => {
        const bounds_ = bounds[index];

        if (bounds_ === undefined) {
          return null;
        }

        const filled = toMeterScale(row.value, dbRange) * trackWidth;

        return (
          <Fragment key={row.key}>
            <Rect
              x={inset}
              y={bounds_.y}
              width={trackWidth}
              height={bounds_.height}
              color={colors.surface}
            />
            <Rect
              x={inset}
              y={bounds_.y}
              width={filled}
              height={bounds_.height}
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
    { key: 'peak', label: 'PEAK', value: data.peak, note: '' },
    { key: 'rms', label: 'RMS', value: data.rms, note: '' },
    {
      key: 'lufs',
      label: 'LUFS',
      value: data.lufs,
      note:
        data.integrated === undefined || data.integrated === null
          ? ''
          : `INT ${data.integrated.toFixed(1)}`,
    },
  ];

  return (
    <View style={styles.readout}>
      {rows.map((row) => (
        <View key={row.key} style={styles.readoutRow}>
          <Text style={[styles.readoutLabel, { color: labelColor }]}>
            {row.label}
          </Text>
          <View style={styles.readoutValues}>
            {row.note === '' ? null : (
              <Text style={[styles.readoutNote, { color: labelColor }]}>
                {row.note}
              </Text>
            )}
            <Text style={[styles.readoutValue, { color }]}>
              {`${row.value.toFixed(1)}`}
            </Text>
          </View>
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
  readoutValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: STRUCTURAL_TOKENS.spacing.xs,
  },
  readoutNote: {
    fontFamily: STRUCTURAL_TOKENS.typography.fontFamily,
    fontSize: STRUCTURAL_TOKENS.typography.micro,
    fontWeight: STRUCTURAL_TOKENS.typography.fontWeight.medium,
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
