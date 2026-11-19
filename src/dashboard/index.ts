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
  hiddenItems,
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
export { ModuleTray } from './ModuleTray';
export type { ModuleTrayProps } from './ModuleTray';
export type { ModuleCardProps } from './ModuleCard';
export { canResize, cardAffordances } from './affordances';
export type { CardAffordances } from './affordances';
export { dragDeltaToCells, resizeDeltaToSpans } from './gestures';
export type {
  CellTarget,
  DragContext,
  ResizeContext,
  SpanTarget,
} from './gestures';
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
