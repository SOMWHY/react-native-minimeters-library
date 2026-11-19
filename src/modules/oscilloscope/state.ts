import { resolvePcmState } from '../pcm';
import type { ModuleStatus, PcmBlock } from '../types';

/**
 * Render state of the oscilloscope module: `waiting` without a block, `invalid`
 * for a structurally broken or non-finite block, `ready` otherwise.
 */
export function resolveOscilloscopeState(
  block: PcmBlock | null | undefined,
): ModuleStatus {
  return resolvePcmState(block);
}
