import { resolvePcmState } from '../pcm';
import type { ModuleStatus, PcmBlock } from '../types';

/**
 * Render state of the vectorscope module.
 *
 * A vectorscope plots a stereo pair, so a mono (single-channel) block is
 * `invalid` even though the PCM itself is well formed.
 */
export function resolveVectorscopeState(
  block: PcmBlock | null | undefined,
): ModuleStatus {
  const state = resolvePcmState(block);

  if (state !== 'ready') {
    return state;
  }

  return block !== null && block !== undefined && block.channels >= 2
    ? 'ready'
    : 'invalid';
}
