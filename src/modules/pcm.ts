import type { ModuleStatus, PcmBlock } from './types';

/**
 * Structural validation shared by every module that consumes a PCM block.
 *
 * Absence is `waiting` (the host has nothing to show yet); a present-but-broken
 * block is `invalid` (silently drawing it would misrepresent the audio). A
 * fully silent block is valid.
 */
export function resolvePcmState(
  block: PcmBlock | null | undefined,
): ModuleStatus {
  if (block === null || block === undefined) {
    return 'waiting';
  }

  const { samples } = block;

  if (samples === null || samples === undefined || samples.length === 0) {
    return 'waiting';
  }

  const channels = block.channels;
  const samplesPerChannel = block.samplesPerChannel;

  if (
    !Number.isFinite(channels) ||
    channels < 1 ||
    !Number.isFinite(samplesPerChannel) ||
    samplesPerChannel < 1
  ) {
    return 'invalid';
  }

  if (Math.floor(channels) * Math.floor(samplesPerChannel) !== samples.length) {
    return 'invalid';
  }

  for (let index = 0; index < samples.length; index += 1) {
    if (!Number.isFinite(Number(samples[index]))) {
      return 'invalid';
    }
  }

  return 'ready';
}
