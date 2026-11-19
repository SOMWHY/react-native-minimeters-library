const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// Dashboard layout maths is pure, so these tests load the compiled helpers and
// never touch React Native, Skia, or a device.
const geometry = require('../dist/dashboard/geometry');

const ROOT = path.join(__dirname, '..');

function item(id, col, row, colSpan, rowSpan, visible = true) {
  return {
    id,
    kind: 'waveform',
    visible,
    placement: { col, row, colSpan, rowSpan },
  };
}

test('maps a single 1x1 cell to the padded origin', () => {
  const metrics = { columns: 2, rowHeight: 100, gap: 10, padding: 6 };

  const rects = geometry.layoutRects([item('a', 0, 0, 1, 1)], metrics, 50);

  assert.deepEqual(rects, [
    {
      item: item('a', 0, 0, 1, 1),
      rect: { x: 6, y: 6, width: 50, height: 100 },
    },
  ]);
});

test('accounts for the gap on both axes for a 2x2 span', () => {
  const metrics = { columns: 4, rowHeight: 40, gap: 8, padding: 10 };

  const [entry] = geometry.layoutRects([item('a', 1, 2, 2, 2)], metrics, 30);

  // x = 10 + 1*(30+8), y = 10 + 2*(40+8)
  assert.deepEqual(entry.rect, {
    x: 48,
    y: 106,
    width: 30 * 2 + 8,
    height: 40 * 2 + 8,
  });
});

test('keeps the declared item order and skips hidden items', () => {
  const metrics = { columns: 2, rowHeight: 10, gap: 0, padding: 0 };
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1, false),
    item('c', 0, 1, 1, 1),
  ];

  const ids = geometry.layoutRects(items, metrics, 20).map(({ item }) => item.id);

  assert.deepEqual(ids, ['a', 'c']);
});

test('reports zero height for a layout with nothing visible', () => {
  const metrics = { columns: 2, rowHeight: 10, gap: 4, padding: 6 };

  assert.equal(geometry.gridHeight([], metrics), 0);
  assert.equal(
    geometry.gridHeight([item('a', 0, 0, 1, 1, false)], metrics),
    0,
  );
});

test('reports the bottom edge plus padding for a populated grid', () => {
  const metrics = { columns: 2, rowHeight: 10, gap: 4, padding: 6 };

  // One 1x2 item at row 0: 6 + 10 + 4 + 10 + 6 = 36.
  assert.equal(geometry.gridHeight([item('a', 0, 0, 1, 2)], metrics), 36);
});

test('ships phone and tablet grid presets with a usable default config', () => {
  assert.equal(geometry.GRID_PRESETS.phone.columns, 2);
  assert.equal(geometry.GRID_PRESETS.tablet.columns, 4);
  assert.ok(geometry.DEFAULT_GRID_CONFIG.minColSpan >= 1);
  assert.ok(
    geometry.DEFAULT_GRID_CONFIG.maxColSpan >=
      geometry.DEFAULT_GRID_CONFIG.minColSpan,
  );
});

test('ships the dashboard barrel', () => {
  assert.ok(existsSync(path.join(ROOT, 'dist/dashboard/index.js')));
});
