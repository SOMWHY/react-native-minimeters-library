import { Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { toEnvelopeColumns } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps, PcmBlock } from '../types';
import { resolveWaveformState } from './state';

const AMPLITUDE_DOMAIN: NumericRange = [-1, 1];
const DEFAULT_COLUMNS = 96;

export interface WaveformModuleProps extends ModuleBaseProps {
  /** Interleaved PCM block; absence renders the `waiting` state. */
  readonly block?: PcmBlock | null;
  /** Channel index to plot. */
  readonly channel?: number;
  /** Envelope resolution: one min/max pair per column. */
  readonly columns?: number;
}

interface WaveformPlotProps {
  readonly block: PcmBlock;
  readonly channel: number;
  readonly columns: number;
}

/**
 * Filled min/max band plus the zero axis.
 *
 * Column centres map across `[0, columns]` and amplitudes map through the
 * `[-1, 1]` domain up the context's reversed Y axis, so the band stays aligned
 * with the shared grid at any measured size.
 */
function WaveformPlot({ block, channel, columns }: WaveformPlotProps) {
  const { colors, mapX, mapY, tokens, width } = useDrawingContext();

  const bandPath = useMemo(() => {
    const { min, max } = toEnvelopeColumns(block, columns, channel);
    const domain: NumericRange = [0, columns];
    const builder = Skia.PathBuilder.Make();

    for (let index = 0; index < max.length; index += 1) {
      const x = mapX(index + 0.5, domain);
      const y = mapY(max[index], AMPLITUDE_DOMAIN);

      if (index === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    }

    for (let index = min.length - 1; index >= 0; index -= 1) {
      builder.lineTo(
        mapX(index + 0.5, domain),
        mapY(min[index], AMPLITUDE_DOMAIN),
      );
    }

    builder.close();

    return builder.build();
  }, [block, channel, columns, mapX, mapY]);

  const zeroAxisY = mapY(0, AMPLITUDE_DOMAIN);

  return (
    <>
      <Path path={bandPath} color={colors.traces.primary} />
      <Line
        p1={vec(0, zeroAxisY)}
        p2={vec(width, zeroAxisY)}
        color={colors.axis}
        strokeWidth={tokens.strokeWidth.hairline}
      />
    </>
  );
}

/** Peak-envelope waveform module. */
export function WaveformModule({
  theme,
  height,
  label,
  style,
  block,
  channel = 0,
  columns = DEFAULT_COLUMNS,
}: WaveformModuleProps) {
  const status = resolveWaveformState(block);
  const resolvedColumns = Math.max(1, Math.floor(columns) || DEFAULT_COLUMNS);

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {block === null || block === undefined ? null : (
        <WaveformPlot
          block={block}
          channel={channel}
          columns={resolvedColumns}
        />
      )}
    </ModuleSurface>
  );
}
