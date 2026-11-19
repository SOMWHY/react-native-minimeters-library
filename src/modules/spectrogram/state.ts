import type { ModuleStatus } from '../types';
import { isSpectrogramValid } from './pixels';

/**
 * Render state of the spectrogram module.
 *
 * `waiting` covers an absent or empty row set; `invalid` covers ragged rows or
 * non-finite bin values, which would smear the history into a false picture.
 */
export function resolveSpectrogramState(
  rows: ArrayLike<ArrayLike<number>> | null | undefined,
): ModuleStatus {
  if (rows === null || rows === undefined || rows.length === 0) {
    return 'waiting';
  }

  return isSpectrogramValid(rows) ? 'ready' : 'invalid';
}
