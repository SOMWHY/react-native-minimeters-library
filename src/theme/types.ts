export interface VisualizationColors {
  readonly canvas: string;
  readonly surface: string;
  readonly grid: string;
  readonly axis: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly traces: {
    readonly primary: string;
    readonly secondary: string;
    readonly left: string;
    readonly right: string;
    readonly low: string;
    readonly mid: string;
    readonly high: string;
  };
}

export interface VisualizationTheme {
  readonly id: string;
  readonly name: string;
  readonly colors: VisualizationColors;
}
