import {
  BUILT_IN_THEMES,
  WaveformModule,
  type PcmBlock,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const FRAME_SIZE = 256;

/** A two-channel 0.5 Hz-ish tone so the envelope has visible structure. */
function makeToneFrame(): PcmBlock {
  const samples = new Float32Array(FRAME_SIZE * 2);

  for (let index = 0; index < FRAME_SIZE; index += 1) {
    const phase = (index / FRAME_SIZE) * Math.PI * 6;
    const left = Math.sin(phase) * 0.85;

    samples[index * 2] = left;
    samples[index * 2 + 1] = left * 0.45;
  }

  return { samples, channels: 2, samplesPerChannel: FRAME_SIZE };
}

function WaveformPreview({
  theme,
  block,
}: {
  theme: VisualizationTheme;
  block?: PcmBlock | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <WaveformModule theme={theme} block={block} height={180} />
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
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    block: makeToneFrame(),
  },
} satisfies Meta<typeof WaveformPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { block: null },
};

export const Invalid: Story = {
  args: {
    // The declared per-channel count no longer matches the buffer length.
    block: { ...makeToneFrame(), samplesPerChannel: FRAME_SIZE + 1 },
  },
};
