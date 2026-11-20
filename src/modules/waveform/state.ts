import { resolvePcmState } from '../pcm';
import type { ModuleStatus, PcmBlock } from '../types';

/**
 * Render state of the waveform module.
 *
 * A history is drawable as soon as one of its frames is; a single block is
 * validated through the shared PCM rules. `waiting` means "no data yet", which
 * is what the surface shows before the first frame arrives.
 */
export function resolveWaveformState(
  block: PcmBlock | null | undefined,
  frames?: readonly PcmBlock[] | null,
): ModuleStatus {
  if (frames && frames.length > 0) {
    const newest = frames[frames.length - 1];

    if (newest) {
      const newestState = resolvePcmState(newest);

      if (newestState !== 'ready') {
        return newestState;
      }
    }

    return frames.some((frame) => (frame?.samplesPerChannel ?? 0) > 0)
      ? 'ready'
      : 'waiting';
  }

  return resolvePcmState(block);
}
