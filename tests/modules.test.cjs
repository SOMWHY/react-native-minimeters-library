const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// Modules are React Native components, so these tests load only the pure
// display-preparation layer and assert the component files exist on disk.
const display = require('../dist/modules/display');
const waveHistory = require('../dist/modules/waveform/history');

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

test('builds the waveform envelope across a block history, not one instant', () => {
  const loud = {
    samples: [0.8, 0.8, -0.8, -0.8, 0.8, 0.8, -0.8, -0.8],
    channels: 2,
    samplesPerChannel: 4,
  };
  const gap = {
    samples: [0, 0, 0, 0, 0, 0, 0, 0],
    channels: 2,
    samplesPerChannel: 4,
  };

  // Two loud blocks and two gaps: the envelope must show both, in time order.
  const { min, max } = waveHistory.envelopeFromFrames(
    [loud, loud, gap, gap],
    4,
    0,
  );

  // Whole-block columns: ±0.8 then a flat gap at zero. Float32 storage, so
  // compare rounded values rather than exact doubles.
  const rounded = (values) => Array.from(values, (value) => Number(value.toFixed(3)));

  assert.deepEqual(rounded(max), [0.8, 0.8, 0, 0]);
  assert.deepEqual(rounded(min), [-0.8, -0.8, 0, 0]);
});

test('concatenates frames in order and keeps the right channel', () => {
  const left = { samples: [1, -1, 1, -1], channels: 2, samplesPerChannel: 2 };
  const right = { samples: [-1, 1, -1, 1], channels: 2, samplesPerChannel: 2 };

  assert.deepEqual(
    Array.from(waveHistory.envelopeFromFrames([left, right], 2, 0).max),
    [1, -1],
  );
  assert.deepEqual(
    Array.from(waveHistory.envelopeFromFrames([left, right], 2, 1).max),
    [-1, 1],
  );
});

