import { DEFAULT_DB_RANGE } from '../display';
import type { NumericRange } from '../../drawing';
import type { ModuleStatus } from '../types';

export interface SpectrumInput {
  /** Magnitude bins in dB, already prepared by the host application. */
  readonly bins?: ArrayLike<number> | null;
  /** dB window mapped to the unit range. */
  readonly dbRange?: NumericRange;
}

/**
 * Render state of the spectrum module.
 *
 * `waiting` covers absent and empty bins; `invalid` covers non-finite bins and a
 * dB window that is non-finite or inverted (which cannot be normalized without
 * dividing by zero).
 */
export function resolveSpectrumState({
  bins,
  dbRange = DEFAULT_DB_RANGE,
}: SpectrumInput): ModuleStatus {
  if (bins === null || bins === undefined || bins.length === 0) {
    return 'waiting';
  }

  const [low, high] = dbRange;

  if (
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high <= low
  ) {
    return 'invalid';
  }

  for (let index = 0; index < bins.length; index += 1) {
    if (!Number.isFinite(Number(bins[index]))) {
      return 'invalid';
    }
  }

  return 'ready';
}
