import type { NumericRange } from '../drawing/coordinates';
import type { EnvelopeColumns, PcmBlock, StereoPoint } from './types';

/**
 * Display preparation for the visualization modules.
 *
 * Everything here converts *already computed* values into screen-space data
 * (columns, points, pixels). It never decodes the wire format, never computes
 * an audio metric, and never synthesizes data that was not provided: the host
 * application owns decoding plus FFT/peak/RMS/LUFS analysis.
 *
 * All helpers are pure and allocation-bounded by the requested output size.
 * Non-finite input values are coerced to `0` so a single bad sample cannot
 * produce a non-finite coordinate; structural problems are reported by each
 * module's state classifier instead.
 */

/** Default dB window used by dB-valued modules. */
export const DEFAULT_DB_RANGE: NumericRange = [-90, 0];

const NEUTRAL_SAMPLE = 0;

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : NEUTRAL_SAMPLE;
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value >= max ? max : Math.floor(value);
}

function resolveChannelCount(block: PcmBlock): number {
  const channels = Math.floor(block.channels);

  return Number.isFinite(channels) && channels > 0 ? channels : 1;
}

/** Usable sample count per channel: the declared count bounded by the buffer. */
function resolveSampleCount(block: PcmBlock, channels: number): number {
  const available = Math.floor(block.samples.length / channels);
  const declared = Math.floor(block.samplesPerChannel);

  if (!Number.isFinite(available) || available <= 0) {
    return 0;
  }

  if (!Number.isFinite(declared) || declared <= 0) {
    return available;
  }

  return Math.min(declared, available);
}

function readSample(
  block: PcmBlock,
  channels: number,
  index: number,
  channel: number,
): number {
  const safeChannel = clampIndex(channel, channels - 1);
  const offset = index * channels + safeChannel;

  return finiteOrZero(Number(block.samples[offset]));
}

function requirePositiveCount(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new RangeError(`${label} must be a positive finite number, received ${value}`);
  }

  return Math.floor(value);
}

/** Clamps a value into `0..1`; `NaN` becomes `0`, infinities clamp. */
export function clampUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

/**
 * Decimates one channel into `columns` min/max pairs.
 *
 * The output always has exactly `columns` entries: when there are fewer samples
 * than columns the surrounding window repeats the neighbouring sample instead
 * of reading out of bounds.
 */
export function toEnvelopeColumns(
  block: PcmBlock,
  columns: number,
  channel = 0,
): EnvelopeColumns {
  const count = requirePositiveCount(columns, 'columns');
  const channels = resolveChannelCount(block);
  const sampleCount = resolveSampleCount(block, channels);
  const min = new Float32Array(count);
  const max = new Float32Array(count);

  if (sampleCount === 0) {
    return { min, max };
  }

  for (let column = 0; column < count; column += 1) {
    const start = Math.min(
      sampleCount - 1,
      Math.floor((column * sampleCount) / count),
    );
    const end = Math.min(
      sampleCount,
      Math.max(start + 1, Math.floor(((column + 1) * sampleCount) / count)),
    );

    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;

    for (let index = start; index < end; index += 1) {
      const sample = readSample(block, channels, index, channel);

      if (sample < low) {
        low = sample;
      }

      if (sample > high) {
        high = sample;
      }
    }

    min[column] = Number.isFinite(low) ? low : NEUTRAL_SAMPLE;
    max[column] = Number.isFinite(high) ? high : NEUTRAL_SAMPLE;
  }

  return { min, max };
}

/**
 * Decimates one channel into at most `points` samples, inclusive of the first
 * and last sample so a polyline spans the whole window.
 */
export function toTraceSamples(
  block: PcmBlock,
  points: number,
  channel = 0,
): Float32Array {
  const capacity = requirePositiveCount(points, 'points');
  const channels = resolveChannelCount(block);
  const sampleCount = resolveSampleCount(block, channels);

  if (sampleCount === 0) {
    return new Float32Array(0);
  }

  const count = Math.min(capacity, sampleCount);
  const trace = new Float32Array(count);

  if (count === 1) {
    trace[0] = readSample(block, channels, 0, channel);

    return trace;
  }

  for (let index = 0; index < count; index += 1) {
    const sampleIndex = Math.round((index * (sampleCount - 1)) / (count - 1));
    trace[index] = readSample(block, channels, sampleIndex, channel);
  }

  return trace;
}

/**
 * Projects interleaved left/right pairs into goniometer coordinates:
 * `x = (right - left) / √2`, `y = (right + left) / √2`.
 */
export function toStereoPoints(block: PcmBlock, points = 512): StereoPoint[] {
  const capacity = requirePositiveCount(points, 'points');
  const channels = resolveChannelCount(block);
  const sampleCount = resolveSampleCount(block, channels);

  if (sampleCount === 0) {
    return [];
  }

  const leftChannel = 0;
  const rightChannel = Math.min(1, channels - 1);
  const stride = Math.max(1, Math.ceil(sampleCount / capacity));
  const projected: StereoPoint[] = [];

  for (
    let index = 0;
    index < sampleCount && projected.length < capacity;
    index += stride
  ) {
    const left = readSample(block, channels, index, leftChannel);
    const right = readSample(block, channels, index, rightChannel);

    projected.push({
      x: (right - left) / Math.SQRT2,
      y: (right + left) / Math.SQRT2,
    });
  }

  return projected;
}

/** Maps dB bins into `0..1`, clamping outside the window. */
export function normalizeBins(
  bins: ArrayLike<number>,
  dbRange: NumericRange = DEFAULT_DB_RANGE,
): Float32Array {
  const normalized = new Float32Array(bins.length);
  const span = dbRange[1] - dbRange[0];
  const usableSpan = Number.isFinite(span) && span > 0;

  for (let index = 0; index < bins.length; index += 1) {
    const value = Number(bins[index]);

    normalized[index] =
      usableSpan && Number.isFinite(value)
        ? clampUnit((value - dbRange[0]) / span)
        : 0;
  }

  return normalized;
}

/** Maps a single dB value through a dB window into `0..1`. */
export function toMeterScale(value: number, dbRange: NumericRange): number {
  const span = dbRange[1] - dbRange[0];

  if (!Number.isFinite(value) || !Number.isFinite(span) || span <= 0) {
    return 0;
  }

  return clampUnit((value - dbRange[0]) / span);
}
