import {
  BUILT_IN_THEMES,
  VuModule,
  type VisualizationTheme,
  type VuLevels,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

const steadyLevels: VuLevels = {
  left: 0.72,
  right: 0.55,
  leftPeak: 0.85,
  rightPeak: 0.68,
};

function VuPreview({
  theme,
  data,
}: {
  theme: VisualizationTheme;
  data?: VuLevels | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16, width: 220 }}>
      <VuModule theme={theme} data={data} height={180} />
    </View>
  );
}

const meta = {
  title: 'Modules/VU',
  component: VuPreview,
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
    data: steadyLevels,
  },
} satisfies Meta<typeof VuPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { data: null },
};

export const Invalid: Story = {
  args: {
    // A non-finite level cannot be drawn honestly.
    data: { left: Number.NaN, right: 0.4 },
  },
};
