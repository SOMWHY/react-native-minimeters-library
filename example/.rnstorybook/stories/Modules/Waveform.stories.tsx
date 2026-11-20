import {
  BUILT_IN_THEMES,
  WaveformModule,
  type PcmBlock,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const FRAME_SIZE = 256;
const HISTORY_FRAMES = 30;

/** A two-channel tone so the envelope has visible structure. */
function makeToneFrame(scale = 1, phaseOffset = 0): PcmBlock {
  const samples = new Float32Array(FRAME_SIZE * 2);

  for (let index = 0; index < FRAME_SIZE; index += 1) {
    const phase = phaseOffset + (index / FRAME_SIZE) * Math.PI * 6;
    const left = Math.sin(phase) * 0.85 * scale;

    samples[index * 2] = left;
    samples[index * 2 + 1] = left * 0.45;
  }

  return { samples, channels: 2, samplesPerChannel: FRAME_SIZE };
}

/**
 * Three seconds of "music": a silent lead-in, a decaying attack, a sustained
 * bed and a quiet tail. This is what the waveform card is for — the shape of the
 * recent past, not the shape of one block.
 */
function makeHistory(): PcmBlock[] {
  return Array.from({ length: HISTORY_FRAMES }, (_unused, index) => {
    const position = index / HISTORY_FRAMES;
    const level =
      position < 0.1
        ? 0
        : position < 0.35
          ? 1 - (position - 0.1) * 2
          : position < 0.75
            ? 0.55
            : 0.05;

    return makeToneFrame(level, position * 12);
  });
}

function WaveformPreview({
  theme,
  block,
  frames,
}: {
  theme: VisualizationTheme;
  block?: PcmBlock | null;
  frames?: readonly PcmBlock[] | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <WaveformModule theme={theme} block={block} frames={frames} height={180} />
    </View>
  );
}

const meta = {
  title: 'Modules/Waveform',
  component: WaveformPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
    block: { control: false },
    frames: { control: false },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    frames: makeHistory(),
    block: null,
  },
} satisfies Meta<typeof WaveformPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The production path: a rolling history drawn as a peak envelope over time. */
export const Timeline: Story = {};

/** A single block, for hosts that only keep one — note how it reads as a scope. */
export const SingleBlock: Story = {
  args: { frames: null, block: makeToneFrame() },
};

export const Waiting: Story = {
  args: { frames: null, block: null },
};

export const Invalid: Story = {
  args: {
    frames: null,
    // The declared per-channel count no longer matches the buffer length.
    block: { ...makeToneFrame(), samplesPerChannel: FRAME_SIZE + 1 },
  },
};

export const FlatSilence: Story = {
  args: { frames: makeHistory().map(() => makeToneFrame(0)), block: null },
};
