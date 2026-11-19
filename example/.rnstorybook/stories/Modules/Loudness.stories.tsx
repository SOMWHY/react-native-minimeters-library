import {
  BUILT_IN_THEMES,
  LoudnessModule,
  type LoudnessValues,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const programMaterial: LoudnessValues = {
  peak: -3.4,
  rms: -18.7,
  lufs: -14.2,
};

function LoudnessPreview({
  theme,
  data,
}: {
  theme: VisualizationTheme;
  data?: LoudnessValues | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <LoudnessModule theme={theme} data={data} height={170} dbRange={[-60, 0]} />
    </View>
  );
}

const meta = {
  title: 'Modules/Loudness',
  component: LoudnessPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
    data: { control: false },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    data: programMaterial,
  },
} satisfies Meta<typeof LoudnessPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { data: null },
};

export const Invalid: Story = {
  args: {
    data: { peak: -3.4, rms: Number.NEGATIVE_INFINITY, lufs: -14.2 },
  },
};
