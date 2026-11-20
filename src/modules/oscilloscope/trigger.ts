import type { PcmBlock } from '../types';

/**
 * Fraction of the block searched for a trigger crossing.
 *
 * A quarter is enough to find a crossing for anything above a few cycles per
 * block, and keeps the trigger near the start so the trace still shows most of
 * the captured window.
 */
const SEARCH_FRACTION = 0.25;

/**
 * Index of the first rising zero crossing on one channel, or `0` when there is
 * none.
 *
 * An oscilloscope without a trigger draws a different slice of the wave every
 * frame, so a steady tone appears to slide sideways. Anchoring the trace on a
 * rising crossing pins the waveform in place: the same phase always lands at the
 * left edge.
 */
export function findTriggerIndex(block: PcmBlock, channel = 0): number {
  const channels = Math.max(1, Math.floor(block.channels) || 1);
  const sampleCount = Math.max(0, Math.floor(block.samplesPerChannel) || 0);

  if (sampleCount < 2) {
    return 0;
  }

  const limit = Math.max(
    1,
    Math.min(sampleCount - 1, Math.floor(sampleCount * SEARCH_FRACTION)),
  );
  const read = (sampleIndex: number) => {
    const value = Number(block.samples[sampleIndex * channels + channel]);

    return Number.isFinite(value) ? value : 0;
  };

  for (let index = 1; index <= limit; index += 1) {
    const previous = read(index - 1);
    const current = read(index);

    if (previous <= 0 && current > 0) {
      return index;
    }
  }

  return 0;
}
