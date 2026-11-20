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

const mutate = require('../dist/dashboard/layout/mutate');

function assertNoOverlap(items, label) {
  const visible = items.filter((entry) => entry.visible);

  for (let a = 0; a < visible.length; a += 1) {
    for (let b = a + 1; b < visible.length; b += 1) {
      assert.equal(
        overlap.rectsOverlap(visible[a].placement, visible[b].placement),
        false,
        `${label}: ${visible[a].id} overlaps ${visible[b].id}`,
      );
    }
  }
}

function placementOf(items, id) {
  return items.find((entry) => entry.id === id).placement;
}

test('a drag places the moved item at the target cell', () => {
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1),
    item('c', 0, 1, 1, 1),
  ];

  const moved = mutate.moveItem(items, 'c', { col: 1, row: 0 }, CONFIG);

  assert.deepEqual(placementOf(moved, 'c'), {
    col: 1,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assert.deepEqual(ids(moved), ['a', 'b', 'c']);
  assertNoOverlap(moved, 'moveItem');
});

test('a drag displaces the occupant instead of swapping shapes', () => {
  const items = [item('small', 0, 0, 1, 1), item('big', 1, 0, 1, 2)];

  const moved = mutate.moveItem(items, 'big', { col: 0, row: 0 }, CONFIG);

  // The 1x2 keeps its span and simply lands lower; shapes never exchange.
  assert.deepEqual(placementOf(moved, 'big'), {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 2,
  });
  assert.equal(placementOf(moved, 'small').rowSpan, 1);
  assert.equal(placementOf(moved, 'small').col, 1);
  assertNoOverlap(moved, 'displacement');
});

