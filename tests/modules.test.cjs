const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// Modules are React Native components, so these tests load only the pure
// display-preparation layer and assert the component files exist on disk.
const display = require('../dist/modules/display');

const ROOT = path.join(__dirname, '..');

const stereoBlock = {
  // Interleaved L0,R0,L1,R1,...
  samples: [0, 0, 0.25, -0.25, 0.5, -0.5, 0, 0],
  channels: 2,
  samplesPerChannel: 4,
};

const silentBlock = {
  samples: [0, 0, 0, 0, 0, 0, 0, 0],
  channels: 2,
  samplesPerChannel: 4,
};

const nanBlock = {
  samples: [Number.NaN, 0, Number.POSITIVE_INFINITY, 0, 0, 0, 0, 0],
  channels: 2,
  samplesPerChannel: 4,
};

function assertAllFinite(values, label) {
  for (let index = 0; index < values.length; index += 1) {
    assert.ok(
      Number.isFinite(values[index]),
      `${label}[${index}] must be finite, saw ${values[index]}`,
    );
  }
}

test('clamps unit values and never returns NaN', () => {
  assert.equal(display.clampUnit(-1), 0);
  assert.equal(display.clampUnit(2), 1);
  assert.equal(display.clampUnit(0.25), 0.25);
  assert.equal(display.clampUnit(Number.NaN), 0);
  assert.equal(display.clampUnit(Number.POSITIVE_INFINITY), 1);
  assert.equal(display.clampUnit(Number.NEGATIVE_INFINITY), 0);
});

test('builds min/max envelope columns for the selected channel', () => {
  const { min, max } = display.toEnvelopeColumns(stereoBlock, 4);

  assert.deepEqual(Array.from(min), [0, 0.25, 0.5, 0]);
  assert.deepEqual(Array.from(max), [0, 0.25, 0.5, 0]);
  assert.deepEqual(
    Array.from(display.toEnvelopeColumns(stereoBlock, 4, 1).min),
    [0, -0.25, -0.5, 0],
  );
});

test('asks for more envelope columns than samples without losing count', () => {
  const { min, max } = display.toEnvelopeColumns(stereoBlock, 8);

  assert.equal(min.length, 8);
  assert.equal(max.length, 8);
  assertAllFinite(min, 'min');
  assertAllFinite(max, 'max');
  assert.equal(min[0], 0);
  assert.equal(min[min.length - 1], 0);
});

test('decimates a channel into at most the requested trace points', () => {
  const trace = display.toTraceSamples(stereoBlock, 2);

  assert.equal(trace.length, 2);
  assert.equal(trace[0], 0);
  assert.equal(trace[trace.length - 1], 0);

  const single = display.toTraceSamples(
    { samples: [0.5, 0.5], channels: 2, samplesPerChannel: 1 },
    4,
  );
  assert.deepEqual(Array.from(single), [0.5]);

  assert.equal(display.toTraceSamples(stereoBlock, 4).length, 4);
});

test('projects stereo pairs into goniometer coordinates', () => {
  const hardLeft = display.toStereoPoints(
    { samples: [1, 0], channels: 2, samplesPerChannel: 1 },
    8,
  );
  assert.equal(hardLeft.length, 1);
  assert.ok(Math.abs(hardLeft[0].x + 1 / Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(hardLeft[0].y - 1 / Math.SQRT2) < 1e-9);

  const mono = display.toStereoPoints(
    { samples: [1, 1], channels: 2, samplesPerChannel: 1 },
    8,
  );
  assert.equal(mono[0].x, 0);
  assert.ok(Math.abs(mono[0].y - Math.SQRT2) < 1e-9);

  const capped = display.toStereoPoints(
    { samples: [1, 0, 1, 0, 1, 0, 1, 0], channels: 2, samplesPerChannel: 4 },
    2,
  );
  assert.ok(capped.length <= 2);
});

test('normalizes dB bins into the unit range', () => {
  const bins = display.normalizeBins([-90, -45, 0], [-90, 0]);

  assert.deepEqual(Array.from(bins), [0, 0.5, 1]);
  assert.deepEqual(Array.from(display.normalizeBins([-120, 10], [-90, 0])), [0, 1]);
  assert.deepEqual(Array.from(display.normalizeBins([-45])), [0.5]);
  assert.deepEqual(Array.from(display.normalizeBins([-45], [-90, 0])), [0.5]);
  // A degenerate domain must not divide by zero.
  assert.deepEqual(Array.from(display.normalizeBins([-45], [-20, -20])), [0]);
});

test('maps a meter value through a dB range', () => {
  assert.equal(display.toMeterScale(-60, [-60, 0]), 0);
  assert.equal(display.toMeterScale(0, [-60, 0]), 1);
  assert.equal(display.toMeterScale(-30, [-60, 0]), 0.5);
  assert.equal(display.toMeterScale(-200, [-60, 0]), 0);
  assert.equal(display.toMeterScale(12, [-60, 0]), 1);
});

test('returns finite values for silent and non-finite input', () => {
  const silentEnvelope = display.toEnvelopeColumns(silentBlock, 4);
  assertAllFinite(silentEnvelope.min, 'silent min');
  assertAllFinite(silentEnvelope.max, 'silent max');

  const nanEnvelope = display.toEnvelopeColumns(nanBlock, 4);
  assertAllFinite(nanEnvelope.min, 'nan min');
  assertAllFinite(nanEnvelope.max, 'nan max');

  assertAllFinite(display.toTraceSamples(nanBlock, 4), 'nan trace');

  const nanPoints = display.toStereoPoints(nanBlock, 4);
  for (const point of nanPoints) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  assertAllFinite(display.normalizeBins([Number.NaN, 0], [-90, 0]), 'nan bins');
});

test('ships the module surface and re-exports it from the package root', () => {
  assert.ok(existsSync(path.join(ROOT, 'dist/modules/ModuleSurface.js')));
  assert.ok(existsSync(path.join(ROOT, 'dist/modules/index.js')));

  const rootEntry = readFileSync(path.join(ROOT, 'dist/index.js'), 'utf8');
  assert.match(rootEntry, /\.\/modules/);
});
