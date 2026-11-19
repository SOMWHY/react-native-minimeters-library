import { Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { toTraceSamples } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps, PcmBlock } from '../types';
import { resolveOscilloscopeState } from './state';

const AMPLITUDE_DOMAIN: NumericRange = [-1, 1];
const DEFAULT_POINTS = 128;
const DEFAULT_LABEL = 'OSCILLOSCOPE';

export interface OscilloscopeModuleProps extends ModuleBaseProps {
  /** Interleaved PCM block; absence renders the `waiting` state. */
  readonly block?: PcmBlock | null;
  /** Channel index to trace. */
  readonly channel?: number;
  /** Maximum number of polyline vertices. */
  readonly points?: number;
}

interface OscilloscopePlotProps {
  readonly block: PcmBlock;
  readonly channel: number;
  readonly points: number;
}

function clampAmplitude(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}

/**
 * Single-sample polyline over an opaque `surface` fill, so a partially
 * transparent or dashed neighbour can never show through the plot.
 */
function OscilloscopePlot({ block, channel, points }: OscilloscopePlotProps) {
  const { colors, height, mapX, mapY, tokens, width } = useDrawingContext();

  const tracePath = useMemo(() => {
    const trace = toTraceSamples(block, points, channel);
    const builder = Skia.PathBuilder.Make();
    const domain: NumericRange = [0, Math.max(1, trace.length - 1)];

    for (let index = 0; index < trace.length; index += 1) {
      const x = mapX(index, domain);
      const y = mapY(clampAmplitude(trace[index]), AMPLITUDE_DOMAIN);

      if (index === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    }

    return builder.build();
  }, [block, channel, mapX, mapY, points]);

  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={colors.surface} />
      <Path
        path={tracePath}
        color={colors.traces.primary}
        style="stroke"
        strokeWidth={tokens.strokeWidth.regular}
        strokeCap="round"
        strokeJoin="round"
      />
    </>
  );
}

/** Time-domain oscilloscope module. */
export function OscilloscopeModule({
  theme,
  height,
  label = DEFAULT_LABEL,
  style,
  block,
  channel = 0,
  points = DEFAULT_POINTS,
}: OscilloscopeModuleProps) {
  const status = resolveOscilloscopeState(block);
  const resolvedPoints = Math.max(2, Math.floor(points) || DEFAULT_POINTS);

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {block === null || block === undefined ? null : (
        <OscilloscopePlot
          block={block}
          channel={channel}
          points={resolvedPoints}
        />
      )}
    </ModuleSurface>
  );
}
