/**
 * Colour ramp for the spectrogram module.
 *
 * The ramp is deliberately *not* only the three trace colours: a spectrogram is
 * an opaque image, so whatever stop maps to zero is what the whole card looks
 * like when nobody is playing. Starting the ramp at `traces.low` painted the
 * body a solid saturated accent (indigo on Midnight) while every other module
 * showed `colors.surface` behind transparent traces — the one card that looked
 * like a different app.
 *
 * So stop 0 is the card surface: silence is indistinguishable from an empty
 * card, and energy climbs into the trace tones from there.
 */

import { parseHexColor, type RgbTriple } from './pixels';

/**
 * Last-resort ramp for a theme whose colours cannot be parsed as hex.
 *
 * A spectrogram without a gradient is still readable; throwing during render is
 * not an option inside a canvas. Kept dark at the bottom so it still reads as
 * "silence is empty" rather than as a block of colour.
 */
export const FALLBACK_RAMP: ReadonlyArray<RgbTriple> = [
  [0, 0, 0],
  [128, 128, 128],
  [255, 255, 255],
];

/** Theme colours the ramp is built from. */
export interface SpectrogramRampColors {
  /** The card surface behind every module; becomes the silence stop. */
  readonly surface: string;
  readonly low: string;
  readonly mid: string;
  readonly high: string;
}

/**
 * Builds `[surface, low, mid, high]`, dropping stops that are not plain hex.
 *
 * The surface is required: without it the low stop would become the background
 * again, which is the bug this ramp exists to fix. Trace tones that fail to
 * parse are skipped rather than substituted, so a theme with one bad colour
 * still gets a usable (if shorter) ramp.
 */
export function buildSpectrogramRamp(
  colors: SpectrogramRampColors,
): ReadonlyArray<RgbTriple> {
  const surface = parseHexColor(colors.surface);

  if (surface === null) {
    return FALLBACK_RAMP;
  }

  const tones = [colors.low, colors.mid, colors.high]
    .map((color) => parseHexColor(color))
    .filter((stop): stop is RgbTriple => stop !== null);

  if (tones.length === 0) {
    return FALLBACK_RAMP;
  }

  return [surface, ...tones];
}
