import type { StyleProp, ViewStyle } from 'react-native';

import type { VisualizationTheme } from '../theme/types';

/**
 * Resolved render state of a visualization module.
 *
 * - `ready`: required values are present, finite, and structurally consistent.
 * - `waiting`: the required prop is absent, `null`, or empty.
 * - `invalid`: the required prop is present but non-finite or inconsistent.
 */
export type ModuleStatus = 'ready' | 'waiting' | 'invalid';

/**
 * The documented server audio block, structurally.
 *
 * `samples` is interleaved (`L0, R0, L1, R1, ...`); this type deliberately does
 * not import the host application's decoder types.
 */
export interface PcmBlock {
  readonly samples: ArrayLike<number>;
  readonly channels: number;
  readonly samplesPerChannel: number;
}

/** One decimated column of a waveform envelope. */
export interface EnvelopeColumns {
  readonly min: Float32Array;
  readonly max: Float32Array;
}

/** One projected stereo sample in goniometer coordinates. */
export interface StereoPoint {
  readonly x: number;
  readonly y: number;
}

/** Props shared by every visualization module. */
export interface ModuleBaseProps {
  readonly theme: VisualizationTheme;
  /** Fixed surface height in dp. */
  readonly height?: number;
  /** Optional caption rendered in the surface corner. */
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
}
