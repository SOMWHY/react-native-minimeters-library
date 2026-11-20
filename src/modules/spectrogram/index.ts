export { SpectrogramModule } from './SpectrogramModule';
export type { SpectrogramModuleProps } from './SpectrogramModule';
export { resolveSpectrogramState } from './state';
export {
  buildSpectrogramRamp,
  FALLBACK_RAMP,
  type SpectrogramRampColors,
} from './ramp';
export {
  isSpectrogramValid,
  parseHexColor,
  SPECTROGRAM_GAMMA,
  toSpectrogramPixels,
} from './pixels';
export type { RgbTriple, SpectrogramRaster } from './pixels';
