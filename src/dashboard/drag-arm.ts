/**
 * Hold-to-drag arming rules.
 *
 * A card inside a scrolling page has to answer one question before it moves:
 * is this touch a scroll, or a drag? Waiting for a short hold is the cheapest
 * honest answer — a tap or a swipe resolves to the scroll view, a deliberate
 * press turns the whole card into a drag handle.
 *
 * The thresholds live here, away from the responder wiring, so the policy can be
 * reasoned about (and tested) without a renderer.
 */

/** How long a touch must stay still before a card becomes draggable. */
export const DRAG_HOLD_MS = 200;

/**
 * How far a touch may wander during the hold before it counts as a scroll.
 *
 * Matches the platform touch slop closely enough that the armed state is decided
 * before the scroll view takes the gesture over.
 */
export const DRAG_CANCEL_DISTANCE = 8;

/**
 * Whether a hold has lasted long enough to arm a drag.
 *
 * `movedDistance` is the largest axis displacement seen so far, so a touch that
 * drifted has already been claimed by the scroll view and never arms.
 */
export function shouldArmDrag(
  elapsedMs: number,
  movedDistance: number,
): boolean {
  return elapsedMs >= DRAG_HOLD_MS && movedDistance <= DRAG_CANCEL_DISTANCE;
}

/** Whether a touch has drifted far enough to abandon a pending hold. */
export function shouldCancelArm(movedDistance: number): boolean {
  return movedDistance > DRAG_CANCEL_DISTANCE;
}