test('a drag clamps its target inside the grid', () => {
  // Two modules so the clamped column is observable: clamping is a property of
  // the move itself, not of any compaction pass.
  const items = [item('a', 0, 0, 1, 1), item('b', 0, 1, 1, 1)];

  const moved = mutate.moveItem(items, 'b', { col: 9, row: -3 }, CONFIG);

  assert.deepEqual(placementOf(moved, 'b'), {
    col: 1,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assert.deepEqual(placementOf(moved, 'a'), {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assertNoOverlap(moved, 'clamped drag');
});

test('a resize clamps spans to the configured limits and the column count', () => {
  const items = [item('a', 0, 0, 1, 1)];

  const grown = mutate.resizeItem(items, 'a', { colSpan: 9, rowSpan: 9 }, CONFIG);
  assert.deepEqual(placementOf(grown, 'a'), {
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 4,
  });

  const shrunk = mutate.resizeItem(
    items,
    'a',
    { colSpan: 0, rowSpan: 0 },
    CONFIG,
  );
  assert.deepEqual(placementOf(shrunk, 'a'), {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
});

test('a resize pushes displaced neighbours down and stays overlap-free', () => {
  const items = [item('a', 0, 0, 1, 1), item('b', 1, 0, 1, 1)];

  const resized = mutate.resizeItem(items, 'a', { colSpan: 2, rowSpan: 1 }, CONFIG);

  assert.deepEqual(placementOf(resized, 'a'), {
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
  });
  assert.equal(placementOf(resized, 'b').row, 1);
  assertNoOverlap(resized, 'resize');
});

test('a drag keeps the hole it vacated open', () => {
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1),
    item('c', 0, 1, 1, 1),
  ];

  // 'a' leaves (0,0) empty. Compaction would pull 'c' up into it and shuffle the
  // card the user just placed; a drop must keep its own placement.
  const moved = mutate.moveItem(items, 'a', { col: 1, row: 1 }, CONFIG);

  assert.deepEqual(placementOf(moved, 'a'), {
    col: 1,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
  });
  assert.deepEqual(placementOf(moved, 'b'), {
    col: 1,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assert.deepEqual(placementOf(moved, 'c'), {
    col: 0,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
  });
  assertNoOverlap(moved, 'drag hole');
});

test('a resize keeps the rows it freed open', () => {
  const items = [item('a', 0, 0, 1, 2), item('b', 1, 0, 1, 1)];

  const shrunk = mutate.resizeItem(items, 'a', { colSpan: 1, rowSpan: 1 }, CONFIG);

  assert.deepEqual(placementOf(shrunk, 'a'), {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assert.deepEqual(placementOf(shrunk, 'b'), {
    col: 1,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
  assertNoOverlap(shrunk, 'resize hole');
});

test('hiding keeps the item and its placement, and compacts the rest', () => {
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1),
    item('c', 0, 1, 1, 1),
  ];

  const hidden = mutate.setVisibility(items, 'a', false, CONFIG);

  assert.equal(hidden.length, 3);
  assert.equal(hidden.find((entry) => entry.id === 'a').visible, false);
  assert.deepEqual(placementOf(hidden, 'a'), items[0].placement);
  assertNoOverlap(hidden, 'hide');
});

test('restoring a hidden module lands in a free slot', () => {
  const items = [
    item('a', 0, 0, 1, 1, false),
    item('b', 0, 0, 1, 1),
  ];

  const restored = mutate.setVisibility(items, 'a', true, CONFIG);

  assert.equal(restored.find((entry) => entry.id === 'a').visible, true);
  assertNoOverlap(restored, 'restore');
  assert.deepEqual(ids(restored), ['a', 'b']);
});

test('normalization clamps spans when the column count shrinks', () => {
  const items = [item('wide', 0, 0, 4, 1), item('tall', 0, 1, 1, 2)];

  const normalized = mutate.normalizeLayout(items, { ...CONFIG, columns: 2 });

  assert.ok(
    overlap.fitsInColumns(placementOf(normalized, 'wide'), 2),
    'wide item must fit two columns',
  );
  assertNoOverlap(normalized, 'normalize');
});

test('normalization rejects an impossible grid config', () => {
  assert.throws(() =>
    mutate.normalizeLayout([item('a', 0, 0, 1, 1)], {
      ...CONFIG,
      columns: 1,
      maxColSpan: 2,
    }),
  );
});

test('layout mutations are deterministic for identical input', () => {
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 1, 1, 1),
    item('c', 0, 2, 2, 1),
  ];

  assert.deepEqual(
    mutate.normalizeLayout(items, CONFIG),
    mutate.normalizeLayout(items, CONFIG),
  );
  assert.deepEqual(
    mutate.moveItem(items, 'c', { col: 0, row: 0 }, CONFIG),
    mutate.moveItem(items, 'c', { col: 0, row: 0 }, CONFIG),
  );
});

test('reset shows every module and compacts the grid', () => {
  const items = [
    item('a', 0, 3, 1, 1, false),
    item('b', 1, 5, 1, 1),
  ];

  const reset = mutate.resetLayout(items, CONFIG);

  assert.ok(reset.every((entry) => entry.visible));
  assert.deepEqual(ids(reset), ['a', 'b']);
  assertNoOverlap(reset, 'reset');
  assert.deepEqual(placementOf(reset, 'a'), {
    col: 0,
    row: 0,
    colSpan: 1,
    rowSpan: 1,
  });
});

test('lays out all seven modules on a two-column phone grid', () => {
  const metrics = geometry.GRID_PRESETS.phone;
  const cellWidth = 120;
  const items = [
    item('waveform', 0, 0, 2, 1),
    item('oscilloscope', 0, 1, 1, 1),
    item('vectorscope', 1, 1, 1, 1),
    item('spectrum', 0, 2, 2, 1),
    item('vu', 0, 3, 1, 1),
    item('loudness', 1, 3, 1, 1),
    item('spectrogram', 0, 4, 2, 1),
  ];

  const placed = geometry.layoutRects(items, metrics, cellWidth);

  assert.equal(placed.length, 7);
  assert.deepEqual(placed[0].rect, {
    x: 12,
    y: 12,
    width: cellWidth * 2 + 8,
    height: 96,
  });
  assert.deepEqual(placed[3].rect, {
    x: 12,
    y: 12 + 2 * (96 + 8),
    width: cellWidth * 2 + 8,
    height: 96,
  });
  assert.deepEqual(placed[6].rect, {
    x: 12,
    y: 12 + 4 * (96 + 8),
    width: cellWidth * 2 + 8,
    height: 96,
  });
  assert.equal(geometry.gridHeight(items, metrics), 24 + 5 * 96 + 4 * 8);
});

test('the container height ignores hidden modules', () => {
  const metrics = geometry.GRID_PRESETS.phone;
  const items = [item('a', 0, 0, 1, 1), item('b', 0, 6, 1, 1, false)];

  assert.equal(geometry.gridHeight(items, metrics), 24 + 96);
});

test('the package root re-exports the dashboard surface', () => {
  const root = require('node:fs').readFileSync(
    path.join(ROOT, 'dist', 'index.js'),
    'utf8',
  );
  const dashboard = require('node:fs').readFileSync(
    path.join(ROOT, 'dist', 'dashboard', 'index.js'),
    'utf8',
  );

  assert.match(root, /\.\/dashboard/);
  assert.match(dashboard, /layoutRects/);
  assert.match(dashboard, /DashboardGrid/);
});

test('edit mode is the only source of drag and resize affordances', () => {
  const { cardAffordances } = require('../dist/dashboard/affordances');

  assert.deepEqual(cardAffordances(true), {
    draggable: true,
    resizable: true,
    hideable: true,
  });
  assert.deepEqual(cardAffordances(false), {
    draggable: false,
    resizable: false,
    hideable: false,
  });
});

test('a resize is refused when it would break a span limit', () => {
  const { canResize } = require('../dist/dashboard/affordances');
  const placement = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };

  assert.equal(canResize(placement, { dCols: 1, dRows: 1 }, CONFIG), true);
  assert.equal(canResize(placement, { dCols: 2, dRows: 0 }, CONFIG), false);
  assert.equal(canResize(placement, { dCols: -1, dRows: 0 }, CONFIG), false);
  assert.equal(canResize(placement, { dCols: 0, dRows: 4 }, CONFIG), false);

  // One column of room left: a second column of growth cannot fit.
  const atRightEdge = { col: 1, row: 0, colSpan: 1, rowSpan: 1 };
  assert.equal(canResize(atRightEdge, { dCols: 1, dRows: 0 }, CONFIG), false);
});

test('the module card keeps its handles out of non-edit mode', () => {
  const card = require('node:fs').readFileSync(
    path.join(ROOT, 'dist', 'dashboard', 'ModuleCard.js'),
    'utf8',
  );

  assert.match(card, /cardAffordances/);
  assert.match(card, /accessibilityRole/);
  assert.match(card, /accessibilityLabel/);
  // Handles are inside an `affordances.x ? ... : null` branch, never a disabled prop.
  assert.doesNotMatch(card, /disabled[=:]/);
});

test('a sub-cell drag keeps the item in its own cell', () => {
  const { dragDeltaToCells } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    placement: { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
  };

  // Below half a cell in both directions: no cell is claimed yet.
  assert.deepEqual(
    dragDeltaToCells({ dx: 50, dy: 40 }, context),
    { col: 1, row: 2 },
  );
});

test('a drag of 1.6 cells rounds to two cells', () => {
  const { dragDeltaToCells } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    placement: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  };

  const target = dragDeltaToCells({ dx: 1.6 * 108, dy: 0 }, context);

  assert.equal(target.col, 2);
  assert.equal(target.row, 0);
});

test('a drag never leaves the grid', () => {
  const { dragDeltaToCells } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    placement: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  };

  assert.deepEqual(
    dragDeltaToCells({ dx: -3000, dy: -3000 }, context),
    { col: 0, row: 0 },
  );
});

test('a wide card cannot be dragged past the right edge', () => {
  const { dragDeltaToCells } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    columns: 2,
    placement: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
  };

  const target = dragDeltaToCells({ dx: 108, dy: 0 }, context);

  // The card is two columns wide on a two-column grid, so it cannot move right.
  assert.equal(target.col, 0);
  assert.equal(target.row, 0);
});

test('a drag with an unmeasured cell width does not move the item', () => {
  const { dragDeltaToCells } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 0,
    rowHeight: 96,
    gap: 8,
    placement: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  };

  assert.deepEqual(
    dragDeltaToCells({ dx: 200, dy: 200 }, context),
    { col: 1, row: 1 },
  );
});

test('a sub-cell resize keeps the current spans', () => {
  const { resizeDeltaToSpans } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    columns: 2,
    placement: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    config: CONFIG,
  };

  assert.deepEqual(
    resizeDeltaToSpans({ dx: 40, dy: 40 }, context),
    { colSpan: 1, rowSpan: 1 },
  );
});

