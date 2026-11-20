import { toTraceSamples } from '../display';
import type { PcmBlock } from '../types';
import { findTriggerIndex } from './trigger';

export type OscilloscopeTrigger = 'rising' | 'none';

/**
 * Rotates a trace so it starts at `shift`, wrapping around.
 *
 * Rotation is what makes a triggered trace keep a fixed horizontal time scale:
 * the trace always spans the whole captured block, the trigger only decides
 * which sample lands on the left edge. Re-reading from the trigger offset would
 * instead shorten the window and stretch the remaining samples across the full
 * width, so a steady tone would still appear to change its period.
 */
export function rotateTrace(trace: Float32Array, shift: number): Float32Array {
  const length = trace.length;

  if (length < 2 || !Number.isFinite(shift)) {
    return trace;
  }

  const rounded = Math.round(shift);
  const offset = ((rounded % length) + length) % length;

  if (offset === 0) {
    return trace;
  }

  const rotated = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    rotated[index] = trace[(index + offset) % length];
  }

  return rotated;
}

/**
 * Decimated trace whose left edge sits on the trigger crossing.
 *
 * Length only depends on `points` and the block, never on where the crossing
 * happens to fall, so the horizontal scale is stable from frame to frame.
 */
export function triggeredTraceSamples(
  block: PcmBlock,
  points: number,
  channel = 0,
  trigger: OscilloscopeTrigger = 'none',
): Float32Array {
  const trace = toTraceSamples(block, points, channel, 0);

  if (trigger !== 'rising' || trace.length < 2) {
    return trace;
  }

  const sampleCount = Math.max(
    0,
    Math.floor(Number(block.samplesPerChannel)) || 0,
  );
  const triggerIndex = findTriggerIndex(block, channel);

  if (sampleCount < 2 || triggerIndex <= 0) {
    return trace;
  }

  return rotateTrace(
    trace,
    Math.round((triggerIndex / sampleCount) * trace.length),
  );
}