test('an empty waveform history is a flat line, not an error', () => {
  const { min, max } = waveHistory.envelopeFromFrames([], 8);

  assert.equal(min.length, 8);
  assertAllFinite(min, 'empty min');
  assertAllFinite(max, 'empty max');
  assert.equal(Math.max(...max), 0);
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

test('aligns meter rows with evenly distributed label rows', () => {
  const inset = 8;

  for (const height of [96, 160, 240]) {
    const rows = display.meterRowBounds({ height, rows: 3, inset, gap: 4 });

    assert.equal(rows.length, 3);

    const usable = height - inset * 2;

    rows.forEach((row, index) => {
      // The label sits in an equal flex row inside the same inset, so its centre
      // is inset + (index + 0.5) * (usable / count).
      assert.equal(row.center, inset + (index + 0.5) * (usable / 3));
      assert.ok(row.y >= inset - 1e-9, `row ${index} starts inside the box`);
      assert.ok(
        row.y + row.height <= height - inset + 1e-9,
        `row ${index} ends inside the box`,
      );
      // The bar is centred on its label, not merely packed from the top.
      assert.equal(row.y + row.height / 2, row.center);
    });
  }
});

test('keeps the outer meter rows from drifting away from their labels', () => {
  const inset = 8;
  const height = 160;
  const legacyRowHeight = height / 3;
  const legacyCentres = [0, 1, 2].map(
    (index) => index * legacyRowHeight + legacyRowHeight / 2,
  );
  const rows = display.meterRowBounds({ height, rows: 3, inset, gap: 4 });

  // The middle row always matched; the outer two were off by 2 * inset / rows.
  assert.equal(rows[1].center, legacyCentres[1]);
  assert.notEqual(rows[0].center, legacyCentres[0]);
  assert.notEqual(rows[2].center, legacyCentres[2]);
  assert.ok(
    Math.abs(rows[0].center - legacyCentres[0] - (inset * 2) / 3) < 1e-9,
  );
});

test('degrades meter row geometry without producing negative sizes', () => {
  // Height smaller than the vertical inset pair.
  const squashed = display.meterRowBounds({
    height: 6,
    rows: 3,
    inset: 8,
    gap: 4,
  });

  assert.equal(squashed.length, 3);

  for (const row of squashed) {
    assert.equal(row.height, 0);
    assert.equal(row.y, 8);
    assert.equal(row.center, 8);
  }

  // A minimum bar height never exceeds its row, and never goes negative.
  const floored = display.meterRowBounds({
    height: 60,
    rows: 3,
    inset: 0,
    gap: 100,
    minBarHeight: 8,
  });

  floored.forEach((row) => {
    assert.equal(row.height, 8);
    assert.equal(row.y + row.height / 2, row.center);
  });

  // Non-finite input must not leak NaN into the drawing layer.
  for (const row of display.meterRowBounds({ height: NaN, rows: 2, inset: 4 })) {
    assert.ok(Number.isFinite(row.y));
    assert.ok(Number.isFinite(row.height));
  }

  assert.deepEqual(
    display.meterRowBounds({ height: 100, rows: 0, inset: 4 }),
    [],
  );
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

const waveformState = require('../dist/modules/waveform/state');

test('classifies waveform input as waiting, invalid, or ready', () => {
  assert.equal(waveformState.resolveWaveformState(undefined), 'waiting');
  assert.equal(waveformState.resolveWaveformState(null), 'waiting');
  assert.equal(
    waveformState.resolveWaveformState({
      samples: [],
      channels: 2,
      samplesPerChannel: 0,
    }),
    'waiting',
  );

  // Declared per-channel count disagrees with the interleaved buffer.
  assert.equal(
    waveformState.resolveWaveformState({
      samples: [0, 0, 0, 0],
      channels: 2,
      samplesPerChannel: 3,
    }),
    'invalid',
  );
  assert.equal(
    waveformState.resolveWaveformState({
      samples: [0, 0],
      channels: 0,
      samplesPerChannel: 1,
    }),
    'invalid',
  );
  assert.equal(waveformState.resolveWaveformState(nanBlock), 'invalid');

  assert.equal(waveformState.resolveWaveformState(stereoBlock), 'ready');
  assert.equal(waveformState.resolveWaveformState(silentBlock), 'ready');
});

test('ships the waveform module and re-exports it from the modules barrel', () => {
  assert.ok(existsSync(path.join(ROOT, 'dist/modules/waveform/WaveformModule.js')));

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/waveform/);
});

const oscilloscopeState = require('../dist/modules/oscilloscope/state');

test('classifies oscilloscope input as waiting, invalid, or ready', () => {
  assert.equal(oscilloscopeState.resolveOscilloscopeState(undefined), 'waiting');
  assert.equal(oscilloscopeState.resolveOscilloscopeState(null), 'waiting');
  assert.equal(
    oscilloscopeState.resolveOscilloscopeState({
      samples: [],
      channels: 2,
      samplesPerChannel: 0,
    }),
    'waiting',
  );
  assert.equal(oscilloscopeState.resolveOscilloscopeState(nanBlock), 'invalid');
  assert.equal(
    oscilloscopeState.resolveOscilloscopeState({
      samples: [0, 0, 0],
      channels: 2,
      samplesPerChannel: 2,
    }),
    'invalid',
  );
  assert.equal(oscilloscopeState.resolveOscilloscopeState(stereoBlock), 'ready');
  assert.equal(oscilloscopeState.resolveOscilloscopeState(silentBlock), 'ready');
});

test('keeps the oscilloscope trace finite and inside the amplitude domain', () => {
  const trace = display.toTraceSamples(stereoBlock, 128);

  assert.ok(trace.length <= 128);
  assert.equal(trace.length, stereoBlock.samplesPerChannel);
  assertAllFinite(trace, 'oscilloscope trace');

  for (const value of trace) {
    assert.ok(value >= -1 && value <= 1, `amplitude out of domain: ${value}`);
  }
});

test('ships the oscilloscope module and re-exports it from the modules barrel', () => {
  assert.ok(
    existsSync(path.join(ROOT, 'dist/modules/oscilloscope/OscilloscopeModule.js')),
  );

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/oscilloscope/);
});

const vectorscopeState = require('../dist/modules/vectorscope/state');

test('classifies vectorscope input as waiting, invalid, or ready', () => {
  assert.equal(vectorscopeState.resolveVectorscopeState(undefined), 'waiting');
  assert.equal(vectorscopeState.resolveVectorscopeState(null), 'waiting');
  assert.equal(
    vectorscopeState.resolveVectorscopeState({
      samples: [],
      channels: 2,
      samplesPerChannel: 0,
    }),
    'waiting',
  );

  // Mono input cannot be plotted in phase space.
  assert.equal(
    vectorscopeState.resolveVectorscopeState({
      samples: [0, 0.5, -0.5],
      channels: 1,
      samplesPerChannel: 3,
    }),
    'invalid',
  );
  assert.equal(vectorscopeState.resolveVectorscopeState(nanBlock), 'invalid');
  assert.equal(
    vectorscopeState.resolveVectorscopeState({
      samples: [0, 0, 0],
      channels: 2,
      samplesPerChannel: 2,
    }),
    'invalid',
  );

  assert.equal(vectorscopeState.resolveVectorscopeState(stereoBlock), 'ready');
  assert.equal(vectorscopeState.resolveVectorscopeState(silentBlock), 'ready');
});

test('ships the vectorscope module and re-exports it from the modules barrel', () => {
  assert.ok(
    existsSync(path.join(ROOT, 'dist/modules/vectorscope/VectorscopeModule.js')),
  );

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/vectorscope/);
});

const spectrumState = require('../dist/modules/spectrum/state');

test('classifies spectrum input as waiting, invalid, or ready', () => {
  assert.equal(spectrumState.resolveSpectrumState({}), 'waiting');
  assert.equal(spectrumState.resolveSpectrumState({ bins: null }), 'waiting');
  assert.equal(
    spectrumState.resolveSpectrumState({ bins: new Float32Array(0) }),
    'waiting',
  );

  assert.equal(
    spectrumState.resolveSpectrumState({ bins: [Number.NaN, -30] }),
    'invalid',
  );
  assert.equal(
    spectrumState.resolveSpectrumState({
      bins: [-30, -30],
      dbRange: [0, -90],
    }),
    'invalid',
  );
  assert.equal(
    spectrumState.resolveSpectrumState({
      bins: [-30, -30],
      dbRange: [Number.NEGATIVE_INFINITY, 0],
    }),
    'invalid',
  );

  assert.equal(spectrumState.resolveSpectrumState({ bins: [0, 0, 0] }), 'ready');
  assert.equal(
    spectrumState.resolveSpectrumState({ bins: [-90, -45, 0], dbRange: [-90, 0] }),
    'ready',
  );
});

test('normalizes a single bin and a degenerate window without dividing by zero', () => {
  assert.deepEqual(Array.from(display.normalizeBins([-45], [-90, 0])), [0.5]);
  assert.deepEqual(Array.from(display.normalizeBins([-45], [-20, -20])), [0]);
  assert.deepEqual(
    Array.from(display.normalizeBins(new Float32Array([0]), [-90, 0])),
    [1],
  );
});

test('ships the spectrum module and re-exports it from the modules barrel', () => {
  assert.ok(existsSync(path.join(ROOT, 'dist/modules/spectrum/SpectrumModule.js')));

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/spectrum/);
});