test('a resize steps by whole cells and stops at the maximum span', () => {
  const { resizeDeltaToSpans } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    columns: 4,
    placement: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    config: { ...CONFIG, columns: 4, maxColSpan: 2, maxRowSpan: 2 },
  };

  assert.deepEqual(
    resizeDeltaToSpans({ dx: 108, dy: 104 }, context),
    { colSpan: 2, rowSpan: 2 },
  );
  // Well past the maximum: the span pins at max, never overshoots.
  assert.deepEqual(
    resizeDeltaToSpans({ dx: 5000, dy: 5000 }, context),
    { colSpan: 2, rowSpan: 2 },
  );
});

test('a resize cannot grow past the right edge of the grid', () => {
  const { resizeDeltaToSpans } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    columns: 2,
    placement: { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    config: CONFIG,
  };

  // Only one column of room is left, so the span stays at one.
  assert.deepEqual(
    resizeDeltaToSpans({ dx: 216, dy: 0 }, context),
    { colSpan: 1, rowSpan: 1 },
  );
});

test('a resize never shrinks below the minimum span', () => {
  const { resizeDeltaToSpans } = require('../dist/dashboard/gestures');
  const context = {
    cellWidth: 100,
    rowHeight: 96,
    gap: 8,
    columns: 4,
    placement: { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    config: CONFIG,
  };

  assert.deepEqual(
    resizeDeltaToSpans({ dx: -5000, dy: -5000 }, context),
    { colSpan: 1, rowSpan: 1 },
  );
});

test('the tray lists exactly the hidden modules, in layout order', () => {
  const { hiddenItems } = require('../dist/dashboard/layout');
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 0, 1, 1, 1, false),
    item('c', 1, 1, 1, 1, false),
  ];

  assert.deepEqual(
    hiddenItems(items).map((entry) => entry.id),
    ['b', 'c'],
  );
  assert.deepEqual(hiddenItems([]), []);
});

