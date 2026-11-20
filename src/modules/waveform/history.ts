import type { EnvelopeColumns, PcmBlock } from '../types';

/**
 * How much recent audio the waveform picture shows, in seconds.
 *
 * The waveform is a *history* view — the last few seconds of level, attacks and
 * gaps — while the oscilloscope is the instantaneous shape of the current block.
 * Sharing the block would make the two look identical, which is the trap this
 * module used to fall into.
 */
export const WAVEFORM_HISTORY_SECONDS = 3;

/**
 * Min/max envelope across a chronological list of blocks.
 *
 * Blocks are concatenated in order (oldest first) and sliced into `columns`
 * equal sample spans, so the picture compresses as the history fills. Columns
 * start at zero, so a span with no signal draws a flat line rather than
 * whatever the previous column peaked at.
 */
export function envelopeFromFrames(
  frames: readonly PcmBlock[],
  columns: number,
  channel = 0,
): EnvelopeColumns {
  const count = Math.max(1, Math.floor(columns) || 1);
  const min = new Float32Array(count);
  const max = new Float32Array(count);

  let total = 0;
  for (const frame of frames) {
    total += sampleLength(frame);
  }

  if (total === 0) {
    return { min, max };
  }

  // Seeded outwards-in so an all-negative column still records its peak; empty
  // columns are flattened to zero at the end.
  const low = new Float32Array(count).fill(Number.POSITIVE_INFINITY);
  const high = new Float32Array(count).fill(Number.NEGATIVE_INFINITY);
  let offset = 0;

  for (const frame of frames) {
    const channels = Math.max(1, Math.floor(frame.channels) || 1);
    const length = sampleLength(frame);
    const picked = Math.min(Math.max(0, Math.floor(channel) || 0), channels - 1);

    for (let index = 0; index < length; index += 1) {
      const value = frame.samples[index * channels + picked];

      if (!Number.isFinite(value)) {
        continue;
      }

      const column = Math.min(
        count - 1,
        Math.floor(((offset + index) * count) / total),
      );

      if (value < low[column]) {
        low[column] = value;
      }

      if (value > high[column]) {
        high[column] = value;
      }
    }

    offset += length;
  }

  for (let column = 0; column < count; column += 1) {
    if (Number.isFinite(low[column])) {
      min[column] = low[column];
      max[column] = high[column];
    }
  }

  return { min, max };
}

/** Samples per channel actually present in a block, ignoring trailing padding. */
function sampleLength(frame: PcmBlock): number {
  const channels = Math.max(1, Math.floor(frame.channels) || 1);
  const declared = Math.max(0, Math.floor(frame.samplesPerChannel) || 0);

  return Math.min(declared, Math.floor(frame.samples.length / channels));
}
