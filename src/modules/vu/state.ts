import type { ModuleStatus } from '../types';

/** Normalized VU levels in `0..1`; values outside the range are clamped at render. */
export interface VuLevels {
  readonly left: number;
  readonly right: number;
  readonly leftPeak?: number;
  readonly rightPeak?: number;
}

/**
 * Render state of the VU module.
 *
 * Out-of-range levels are *not* an error: the meter clamps them so a slightly
 * hot host report still draws. Only non-finite values are rejected.
 */
export function resolveVuState(
  data: VuLevels | null | undefined,
): ModuleStatus {
  if (data === null || data === undefined) {
    return 'waiting';
  }

  const { left, right, leftPeak, rightPeak } = data;

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return 'invalid';
  }

  if (
    (leftPeak !== undefined && !Number.isFinite(leftPeak)) ||
    (rightPeak !== undefined && !Number.isFinite(rightPeak))
  ) {
    return 'invalid';
  }

  return 'ready';
}
