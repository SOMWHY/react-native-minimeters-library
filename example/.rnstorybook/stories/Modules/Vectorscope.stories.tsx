import {
  BUILT_IN_THEMES,
  VectorscopeModule,
  type PcmBlock,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const FRAME_SIZE = 384;

/** A slightly decorrelated stereo pair so the plot spreads off the diagonal. */
function makeStereoFrame(): PcmBlock {
  const samples = new Float32Array(FRAME_SIZE * 2);

  for (let index = 0; index < FRAME_SIZE; index += 1) {
    const phase = (index / FRAME_SIZE) * Math.PI * 12;
    const left = Math.sin(phase) * 0.8;
    const right = Math.sin(phase + 0.4) * 0.55;

    samples[index * 2] = left;
    samples[index * 2 + 1] = right;
  }

  return { samples, channels: 2, samplesPerChannel: FRAME_SIZE };
}

function VectorscopePreview({
  theme,
  block,
}: {
  theme: VisualizationTheme;
  block?: PcmBlock | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <VectorscopeModule theme={theme} block={block} height={240} />
    </View>
  );
}

const meta = {
  title: 'Modules/Vectorscope',
  component: VectorscopePreview,
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
    block: makeStereoFrame(),
  },
} satisfies Meta<typeof VectorscopePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { block: null },
};

export const Invalid: Story = {
  args: {
    // A mono block has no phase relationship to plot.
    block: {
      samples: new Float32Array(FRAME_SIZE),
      channels: 1,
      samplesPerChannel: FRAME_SIZE,
    },
  },
};
