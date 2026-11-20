import type { ModuleStatus } from '../types';

/**
 * Host-computed loudness readouts, all in dBFS / LUFS.
 *
 * `lufs` is the **live** loudness the bar draws — in practice the momentary
 * (400 ms) value, so the bar reacts to silence. `integrated` is the BS.1770
 * programme average: it is reported as text only, because by definition it does
 * not fall when the programme goes quiet.
 */
export interface LoudnessValues {
  readonly peak: number;
  readonly rms: number;
  readonly lufs: number;
  /** Programme-integrated loudness, rendered as the `INT` note. */
  readonly integrated?: number;
}

function isFiniteLevel(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value);
}

/**
 * Render state of the loudness module.
 *
 * Silence is valid: `-90` across the board is a legal, meaningful reading.
 * Only absent values (`waiting`) and non-finite values (`invalid`) are rejected.
 */
export function resolveLoudnessState(
  data: LoudnessValues | null | undefined,
): ModuleStatus {
  if (data === null || data === undefined) {
    return 'waiting';
  }

  return isFiniteLevel(data.peak) &&
    isFiniteLevel(data.rms) &&
    isFiniteLevel(data.lufs)
    ? 'ready'
    : 'invalid';
}