const vuState = require('../dist/modules/vu/state');

test('classifies VU input as waiting, invalid, or ready', () => {
  assert.equal(vuState.resolveVuState(undefined), 'waiting');
  assert.equal(vuState.resolveVuState(null), 'waiting');

  assert.equal(
    vuState.resolveVuState({ left: Number.NaN, right: 0 }),
    'invalid',
  );
  assert.equal(
    vuState.resolveVuState({ left: 0, right: Number.POSITIVE_INFINITY }),
    'invalid',
  );
  assert.equal(
    vuState.resolveVuState({ left: 0, right: 0, leftPeak: Number.NaN }),
    'invalid',
  );

  assert.equal(vuState.resolveVuState({ left: 0, right: 0 }), 'ready');
  assert.equal(vuState.resolveVuState({ left: 0.5, right: 0.9 }), 'ready');
});

test('clamps a hot VU level instead of rejecting it', () => {
  const hot = { left: 1.4, right: 0.5 };

  assert.equal(vuState.resolveVuState(hot), 'ready');
  assert.equal(display.clampUnit(hot.left), 1);
  assert.equal(display.clampUnit(-0.4), 0);
});

test('ships the VU module and re-exports it from the modules barrel', () => {
  assert.ok(existsSync(path.join(ROOT, 'dist/modules/vu/VuModule.js')));

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/vu/);
});