test('hiding then restoring keeps the layout overlap-free and unchanged in size', () => {
  const { hiddenItems } = require('../dist/dashboard/layout');
  const items = [
    item('a', 0, 0, 1, 1),
    item('b', 1, 0, 1, 1),
    item('c', 0, 1, 2, 1),
  ];

  const hidden = mutate.setVisibility(items, 'b', false, CONFIG);
  assert.deepEqual(
    hiddenItems(hidden).map((entry) => entry.id),
    ['b'],
  );

  const restored = mutate.setVisibility(hidden, 'b', true, CONFIG);

  assert.equal(restored.length, 3);
  assert.ok(restored.every((entry) => entry.visible));
  assertNoOverlap(restored, 'restored');
  assert.deepEqual(
    restored.map((entry) => entry.id).sort(),
    ['a', 'b', 'c'],
  );
});

test('the tray renders nothing when no module is hidden', () => {
  const tray = require('node:fs').readFileSync(
    path.join(ROOT, 'dist', 'dashboard', 'ModuleTray.js'),
    'utf8',
  );

  // An empty tray returns null before building any view.
  assert.match(tray, /hidden\.length === 0/);
  assert.match(tray, /accessibilityLabel/);
  assert.match(tray, /onRestore/);
});

// --- hold-to-drag arming -----------------------------------------------------

const dragArm = require('../dist/dashboard/drag-arm');

test('a hold arms the drag only after the threshold', () => {
  assert.equal(
    dragArm.shouldArmDrag(dragArm.DRAG_HOLD_MS - 1, 0),
    false,
    'a tap-length press must not arm',
  );
  assert.equal(dragArm.shouldArmDrag(dragArm.DRAG_HOLD_MS, 0), true);
});

test('a hold that drifted is a scroll, not a drag', () => {
  assert.equal(
    dragArm.shouldArmDrag(dragArm.DRAG_HOLD_MS, dragArm.DRAG_CANCEL_DISTANCE),
    true,
    'drifting exactly to the slop is still a hold',
  );
  assert.equal(
    dragArm.shouldArmDrag(
      dragArm.DRAG_HOLD_MS,
      dragArm.DRAG_CANCEL_DISTANCE + 1,
    ),
    false,
  );
});

test('drift beyond the slop cancels a pending arm', () => {
  assert.equal(dragArm.shouldCancelArm(dragArm.DRAG_CANCEL_DISTANCE), false);
  assert.equal(dragArm.shouldCancelArm(dragArm.DRAG_CANCEL_DISTANCE + 0.5), true);
});

