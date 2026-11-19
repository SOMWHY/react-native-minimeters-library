/**
 * Host-prepared example output — not a server field.
 *
 * The library never runs an FFT: the host application computes magnitude bins
 * in dB and hands them to `SpectrumModule`. This fixture just reproduces what a
 * 64-bin low-resolution analyzer would report for a loud low end that rolls off
 * toward the top of the spectrum.
 */
const BIN_COUNT = 64;

export const spectrumBins = new Float32Array(BIN_COUNT);

for (let index = 0; index < BIN_COUNT; index += 1) {
  const position = index / (BIN_COUNT - 1);
  const rollOff = -18 - position * 54;
  const ripple = Math.sin(position * Math.PI * 7) * 4;

  spectrumBins[index] = Math.max(-90, rollOff + ripple);
}

export const spectrumDbRange = [-90, 0] as const;
