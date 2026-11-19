import {
  BUILT_IN_THEMES,
  OscilloscopeModule,
  type PcmBlock,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const FRAME_SIZE = 256;

/** A decaying two-channel tone with a little noise so the trace reads as live. */
function makeToneFrame(): PcmBlock {
  const samples = new Float32Array(FRAME_SIZE * 2);

  for (let index = 0; index < FRAME_SIZE; index += 1) {
    const phase = (index / FRAME_SIZE) * Math.PI * 8;
    const envelope = 1 - index / FRAME_SIZE;
    const value = Math.sin(phase) * envelope * 0.9;

    samples[index * 2] = value;
    samples[index * 2 + 1] = value;
  }

  return { samples, channels: 2, samplesPerChannel: FRAME_SIZE };
}

function OscilloscopePreview({
  theme,
  block,
}: {
  theme: VisualizationTheme;
  block?: PcmBlock | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <OscilloscopeModule theme={theme} block={block} height={180} />
    </View>
  );
}

const meta = {
  title: 'Modules/Oscilloscope',
  component: OscilloscopePreview,
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
} satisfies Meta<typeof OscilloscopePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { block: null },
};

export const Invalid: Story = {
  args: {
    // Non-finite samples cannot be drawn honestly, so the surface reports it.
    block: { ...makeToneFrame(), samplesPerChannel: FRAME_SIZE + 1 },
  },
};
