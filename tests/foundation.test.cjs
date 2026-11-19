const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// The package root also exports React Native and Skia components, so it can only
// be loaded by Metro. These contract tests load the pure sub-barrels directly and
// assert that the root barrel still re-exports them.
const { BUILT_IN_THEMES, STRUCTURAL_TOKENS } = require('../dist/theme');
const { isCanvasReady } = require('../dist/drawing/canvas-size');
const { mapLinear } = require('../dist/drawing/coordinates');

test('package root re-exports the pure theme and drawing barrel', () => {
  const rootEntry = readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8');

  assert.match(rootEntry, /\.\/theme/);
  assert.match(rootEntry, /\.\/drawing/);
});

test('maps endpoints, interior values, and reversed axes without clamping', () => {
  assert.equal(mapLinear(0, [0, 10], [0, 100]), 0);
  assert.equal(mapLinear(5, [0, 10], [0, 100]), 50);
  assert.equal(mapLinear(10, [0, 10], [100, 0]), 0);
  assert.equal(mapLinear(15, [0, 10], [0, 100]), 150);
});

test('rejects non-finite values and a degenerate domain', () => {
  assert.throws(() => mapLinear(1, [2, 2], [0, 100]), RangeError);
  assert.throws(() => mapLinear(Number.NaN, [0, 1], [0, 100]), TypeError);
  assert.throws(
    () => mapLinear(1, [0, 1], [0, Number.POSITIVE_INFINITY]),
    TypeError,
  );
});

test('waits for a positive measured canvas size', () => {
  assert.equal(isCanvasReady(0, 120), false);
  assert.equal(isCanvasReady(-1, 120), false);
  assert.equal(isCanvasReady(120, 0), false);
  assert.equal(isCanvasReady(Number.NaN, 80), false);
  assert.equal(isCanvasReady(120, Number.POSITIVE_INFINITY), false);
  assert.equal(isCanvasReady(120, 80), true);
});

test('built-in themes have complete color roles and share no structural fields', () => {
  const themes = Object.values(BUILT_IN_THEMES);
  const colorRoles = [
    'accent',
    'axis',
    'canvas',
    'grid',
    'surface',
    'text',
    'textMuted',
    'traces',
  ];

  assert.deepEqual(themes.map(({ id }) => id).sort(), [
    'ember',
    'ice',
    'midnight',
  ]);
  for (const theme of themes) {
    assert.ok(Object.isFrozen(theme));
    assert.ok(Object.isFrozen(theme.colors));
    assert.ok(Object.isFrozen(theme.colors.traces));
    assert.deepEqual(Object.keys(theme).sort(), ['colors', 'id', 'name']);
    assert.deepEqual(Object.keys(theme.colors).sort(), colorRoles);
    assert.deepEqual(Object.keys(theme.colors.traces).sort(), [
      'high',
      'left',
      'low',
      'mid',
      'primary',
      'right',
      'secondary',
    ]);
    assert.equal('spacing' in theme, false);
  }
  assert.equal(
    new Set(themes.map(({ colors }) => JSON.stringify(colors))).size,
    3,
  );
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS));
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS.spacing));
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS.typography.fontWeight));
  assert.ok(Object.isFrozen(STRUCTURAL_TOKENS.statusColors));
});
