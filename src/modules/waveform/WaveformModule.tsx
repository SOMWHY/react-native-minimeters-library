import { Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { toEnvelopeColumns } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type {
  EnvelopeColumns,
  ModuleBaseProps,
  PcmBlock,
} from '../types';
import { envelopeFromFrames } from './history';
import { resolveWaveformState } from './state';

const AMPLITUDE_DOMAIN: NumericRange = [-1, 1];
const DEFAULT_COLUMNS = 96;

/** How the module is fed: a block is one instant, a frame list is a history. */
type WaveformSource =
  | { readonly kind: 'history'; readonly frames: readonly PcmBlock[] }
  | { readonly kind: 'block'; readonly block: PcmBlock };

export interface WaveformModuleProps extends ModuleBaseProps {
  /**
   * Chronological blocks (oldest first) drawn as a peak envelope over time.
   * Preferred over `block` when both are given — this is the "waveform" view.
   */
  readonly frames?: readonly PcmBlock[] | null;
  /**
   * Single interleaved PCM block. Only used when no `frames` history is
   * supplied; on its own this draws one instant, like an oscilloscope.
   */
  readonly block?: PcmBlock | null;
  /** Channel index to plot. */
  readonly channel?: number;
  /** Envelope resolution: one min/max pair per column. */
  readonly columns?: number;
}

interface WaveformPlotProps {
  readonly envelope: EnvelopeColumns;
  readonly columns: number;
}

/**
 * Filled min/max band plus the zero axis.
 *
 * Column centres map across `[0, columns]` and amplitudes map through the
 * `[-1, 1]` domain up the context's reversed Y axis, so the band stays aligned
 * with the shared grid at any measured size.
 */
function WaveformPlot({ envelope, columns }: WaveformPlotProps) {
  const { colors, mapX, mapY, tokens, width } = useDrawingContext();

  const bandPath = useMemo(() => {
    const { min, max } = envelope;
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
  }, [envelope, columns, mapX, mapY]);

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

function resolveSource(
  frames: readonly PcmBlock[] | null | undefined,
  block: PcmBlock | null | undefined,
): WaveformSource | null {
  if (frames && frames.length > 0) {
    return { kind: 'history', frames };
  }

  return block ? { kind: 'block', block } : null;
}

/**
 * Peak-envelope waveform module.
 *
 * Pass `frames` for the module's real job — a scrolling picture of the last
 * `WAVEFORM_HISTORY_SECONDS` of audio — or a single `block` for a one-shot
 * envelope of that block.
 */
export function WaveformModule({
  theme,
  height,
  label,
  style,
  frames,
  block,
  channel = 0,
  columns = DEFAULT_COLUMNS,
}: WaveformModuleProps) {
  const status = resolveWaveformState(block, frames);
  const resolvedColumns = Math.max(1, Math.floor(columns) || DEFAULT_COLUMNS);
  const source = resolveSource(frames, block);

  const envelope = useMemo(() => {
    if (source === null) {
      return null;
    }

    return source.kind === 'history'
      ? envelopeFromFrames(source.frames, resolvedColumns, channel)
      : toEnvelopeColumns(source.block, resolvedColumns, channel);
  }, [source, resolvedColumns, channel]);

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {envelope === null ? null : (
        <WaveformPlot envelope={envelope} columns={resolvedColumns} />
      )}
    </ModuleSurface>
  );
}
