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

test('rasterizes spectrogram rows into RGBA bytes in row-major order', () => {
  const raster = spectrogramPixels.toSpectrogramPixels(
    [
      [0, 0.5, 1],
      [1, 0.5, 0],
    ],
    8,
    RAMP,
  );

  assert.equal(raster.width, 3);
  assert.equal(raster.height, 2);
  assert.equal(raster.bytes.length, raster.width * raster.height * 4);

  for (const byte of raster.bytes) {
    assert.ok(Number.isFinite(byte) && byte >= 0 && byte <= 255, `byte ${byte}`);
  }

  // Row-major: the first row's first pixel comes first, and every pixel is opaque.
  assert.deepEqual(Array.from(raster.bytes.slice(0, 4)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(raster.bytes.slice(12, 16)), [255, 255, 255, 255]);
});

test('trims the oldest spectrogram rows down to maxRows', () => {
  const rows = [
    [0],
    [0],
    [1],
    [1],
  ];

  const raster = spectrogramPixels.toSpectrogramPixels(rows, 2, RAMP);

  assert.equal(raster.height, 2);
  // The newest two rows survive, so the top of the image is already bright.
  assert.deepEqual(Array.from(raster.bytes.slice(0, 4)), [255, 255, 255, 255]);
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