const loudnessState = require('../dist/modules/loudness/state');

test('classifies loudness input as waiting, invalid, or ready', () => {
  assert.equal(loudnessState.resolveLoudnessState(undefined), 'waiting');
  assert.equal(loudnessState.resolveLoudnessState(null), 'waiting');

  assert.equal(
    loudnessState.resolveLoudnessState({ peak: Number.NaN, rms: -20, lufs: -14 }),
    'invalid',
  );
  assert.equal(
    loudnessState.resolveLoudnessState({
      peak: -3,
      rms: Number.NEGATIVE_INFINITY,
      lufs: -14,
    }),
    'invalid',
  );
  assert.equal(
    loudnessState.resolveLoudnessState({ peak: -3, rms: -20, lufs: undefined }),
    'invalid',
  );

  // Documented silence is a valid reading, not an error.
  assert.equal(
    loudnessState.resolveLoudnessState({ peak: -90, rms: -90, lufs: -90 }),
    'ready',
  );
  assert.equal(
    loudnessState.resolveLoudnessState({ peak: -3, rms: -20, lufs: -14 }),
    'ready',
  );
});

test('clamps loudness meters below and above the dB window', () => {
  assert.equal(display.toMeterScale(-90, [-60, 0]), 0);
  assert.equal(display.toMeterScale(-61, [-60, 0]), 0);
  assert.equal(display.toMeterScale(3, [-60, 0]), 1);
  assert.equal(display.toMeterScale(-30, [-60, 0]), 0.5);
});

test('ships the loudness module and re-exports it from the modules barrel', () => {
  assert.ok(
    existsSync(path.join(ROOT, 'dist/modules/loudness/LoudnessModule.js')),
  );

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/loudness/);
});

const spectrogramPixels = require('../dist/modules/spectrogram/pixels');
const spectrogramState = require('../dist/modules/spectrogram/state');

const RAMP = [
  [0, 0, 0],
  [64, 64, 64],
  [255, 255, 255],
];

