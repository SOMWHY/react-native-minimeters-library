const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
});

const radii = Object.freeze({
  sm: 4,
  md: 8,
  lg: 12,
});

const fontWeight = Object.freeze({
  regular: '400',
  medium: '500',
  bold: '700',
});

const typography = Object.freeze({
  fontFamily: 'monospace',
  fontWeight,
  micro: 9,
  label: 11,
  body: 13,
  heading: 16,
});

const strokeWidth = Object.freeze({
  hairline: 0.75,
  fine: 1,
  regular: 1.5,
  strong: 2,
});

const grid = Object.freeze({
  subdivisions: 4,
});

const hierarchy = Object.freeze({
  background: 0,
  grid: 1,
  trace: 2,
  label: 3,
  overlay: 4,
});

const statusColors = Object.freeze({
  good: '#55D68B',
  warning: '#F4C95D',
  error: '#FF5A6F',
});

const motion = Object.freeze({
  themeTransitionMs: 180,
});

export const STRUCTURAL_TOKENS = Object.freeze({
  spacing,
  radii,
  typography,
  strokeWidth,
  grid,
  hierarchy,
  statusColors,
  motion,
});
