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
  resizeItemToPlacement,
  setVisibility,
} from './layout';
export { DashboardGrid } from './DashboardGrid';
export type { DashboardGridProps } from './DashboardGrid';
export { ModuleCard } from './ModuleCard';
export type { ModuleCardAnimation, ModuleCardDragHandlers } from './ModuleCard';
export {
  DRAG_CANCEL_DISTANCE,
  DRAG_HOLD_MS,
  shouldArmDrag,
  shouldCancelArm,
} from './drag-arm';
export { ModuleTray } from './ModuleTray';
export type { ModuleTrayProps } from './ModuleTray';
export type { ModuleCardProps } from './ModuleCard';
export { canResize, cardAffordances } from './affordances';
export type { CardAffordances } from './affordances';
export {
  cornerZoneSize,
  cornerZones,
  dragDeltaToCells,
  MAX_CORNER_HEIGHT,
  MAX_CORNER_WIDTH,
  resizeCornerToPlacement,
  resizeDeltaToSpans,
} from './gestures';
export type {
  CellTarget,
  CornerZoneSize,
  DragContext,
  ResizeContext,
  ResizeCorner,
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