test('the drag surface covers the whole card', () => {
  const card = require('node:fs').readFileSync(
    path.join(ROOT, 'dist', 'dashboard', 'ModuleCard.js'),
    'utf8',
  );

  // No grab bar: the card itself carries the responders, so any point drags.
  assert.doesNotMatch(card, /grabBar/);
  assert.match(card, /dragHandlers/);
  // The resize corners clear the touch-target floor with their slop and are sized
  // from the card, so all four fit a one-row card without overlapping.
  assert.match(card, /CORNERS/);
  assert.match(card, /CORNER_HIT_SLOP = 8/);
  assert.match(card, /accessibilityLabel: `Resize/);
});

// --- corner resize math -------------------------------------------------
// One column is 100 px wide with an 8 px gap, so a cell pitch is 108 x 104.

const WIDE = {
  columns: 3,
  minColSpan: 1,
  minRowSpan: 1,
  maxColSpan: 3,
  maxRowSpan: 4,
};

function resizeContext(placement, config) {
  return { cellWidth: 100, rowHeight: 96, gap: 8, placement, config };
}

test('the bottom-right corner grows spans without moving the origin', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('bottom-right', { dx: 108, dy: 104 }, resizeContext(
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      CONFIG,
    )),
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  );
});

test('the bottom-right corner stops at the grid edge and the max span', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  // Two columns are already the whole grid; dragging further must not overflow.
  assert.deepEqual(
    resizeCornerToPlacement('bottom-right', { dx: 540, dy: 5 * 104 }, resizeContext(
      { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
      CONFIG,
    )),
    { col: 0, row: 0, colSpan: 2, rowSpan: 4 },
  );
});

test('the bottom-left corner moves the origin left and widens the card', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('bottom-left', { dx: -108, dy: 104 }, resizeContext(
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  );
});

test('the bottom-left corner cannot grow past the grid origin', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('bottom-left', { dx: -500, dy: 0 }, resizeContext(
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  );
});

test('the top-left corner moves both the origin and both spans', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('top-left', { dx: -108, dy: -104 }, resizeContext(
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  );
});

test('the top-right corner moves the origin up and widens to the right', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('top-right', { dx: 108, dy: -104 }, resizeContext(
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  );
});

test('shrinking below the minimum span holds the anchored edge still', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  // Dragging the left edge right can only shrink to one column; the right edge
  // must not follow the finger past it.
  assert.deepEqual(
    resizeCornerToPlacement('bottom-left', { dx: 300, dy: 0 }, resizeContext(
      { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
      WIDE,
    )),
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
  );
});

test('a top edge drag at row zero cannot pull the card above the grid', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('top-left', { dx: 0, dy: -104 }, resizeContext(
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  );
});

test('sub-cell drags leave the placement untouched', () => {
  const { resizeCornerToPlacement } = require('../dist/dashboard/gestures');

  assert.deepEqual(
    resizeCornerToPlacement('top-left', { dx: -20, dy: -20 }, resizeContext(
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      WIDE,
    )),
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  );
});

test('a corner resize applies the whole placement and pushes neighbours', () => {
  const items = [item('a', 0, 0, 1, 1), item('b', 1, 0, 1, 1)];

  const resized = mutate.resizeItemToPlacement(
    items,
    'a',
    { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
    CONFIG,
  );

  assert.deepEqual(placementOf(resized, 'a'), {
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
  });
  assert.equal(placementOf(resized, 'b').row, 1);
  assertNoOverlap(resized, 'corner resize');
});

test('a corner resize keeps the origin when it grew from the left edge', () => {
  const items = [item('a', 1, 0, 1, 1)];

  const resized = mutate.resizeItemToPlacement(
    items,
    'a',
    { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
    CONFIG,
  );

  assert.deepEqual(placementOf(resized, 'a'), {
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
  });
});

test('a corner resize clamps a placement the grid cannot hold', () => {
  const items = [item('a', 0, 0, 1, 1)];

  const resized = mutate.resizeItemToPlacement(
    items,
    'a',
    { col: 5, row: -3, colSpan: 9, rowSpan: 9 },
    CONFIG,
  );

  assert.deepEqual(placementOf(resized, 'a'), {
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 4,
  });
});

test('corner handles tile a one-row card without overlapping', () => {
  const { cornerZones } = require('../dist/dashboard/gestures');
  const zones = cornerZones(360, 56);

  // Half the card height each, so top and bottom never collide on a short card.
  assert.deepEqual(zones['top-left'], { x: 0, y: 0, width: 64, height: 28 });
  assert.deepEqual(zones['bottom-right'], {
    x: 296,
    y: 28,
    width: 64,
    height: 28,
  });
  assert.ok(zones['top-left'].y + zones['top-left'].height <= zones['bottom-left'].y);
  assert.ok(zones['top-left'].x + zones['top-left'].width <= zones['top-right'].x);
});

test('corner handle sizes cap out on a tall card', () => {
  const { cornerZoneSize } = require('../dist/dashboard/gestures');

  assert.deepEqual(cornerZoneSize(600, 400), { width: 64, height: 40 });
  // A narrow card halves rather than overflowing.
  assert.deepEqual(cornerZoneSize(80, 400), { width: 40, height: 40 });
});
