import {
  AlphaType,
  ColorType,
  Image,
  Skia,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useDrawingContext } from '../../drawing';
import { ModuleSurface } from '../ModuleSurface';
import type { ModuleBaseProps } from '../types';
import { SPECTROGRAM_GAMMA, toSpectrogramPixels, type RgbTriple } from './pixels';
import { buildSpectrogramRamp } from './ramp';
import { resolveSpectrogramState } from './state';

const DEFAULT_MAX_ROWS = 128;

export interface SpectrogramModuleProps extends ModuleBaseProps {
  /** Normalized history rows (`0..1`), oldest first; absence renders `waiting`. */
  readonly rows?: ArrayLike<ArrayLike<number>> | null;
  /** Number of history rows kept on screen; older rows are trimmed. */
  readonly maxRows?: number;
}

interface SpectrogramPlotProps {
  readonly rows: ArrayLike<ArrayLike<number>>;
  readonly maxRows: number;
  readonly ramp: ReadonlyArray<RgbTriple>;
}

function SpectrogramPlot({ rows, maxRows, ramp }: SpectrogramPlotProps) {
  const { width, height } = useDrawingContext();

  const image = useMemo(() => {
    const raster = toSpectrogramPixels(rows, maxRows, ramp, SPECTROGRAM_GAMMA);

    if (raster.width === 0 || raster.height === 0) {
      return null;
    }

    return Skia.Image.MakeImage(
      {
        width: raster.width,
        height: raster.height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      Skia.Data.fromBytes(raster.bytes),
      raster.width * 4,
    );
  }, [maxRows, ramp, rows]);

  if (image === null) {
    return null;
  }

  return (
    <Image x={0} y={0} width={width} height={height} image={image} fit="fill" />
  );
}

/** Scrolling spectrogram module for host-prepared normalized history rows. */
export function SpectrogramModule({
  theme,
  height,
  label,
  style,
  rows,
  maxRows = DEFAULT_MAX_ROWS,
}: SpectrogramModuleProps) {
  const status = resolveSpectrogramState(rows);
  const resolvedMaxRows = Math.max(1, Math.floor(maxRows) || DEFAULT_MAX_ROWS);

  const ramp = useMemo<ReadonlyArray<RgbTriple>>(
    () =>
      buildSpectrogramRamp({
        surface: theme.colors.surface,
        low: theme.colors.traces.low,
        mid: theme.colors.traces.mid,
        high: theme.colors.traces.high,
      }),
    [
      theme.colors.surface,
      theme.colors.traces.high,
      theme.colors.traces.low,
      theme.colors.traces.mid,
    ],
  );

  return (
    <ModuleSurface
      theme={theme}
      status={status}
      height={height}
      label={label}
      style={style}
    >
      {rows === null || rows === undefined || rows.length === 0 ? null : (
        <SpectrogramPlot rows={rows} maxRows={resolvedMaxRows} ramp={ramp} />
      )}
    </ModuleSurface>
  );
}
