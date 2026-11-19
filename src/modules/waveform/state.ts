import { resolvePcmState } from '../pcm';
import type { ModuleStatus, PcmBlock } from '../types';

/**
 * Render state of the waveform module: `waiting` without a block, `invalid`
 * for a structurally broken or non-finite block, `ready` otherwise.
 */
export function resolveWaveformState(
  block: PcmBlock | null | undefined,
): ModuleStatus {
  return resolvePcmState(block);
}
