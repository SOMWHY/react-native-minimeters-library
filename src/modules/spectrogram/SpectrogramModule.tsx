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
import {
  parseHexColor,
  toSpectrogramPixels,
  type RgbTriple,
} from './pixels';
import { resolveSpectrogramState } from './state';

const DEFAULT_MAX_ROWS = 96;

/**
 * Last-resort ramp for a theme whose trace colors cannot be parsed as hex.
 * A spectrogram without a gradient is still readable; throwing during render is
 * not an option inside a canvas.
 */
const FALLBACK_RAMP: ReadonlyArray<RgbTriple> = [
  [0, 0, 0],
  [128, 128, 128],
  [255, 255, 255],
];

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
    const raster = toSpectrogramPixels(rows, maxRows, ramp);

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

  const ramp = useMemo<ReadonlyArray<RgbTriple>>(() => {
    const stops = [
      theme.colors.traces.low,
      theme.colors.traces.mid,
      theme.colors.traces.high,
    ]
      .map((color) => parseHexColor(color))
      .filter((stop): stop is RgbTriple => stop !== null);

    return stops.length > 0 ? stops : FALLBACK_RAMP;
  }, [
    theme.colors.traces.high,
    theme.colors.traces.low,
    theme.colors.traces.mid,
  ]);

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
