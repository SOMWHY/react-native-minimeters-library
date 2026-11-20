import { LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import type { NumericRange } from '../../drawing';
import { useDerivedValue } from '../../drawing/reanimated';
import { DEFAULT_DB_RANGE, normalizeBins } from '../display';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps } from '../types';
import { resolveSpectrumState } from './state';

const UNIT_DOMAIN: NumericRange = [0, 1];

export interface SpectrumModuleProps extends ModuleBaseProps {
  /** Magnitude bins in dB, prepared by the host application. */
  readonly bins?: ArrayLike<number> | null;
  /** dB window mapped to the plot height. */
  readonly dbRange?: NumericRange;
}

interface SpectrumPlotProps {
  readonly bins: ArrayLike<number>;
  readonly dbRange: NumericRange;
}

/**
 * Filled area under the normalized magnitude curve, shaded from `traces.low`
 * (bottom) to `traces.high` (top), plus a primary-colored outline.
 */
function SpectrumPlot({ bins, dbRange }: SpectrumPlotProps) {
  const { colors, height, mapX, mapY, tokens, width } = useDrawingContext();

  const areaPath = useMemo(() => {
    const normalized = normalizeBins(bins, dbRange);
    const domain: NumericRange = [0, Math.max(1, normalized.length - 1)];
    const builder = Skia.PathBuilder.Make();

    builder.moveTo(mapX(0, domain), mapY(0, UNIT_DOMAIN));

    for (let index = 0; index < normalized.length; index += 1) {
      builder.lineTo(
        mapX(index, domain),
        mapY(normalized[index], UNIT_DOMAIN),
      );
    }

    builder.lineTo(
      mapX(normalized.length - 1, domain),
      mapY(0, UNIT_DOMAIN),
    );
    builder.close();

    return builder.build();
  }, [bins, dbRange, mapX, mapY]);

  const gradientColors = useDerivedValue(() => [
    colors.traces.low.value,
    colors.traces.high.value,
  ]);

  return (
    <>
      <Path path={areaPath}>
        <LinearGradient
          start={vec(0, height)}
          end={vec(0, 0)}
          colors={gradientColors}
        />
      </Path>
      <Path
        path={areaPath}
        color={colors.traces.primary}
        style="stroke"
        strokeWidth={tokens.strokeWidth.fine}
        strokeJoin="round"
      />
    </>
  );
}

/** Spectrum analyzer module for host-prepared dB bins. */
export function SpectrumModule({
  theme,
  height,
  label,
  style,
  bins,
  dbRange = DEFAULT_DB_RANGE,
}: SpectrumModuleProps) {
  const status = resolveSpectrumState({ bins, dbRange });

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {bins === null || bins === undefined || bins.length === 0 ? null : (
        <SpectrumPlot bins={bins} dbRange={dbRange} />
      )}
    </ModuleSurface>
  );
}
