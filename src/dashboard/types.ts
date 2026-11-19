/** Visualization module kinds the dashboard can host. */
export type ModuleKind =
  | 'waveform'
  | 'oscilloscope'
  | 'vectorscope'
  | 'spectrum'
  | 'vu'
  | 'loudness'
  | 'spectrogram';

/**
 * Placement in integer grid cells.
 *
 * Never pixels: the host stores these, and the same layout must survive a change
 * of screen size, column count, or row height.
 */
export interface GridPlacement {
  readonly col: number;
  readonly row: number;
  readonly colSpan: number;
  readonly rowSpan: number;
}

export interface DashboardItem {
  /** Host-owned identity, stable across reorders. */
  readonly id: string;
  readonly kind: ModuleKind;
  /** Hidden items keep their placement so a restore can honour ordering. */
  readonly visible: boolean;
  readonly placement: GridPlacement;
  /** Optional label override; the module default applies when absent. */
  readonly label?: string;
}

export interface DashboardLayout {
  readonly items: readonly DashboardItem[];
}

/** Span limits and column count for layout maths. */
export interface GridConfig {
  readonly columns: number;
  readonly minColSpan: number;
  readonly minRowSpan: number;
  readonly maxColSpan: number;
  readonly maxRowSpan: number;
}

/** Measured geometry the host supplies; pixel width is measured, not assumed. */
export interface GridMetrics {
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
  readonly padding: number;
}

/** A resolved on-screen rectangle in points. */
export interface CellRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One laid-out item, ready for absolute positioning. */
export interface PlacedDashboardItem {
  readonly item: DashboardItem;
  readonly rect: CellRect;
}
