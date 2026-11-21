import { Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps, PcmBlock } from '../types';
import { resolveOscilloscopeState } from './state';
import { triggeredTraceSamples } from './trace';

const AMPLITUDE_DOMAIN: NumericRange = [-1, 1];
/** Points used only when there is no block to size the trace from. */
const DEFAULT_POINTS = 128;

export interface OscilloscopeModuleProps extends ModuleBaseProps {
  /** Interleaved PCM block; absence renders the `waiting` state. */
  readonly block?: PcmBlock | null;
  /** Channel index to trace. */
  readonly channel?: number;
  /**
   * Maximum number of polyline vertices. Defaults to the block's own sample
   * count, i.e. one vertex per captured sample: a scope is there to show the
   * actual waveform, and decimating it hides exactly the detail that is asked
   * for.
   */
  readonly points?: number;
  /**
   * `rising` anchors the trace on the first rising zero crossing so a steady
   * tone stands still instead of sliding sideways every frame; `none` traces
   * from the first sample, which shows genuine phase drift.
   */
  readonly trigger?: 'rising' | 'none';
}

interface OscilloscopePlotProps {
  readonly block: PcmBlock;
  readonly channel: number;
  readonly points: number;
  readonly trigger: 'rising' | 'none';
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
function OscilloscopePlot({
  block,
  channel,
  points,
  trigger,
}: OscilloscopePlotProps) {
  const { colors, height, mapX, mapY, tokens, width } = useDrawingContext();

  const tracePath = useMemo(() => {
    const trace = triggeredTraceSamples(block, points, channel, trigger);
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
  }, [block, channel, mapX, mapY, points, trigger]);

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
  label,
  style,
  block,
  channel = 0,
  points,
  trigger = 'rising',
}: OscilloscopeModuleProps) {
  const status = resolveOscilloscopeState(block);
  const resolvedPoints = Math.max(
    2,
    Math.floor(points ?? block?.samplesPerChannel ?? DEFAULT_POINTS) ||
      DEFAULT_POINTS,
  );

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
          trigger={trigger}
        />
      )}
    </ModuleSurface>
  );
}
