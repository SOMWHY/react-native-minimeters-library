/**
 * Pure rasterizer for the spectrogram module.
 *
 * No React Native and no Skia imports: the host hands over normalized rows and
 * a color ramp, and this turns them into an RGBA byte buffer. Keeping it pure
 * makes the pixel layout testable in Node.
 *
 * Orientation: time is the horizontal axis (newest on the right) and frequency
 * is the vertical axis with the lowest bin at the bottom, matching how the
 * desktop app is read.
 */

const ALPHA_OPAQUE = 255;
const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Intensity curve applied to every cell.
 *
 * Raw linear magnitudes put most musical material in the bottom two ramp stops,
 * so the plot reads as a flat wash. A sub-one exponent lifts quiet detail into
 * visible contrast while leaving full-scale energy at full brightness.
 */
export const SPECTROGRAM_GAMMA = 0.75;

export type RgbTriple = readonly [number, number, number];

export interface SpectrogramRaster {
  readonly width: number;
  readonly height: number;
  /** RGBA bytes, row-major, `width * height * 4` long. */
  readonly bytes: Uint8Array;
}

/** Parses `#rgb`, `#rrggbb`, or `#rrggbbaa` into an RGB triple. */
export function parseHexColor(value: string): RgbTriple | null {
  const match = HEX_PATTERN.exec(value.trim());

  if (match === null) {
    return null;
  }

  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((character) => character + character)
          .join('')
      : match[1];

  const parsed = Number.parseInt(hex.slice(0, 6), 16);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return [(parsed >> 16) & 0xff, (parsed >> 8) & 0xff, parsed & 0xff];
}

/** True when every row has the same non-zero length and every value is finite. */
export function isSpectrogramValid(
  rows: ArrayLike<ArrayLike<number>>,
): boolean {
  if (rows.length === 0) {
    return false;
  }

  const width = rows[0].length;

  if (width === 0) {
    return false;
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    if (row.length !== width) {
      return false;
    }

    for (let binIndex = 0; binIndex < row.length; binIndex += 1) {
      if (!Number.isFinite(Number(row[binIndex]))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Rasterizes normalized rows (`0..1`, oldest first) into RGBA bytes.
 *
 * The image is drawn the way a spectrogram is read on screen: **time runs
 * across** (`width` is one column per row, oldest on the left, newest on the
 * right) and **frequency runs up** (`height` is one pixel row per bin, bin 0 —
 * the lowest frequency — in the *last* row, so bass sits at the bottom).
 *
 * `maxRows` keeps the newest rows: anything older is trimmed from the front so
 * the newest audio always lands in the same place on screen. Ragged rows pad
 * with silence instead of throwing; callers use `isSpectrogramValid` to report
 * a structurally broken stream.
 */
export function toSpectrogramPixels(
  rows: ArrayLike<ArrayLike<number>>,
  maxRows: number,
  ramp: ReadonlyArray<RgbTriple>,
  gamma = 1,
): SpectrogramRaster {
  const limit = Math.max(1, Math.floor(maxRows) || 1);
  const firstRow = Math.max(0, rows.length - limit);
  const width = Math.min(rows.length, limit);
  const stops: ReadonlyArray<RgbTriple> =
    ramp.length > 0 ? ramp : ([[0, 0, 0]] as ReadonlyArray<RgbTriple>);

  let height = 0;

  for (let rowIndex = firstRow; rowIndex < rows.length; rowIndex += 1) {
    height = Math.max(height, rows[rowIndex].length);
  }

  if (width === 0 || height === 0) {
    return { width: 0, height: 0, bytes: new Uint8Array(0) };
  }

  const bytes = new Uint8Array(width * height * 4);

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const row = rows[firstRow + columnIndex];

    for (let binIndex = 0; binIndex < height; binIndex += 1) {
      const value = binIndex < row.length ? Number(row[binIndex]) : 0;
      const clamped = Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : 0;
      const unit =
        gamma === 1 || clamped === 0 ? clamped : Math.pow(clamped, gamma);
      const stopIndex = Math.min(
        stops.length - 1,
        Math.floor(unit * stops.length),
      );
      const stop = stops[stopIndex];
      const imageRow = height - 1 - binIndex;
      const offset = (imageRow * width + columnIndex) * 4;

      bytes[offset] = stop[0];
      bytes[offset + 1] = stop[1];
      bytes[offset + 2] = stop[2];
      bytes[offset + 3] = ALPHA_OPAQUE;
    }
  }

  return { width, height, bytes };
}
