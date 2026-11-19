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

const overlap = require('../dist/dashboard/layout/overlap');
const placement = require('../dist/dashboard/layout/placement');
const compact = require('../dist/dashboard/layout/compact');

const CONFIG = {
  columns: 2,
  minColSpan: 1,
  minRowSpan: 1,
  maxColSpan: 2,
  maxRowSpan: 4,
};

function ids(items) {
  return items.map((entry) => entry.id);
}

test('treats edge-adjacent rectangles as not overlapping', () => {
  const a = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };

  assert.equal(
    overlap.rectsOverlap(a, { col: 1, row: 0, colSpan: 1, rowSpan: 1 }),
    false,
  );
  assert.equal(
    overlap.rectsOverlap(a, { col: 0, row: 1, colSpan: 1, rowSpan: 1 }),
    false,
  );
  assert.equal(
    overlap.rectsOverlap(a, { col: 0, row: 0, colSpan: 2, rowSpan: 2 }),
    true,
  );
  assert.equal(
    overlap.rectsOverlap(a, { col: 0, row: 0, colSpan: 1, rowSpan: 1 }),
    true,
  );
});

test('rejects a grid config whose max span exceeds the column count', () => {
  assert.throws(() =>
    overlap.assertGridConfig({ ...CONFIG, columns: 2, maxColSpan: 3 }),
  );
  assert.throws(() => overlap.assertGridConfig({ ...CONFIG, columns: 0 }));
  assert.doesNotThrow(() => overlap.assertGridConfig(CONFIG));
});

test('finds the first free slot scanning top-left to bottom-right', () => {
  // A hole to the right wins over a hole further down.
  const items = [item('a', 0, 0, 1, 1), item('b', 0, 1, 1, 1)];

  const slot = placement.findSlot(
    items,
    { id: 'new', colSpan: 1, rowSpan: 1 },
    2,
  );

  assert.deepEqual(slot, { col: 1, row: 0, colSpan: 1, rowSpan: 1 });
});

test('reports no hole for an empty or gapless layout', () => {
  // Nothing exists yet, so there is no row to search: the caller must grow.
  assert.equal(
    placement.findSlot([], { id: 'new', colSpan: 1, rowSpan: 1 }, 2),
    null,
  );

  const gapless = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1),
    item('c', 0, 1, 1, 1),
    item('d', 1, 1, 1, 1),
  ];

  assert.equal(
    placement.findSlot(gapless, { id: 'new', colSpan: 1, rowSpan: 1 }, 2),
    null,
  );
});

test('never reports a hole wider than the grid', () => {
  const items = [item('a', 0, 0, 1, 1)];

  // A 3-wide candidate cannot fit in a 2-column grid, so there is no hole.
  assert.equal(
    placement.findSlot(items, { id: 'w', colSpan: 3, rowSpan: 1 }, 2),
    null,
  );
  // A 2-wide candidate needs a whole row: the only existing row is taken.
  assert.equal(
    placement.findSlot(items, { id: 'w', colSpan: 2, rowSpan: 1 }, 2),
    null,
  );
  // A free row above an occupied one is a valid hole for a 2-wide candidate.
  assert.deepEqual(
    placement.findSlot(
      [item('a', 0, 1, 1, 1)],
      { id: 'w', colSpan: 2, rowSpan: 1 },
      2,
    ),
    { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
  );
});

test('auto placement grows a new row instead of dropping an item', () => {
  const full = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 2, 1),
  ];

  const placed = placement.autoPlace(full, { ...CONFIG, columns: 1 });

  assert.equal(placed.length, full.length);
  assert.deepEqual(ids(placed), ['a', 'b']);
  for (const entry of placed) {
    assert.ok(
      overlap.fitsInColumns(entry.placement, 1),
      `${entry.id} must stay inside one column`,
    );
  }
});

test('gravity fill pulls modules up and left without changing spans', () => {
  const items = [
    item('a', 0, 2, 1, 1),
    item('b', 1, 3, 1, 1),
  ];

  const filled = compact.compact(items, CONFIG);

  assert.deepEqual(
    filled.map((entry) => entry.placement),
    [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    ],
  );
});

test('gravity fill is idempotent', () => {
  const items = [
    item('a', 0, 1, 2, 1),
    item('b', 0, 3, 1, 1),
  ];

  const once = compact.compact(items, CONFIG);
  const twice = compact.compact(once, CONFIG);

  assert.deepEqual(twice, once);
});

test('gravity fill leaves hidden items exactly where they were', () => {
  const items = [item('hidden', 0, 4, 1, 1, false), item('shown', 0, 2, 1, 1)];

  const filled = compact.compact(items, CONFIG);

  assert.deepEqual(filled[0].placement, items[0].placement);
  assert.deepEqual(filled[1].placement, {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
});
