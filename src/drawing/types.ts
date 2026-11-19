import type { SharedValue } from './reanimated';

import { STRUCTURAL_TOKENS } from '../theme/structural-tokens';
import type { VisualizationColors, VisualizationTheme } from '../theme/types';
import type { NumericRange } from './coordinates';

export interface AnimatedVisualizationColors {
  readonly canvas: SharedValue<string>;
  readonly surface: SharedValue<string>;
  readonly grid: SharedValue<string>;
  readonly axis: SharedValue<string>;
  readonly text: SharedValue<string>;
  readonly textMuted: SharedValue<string>;
  readonly accent: SharedValue<string>;
  readonly traces: {
    readonly primary: SharedValue<string>;
    readonly secondary: SharedValue<string>;
    readonly left: SharedValue<string>;
    readonly right: SharedValue<string>;
    readonly low: SharedValue<string>;
    readonly mid: SharedValue<string>;
    readonly high: SharedValue<string>;
  };
}

export interface DrawingContextValue {
  width: number;
  height: number;
  theme: VisualizationTheme;
  colors: AnimatedVisualizationColors;
  tokens: typeof STRUCTURAL_TOKENS;
  mapX(value: number, domain: NumericRange): number;
  mapY(value: number, domain: NumericRange): number;
}

export type VisualizationColorRole = Exclude<keyof VisualizationColors, 'traces'>;
export type TraceColorRole = keyof VisualizationColors['traces'];
