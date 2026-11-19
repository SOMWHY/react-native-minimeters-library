import { Circle, Group, Line, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { toStereoPoints } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps, PcmBlock } from '../types';
import { resolveVectorscopeState } from './state';

const STEREO_DOMAIN: NumericRange = [-1, 1];
const DEFAULT_POINTS = 256;
const DEFAULT_LABEL = 'VECTORSCOPE';

export interface VectorscopeModuleProps extends ModuleBaseProps {
  /** Interleaved stereo PCM block; absence renders the `waiting` state. */
  readonly block?: PcmBlock | null;
  /** Maximum number of plotted sample pairs. */
  readonly points?: number;
}

interface VectorscopePlotProps {
  readonly block: PcmBlock;
  readonly points: number;
}

/**
 * Goniometer plot: one dot per projected sample pair, plus the diagonal and
 * mid-side reference axes. Both axes share the `[-1, 1]` domain so the plot
 * stays square in phase space regardless of the surface aspect ratio.
 */
function VectorscopePlot({ block, points }: VectorscopePlotProps) {
  const { colors, mapX, mapY, tokens } = useDrawingContext();

  const projected = useMemo(
    () => toStereoPoints(block, points),
    [block, points],
  );

  const topLeft = { x: mapX(-1, STEREO_DOMAIN), y: mapY(1, STEREO_DOMAIN) };
  const bottomRight = { x: mapX(1, STEREO_DOMAIN), y: mapY(-1, STEREO_DOMAIN) };
  const midSideStart = { x: mapX(-1, STEREO_DOMAIN), y: mapY(-1, STEREO_DOMAIN) };
  const midSideEnd = { x: mapX(1, STEREO_DOMAIN), y: mapY(1, STEREO_DOMAIN) };
  const radius = tokens.spacing.xs / 2;

  return (
    <Group>
      <Line
        p1={vec(topLeft.x, topLeft.y)}
        p2={vec(bottomRight.x, bottomRight.y)}
        color={colors.axis}
        strokeWidth={tokens.strokeWidth.hairline}
      />
      <Line
        p1={vec(midSideStart.x, midSideStart.y)}
        p2={vec(midSideEnd.x, midSideEnd.y)}
        color={colors.axis}
        strokeWidth={tokens.strokeWidth.hairline}
      />
      {projected.map((point, index) => (
        <Circle
          key={`sample-${index}`}
          cx={mapX(point.x, STEREO_DOMAIN)}
          cy={mapY(point.y, STEREO_DOMAIN)}
          r={radius}
          color={colors.traces.primary}
        />
      ))}
    </Group>
  );
}

/** Stereo vectorscope (goniometer) module. */
export function VectorscopeModule({
  theme,
  height,
  label = DEFAULT_LABEL,
  style,
  block,
  points = DEFAULT_POINTS,
}: VectorscopeModuleProps) {
  const status = resolveVectorscopeState(block);
  const resolvedPoints = Math.max(1, Math.floor(points) || DEFAULT_POINTS);

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {block === null || block === undefined ? null : (
        <VectorscopePlot block={block} points={resolvedPoints} />
      )}
    </ModuleSurface>
  );
}
