/**
 * Host-prepared example history — not a server field.
 *
 * The library never runs an FFT: the host application computes normalized
 * magnitude rows (`0..1`, oldest first) and hands them to `SpectrogramModule`.
 * This fixture fakes a millisecond-scale history with a moving formant so the
 * scrolling image has something to show.
 */
const ROW_COUNT = 64;
const BIN_COUNT = 48;

export const spectrogramRows: number[][] = [];

for (let row = 0; row < ROW_COUNT; row += 1) {
  const time = row / (ROW_COUNT - 1);
  const formant = 0.25 + Math.sin(time * Math.PI * 2) * 0.15;
  const bins: number[] = [];

  for (let bin = 0; bin < BIN_COUNT; bin += 1) {
    const position = bin / (BIN_COUNT - 1);
    const distance = Math.abs(position - formant);
    const energy = Math.max(0, 1 - distance * 4) * (1 - time * 0.4);

    bins.push(Math.min(1, energy));
  }

  spectrogramRows.push(bins);
}