test('rasterizes spectrogram rows with time across and frequency up', () => {
  const raster = spectrogramPixels.toSpectrogramPixels(
    [
      [0, 0.5, 1],
      [1, 0.5, 0],
    ],
    8,
    RAMP,
  );

  // Two rows in → two pixels across (time); three bins → three pixels high.
  assert.equal(raster.width, 2);
  assert.equal(raster.height, 3);
  assert.equal(raster.bytes.length, raster.width * raster.height * 4);

  for (const byte of raster.bytes) {
    assert.ok(Number.isFinite(byte) && byte >= 0 && byte <= 255, `byte ${byte}`);
  }

  const pixel = (x, y) =>
    Array.from(raster.bytes.slice((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4));

  // The newest row is the right-most column.
  assert.deepEqual(pixel(0, 2), [0, 0, 0, 255]);
  assert.deepEqual(pixel(1, 2), [255, 255, 255, 255]);
  // Bin 0 (lowest frequency) is drawn in the last row; the top row is the
  // highest bin, which is loud in the oldest column.
  assert.deepEqual(pixel(0, 0), [255, 255, 255, 255]);
  assert.deepEqual(pixel(1, 0), [0, 0, 0, 255]);
});

test('pads ragged spectrogram rows with silence', () => {
  const raster = spectrogramPixels.toSpectrogramPixels([[1, 1], [1]], 8, RAMP);

  assert.equal(raster.width, 2);
  assert.equal(raster.height, 2);

  const pixel = (x, y) =>
    Array.from(raster.bytes.slice((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4));

  // Column 1 is missing its second bin → the high-frequency row stays black.
  assert.deepEqual(pixel(1, 1), [255, 255, 255, 255]);
  assert.deepEqual(pixel(1, 0), [0, 0, 0, 255]);
});

test('trims the oldest spectrogram rows down to maxRows', () => {
  const rows = [
    [0],
    [0],
    [0.5],
    [1],
  ];

  const raster = spectrogramPixels.toSpectrogramPixels(rows, 2, RAMP);

  assert.equal(raster.width, 2);
  assert.equal(raster.height, 1);
  // The newest two rows survive: mid-grey on the left, full brightness right.
  assert.deepEqual(Array.from(raster.bytes.slice(0, 4)), [64, 64, 64, 255]);
  assert.deepEqual(Array.from(raster.bytes.slice(4, 8)), [255, 255, 255, 255]);
});

test('returns a zero-size raster for an empty row set', () => {
  const raster = spectrogramPixels.toSpectrogramPixels([], 8, RAMP);

  assert.equal(raster.width, 0);
  assert.equal(raster.height, 0);
  assert.equal(raster.bytes.length, 0);
});

test('parses hex theme colors into RGB triples', () => {
  assert.deepEqual(spectrogramPixels.parseHexColor('#fff'), [255, 255, 255]);
  assert.deepEqual(spectrogramPixels.parseHexColor('#8A2BE2'), [138, 43, 226]);
  assert.deepEqual(spectrogramPixels.parseHexColor('#00000080'), [0, 0, 0]);
  assert.equal(spectrogramPixels.parseHexColor('not-a-color'), null);
});

test('classifies spectrogram input as waiting, invalid, or ready', () => {
  assert.equal(spectrogramState.resolveSpectrogramState(undefined), 'waiting');
  assert.equal(spectrogramState.resolveSpectrogramState(null), 'waiting');
  assert.equal(spectrogramState.resolveSpectrogramState([]), 'waiting');

  // Ragged rows would smear the history.
  assert.equal(
    spectrogramState.resolveSpectrogramState([[0, 0], [0]]),
    'invalid',
  );
  assert.equal(
    spectrogramState.resolveSpectrogramState([[0, Number.NaN]]),
    'invalid',
  );

  assert.equal(
    spectrogramState.resolveSpectrogramState([
      [0, 0.5],
      [0.5, 1],
    ]),
    'ready',
  );
});

test('ships the spectrogram module and re-exports it from the modules barrel', () => {
  assert.ok(
    existsSync(path.join(ROOT, 'dist/modules/spectrogram/SpectrogramModule.js')),
  );

  const modulesEntry = readFileSync(path.join(ROOT, 'dist/modules/index.js'), 'utf8');
  assert.match(modulesEntry, /\.\/spectrogram/);
});

test('provides the drawing context inside the canvas element tree', () => {
  // Skia renders canvas children through its own reconciler root, and React
  // context does not cross reconciler roots: a provider hoisted above `Canvas`
  // leaves every module plot with a null context.
  const canvasSource = readFileSync(
    path.join(ROOT, 'dist/drawing/VisualizationCanvas.js'),
    'utf8',
  );

  const canvasIndex = canvasSource.indexOf('react_native_skia_1.Canvas');
  const providerIndex = canvasSource.indexOf(
    'DrawingContext_1.DrawingContext.Provider',
  );

  assert.ok(canvasIndex >= 0, 'the canvas element is rendered');
  assert.ok(providerIndex >= 0, 'the drawing context is provided');
  assert.ok(
    providerIndex > canvasIndex,
    'the provider must be nested inside the canvas children',
  );
});

test('renders the canvas through a TextureView on Android', () => {
  // A SurfaceView is a separate window layer: it composites above the React
  // Native tree, so swipes starting on a plot never reach a scroll container.
  const canvasSource = readFileSync(
    path.join(ROOT, 'dist/drawing/VisualizationCanvas.js'),
    'utf8',
  );

  assert.match(canvasSource, /surfaceType: 'TextureView'/);
});

test('modules carry no caption of their own', () => {
  // The dashboard card owns the only title. A module that defaults its own label
  // paints the same text twice in the same corner.
  const modules = [
    'loudness/LoudnessModule',
    'oscilloscope/OscilloscopeModule',
    'spectrogram/SpectrogramModule',
    'spectrum/SpectrumModule',
    'vectorscope/VectorscopeModule',
    'vu/VuModule',
    'waveform/WaveformModule',
  ];

  for (const moduleName of modules) {
    const source = readFileSync(
      path.join(ROOT, 'dist/modules', `${moduleName}.js`),
      'utf8',
    );

    assert.doesNotMatch(
      source,
      /DEFAULT_LABEL/,
      `${moduleName} must not default its label`,
    );
  }
});

// --- oscilloscope trigger ------------------------------------------------

function mono(samples) {
  return {
    samples: Float32Array.from(samples),
    channels: 1,
    samplesPerChannel: samples.length,
  };
}

test('the oscilloscope trigger finds the first rising zero crossing', () => {
  const { findTriggerIndex } = require('../dist/modules/oscilloscope/trigger');
  const samples = [];
  // 8 samples per period, starting a quarter period in:
  // +1, +0.707, 0, -0.707, -1, -0.707, 0, +0.707, +1, ...
  for (let index = 0; index < 64; index += 1) {
    samples.push(Math.sin((2 * Math.PI * (index + 2)) / 8));
  }

  // The rising crossing is at index 7: index 6 is exactly zero, so the first
  // sample strictly above zero after a non-positive one is 7.
  assert.equal(findTriggerIndex(mono(samples)), 7);
});

test('the oscilloscope trigger falls back to the first sample', () => {
  const { findTriggerIndex } = require('../dist/modules/oscilloscope/trigger');

  assert.equal(findTriggerIndex(mono(new Array(64).fill(0.5))), 0);
  assert.equal(findTriggerIndex(mono(new Array(64).fill(0))), 0);
});

test('the oscilloscope trigger reads the requested channel', () => {
  const { findTriggerIndex } = require('../dist/modules/oscilloscope/trigger');
  const frames = 64;
  const samples = new Float32Array(frames * 2);

  for (let frame = 0; frame < frames; frame += 1) {
    samples[frame * 2] = -0.5;
    // Sample 2 is the first positive frame on the right channel.
    samples[frame * 2 + 1] = frame >= 2 ? 0.5 : -0.5;
  }

  const block = { samples, channels: 2, samplesPerChannel: frames };

  assert.equal(findTriggerIndex(block, 1), 2);
  assert.equal(findTriggerIndex(block, 0), 0);
});

test('a triggered trace skips the samples before the crossing', () => {
  const { toTraceSamples } = require('../dist/modules/display');
  const block = mono([0, 1, 2, 3, 4, 5, 6, 7]);

  // 4 vertices over 8 samples land on indices 0, 2, 5 and 7.
  assert.deepEqual(Array.from(toTraceSamples(block, 4)), [0, 2, 5, 7]);

  // Offsetting by 2 shifts the window: 2 + (0, 2, 3, 5).
  assert.deepEqual(Array.from(toTraceSamples(block, 4, 0, 2)), [2, 4, 5, 7]);

  // An offset past the end yields an empty trace instead of throwing.
  assert.equal(toTraceSamples(block, 4, 0, 99).length, 0);
});

// --- spectrogram gamma ---------------------------------------------------

test('the spectrogram gamma lifts quiet cells without touching full scale', () => {
  const {
    SPECTROGRAM_GAMMA,
    toSpectrogramPixels,
  } = require('../dist/modules/spectrogram/pixels');
  const ramp = Array.from({ length: 8 }, (_unused, index) => [index * 32, 0, 0]);
  const rows = [[0.1, 1]];

  const linear = toSpectrogramPixels(rows, 1, ramp);
  const curved = toSpectrogramPixels(rows, 1, ramp, SPECTROGRAM_GAMMA);

  // Row order is flipped: bin 0 lands in the last pixel row.
  const floorOffset = (1 * 1 + 0) * 4;
  const ceilOffset = (0 * 1 + 0) * 4;

  // A quiet cell climbs one ramp stop (0 -> 32) while full scale stays at the top.
  assert.equal(linear.bytes[floorOffset], 0);
  assert.equal(curved.bytes[floorOffset], 32);
  assert.equal(linear.bytes[ceilOffset], 224);
  assert.equal(curved.bytes[ceilOffset], 224);
});

test('trigger detection reads the same channel the trace draws', () => {
  const { findTriggerIndex } = require('../dist/modules/oscilloscope/trigger');
  const { toTraceSamples } = require('../dist/modules/display');

  // Two channels 180 degrees apart, so reading the wrong one flips the phase.
  const left = [];
  const right = [];
  for (let index = 0; index < 32; index += 1) {
    left.push(Math.sin((2 * Math.PI * index) / 8));
    right.push(-Math.sin((2 * Math.PI * index) / 8));
  }
  const interleaved = [];
  for (let index = 0; index < 32; index += 1) {
    interleaved.push(left[index], right[index]);
  }
  const block = {
    samples: Float32Array.from(interleaved),
    channels: 2,
    samplesPerChannel: 32,
  };

  // Channel 2 does not exist on a stereo block: both readers clamp it to 1.
  assert.equal(findTriggerIndex(block, 2), findTriggerIndex(block, 1));
  assert.deepEqual(
    Array.from(toTraceSamples(block, 4, 2)),
    Array.from(toTraceSamples(block, 4, 1)),
  );

  // Fractional channels floor to the same index instead of reading between frames.
  assert.equal(findTriggerIndex(block, 1.9), findTriggerIndex(block, 1));
});

test('a triggered trace keeps a fixed time scale', () => {
  const { triggeredTraceSamples, rotateTrace } = require('../dist/modules/oscilloscope/trace');
  const samples = [];
  for (let index = 0; index < 64; index += 1) {
    samples.push(Math.sin((2 * Math.PI * (index + 2)) / 8));
  }
  const block = mono(samples);

  const free = triggeredTraceSamples(block, 16, 0, 'none');
  const triggered = triggeredTraceSamples(block, 16, 0, 'rising');

  // Same number of points, so the polyline spans the same horizontal domain
  // whatever the trigger offset was.
  assert.equal(free.length, 16);
  assert.equal(triggered.length, 16);

  // Rotating left by the trigger position puts the crossing first, and rotation
  // only reorders: nothing is dropped or duplicated.
  const shift = Math.round((7 / 64) * 16);
  assert.deepEqual(Array.from(rotateTrace(free, shift)), Array.from(triggered));
  assert.deepEqual(
    Array.from(triggered).sort((a, b) => a - b),
    Array.from(free).sort((a, b) => a - b),
  );

  // Rotation wraps around instead of padding.
  assert.deepEqual(Array.from(rotateTrace(Float32Array.from([1, 2, 3]), -1)), [3, 1, 2]);
  assert.deepEqual(Array.from(rotateTrace(Float32Array.from([1, 2, 3]), 3)), [1, 2, 3]);
});

// --- spectrogram ramp ----------------------------------------------------

test('the spectrogram ramp starts at the card surface', () => {
  const { buildSpectrogramRamp } =
    require('../dist/modules/spectrogram/ramp');
  const { toSpectrogramPixels } = require('../dist/modules/spectrogram/pixels');

  const ramp = buildSpectrogramRamp({
    surface: '#10131E',
    low: '#6366F1',
    mid: '#D946EF',
    high: '#F97316',
  });

  // Silence is the fourth-stop-free case: surface, then the three trace tones.
  assert.equal(ramp.length, 4);
  assert.deepEqual(Array.from(ramp[0]), [16, 19, 30]);

  // One column, three bins: bin 0 is silence, bin 2 is full scale.
  const raster = toSpectrogramPixels([[0, 0.5, 1]], 1, ramp);

  // Bin 0 lands in the last pixel row, full scale in the first.
  assert.deepEqual(Array.from(raster.bytes.slice(8, 11)), [16, 19, 30]);
  assert.deepEqual(Array.from(raster.bytes.slice(0, 3)), [249, 115, 22]);
});

test('an unparseable surface falls back instead of painting the traces as background', () => {
  const { buildSpectrogramRamp, FALLBACK_RAMP } =
    require('../dist/modules/spectrogram/ramp');

  // Without a usable surface the low trace tone would become the background,
  // which is exactly the mismatch this ramp exists to remove.
  assert.deepEqual(
    Array.from(buildSpectrogramRamp({ surface: 'nope', low: '#6366F1', mid: '#D946EF', high: '#F97316' })),
    Array.from(FALLBACK_RAMP),
  );

  // Trace tones are optional: a surface alone still yields a ramp.
  assert.deepEqual(
    Array.from(buildSpectrogramRamp({ surface: '#10131E', low: 'bad', mid: 'bad', high: 'bad' })),
    Array.from(FALLBACK_RAMP),
  );
});
