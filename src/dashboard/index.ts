export {
  DEFAULT_GRID_CONFIG,
  GRID_PRESETS,
  gridHeight,
  layoutRects,
} from './geometry';
export {
  assertGridConfig,
  autoPlace,
  compact,
  findSlot,
  fitsInColumns,
  moveItem,
  normalizeLayout,
  rectsOverlap,
  resetLayout,
  resizeItem,
  setVisibility,
} from './layout';
export { DashboardGrid } from './DashboardGrid';
export type { DashboardGridProps } from './DashboardGrid';
export { ModuleCard } from './ModuleCard';
export type { ModuleCardProps } from './ModuleCard';
export { canResize, cardAffordances } from './affordances';
export type { CardAffordances } from './affordances';
export type {
  CellRect,
  DashboardItem,
  DashboardLayout,
  GridConfig,
  GridMetrics,
  GridPlacement,
  ModuleKind,
  PlacedDashboardItem,
} from './types';
