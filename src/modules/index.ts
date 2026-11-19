export { ModuleSurface } from './ModuleSurface';
export type { ModuleSurfaceProps } from './ModuleSurface';

export {
  DEFAULT_DB_RANGE,
  clampUnit,
  normalizeBins,
  toEnvelopeColumns,
  toMeterScale,
  toStereoPoints,
  toTraceSamples,
} from './display';

export { resolvePcmState } from './pcm';

export {
  OscilloscopeModule,
  resolveOscilloscopeState,
  type OscilloscopeModuleProps,
} from './oscilloscope';

export {
  WaveformModule,
  resolveWaveformState,
  type WaveformModuleProps,
} from './waveform';

export type {
  EnvelopeColumns,
  ModuleBaseProps,
  ModuleStatus,
  PcmBlock,
  StereoPoint,
} from './types';
