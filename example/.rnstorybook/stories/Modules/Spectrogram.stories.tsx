import {
  BUILT_IN_THEMES,
  SpectrogramModule,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { spectrogramRows } from '../../../fixtures/spectrogram-rows';

function SpectrogramPreview({
  theme,
  rows,
}: {
  theme: VisualizationTheme;
  rows?: ArrayLike<ArrayLike<number>> | null;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <SpectrogramModule theme={theme} rows={rows} maxRows={64} height={200} />
    </View>
  );
}

const meta = {
  title: 'Modules/Spectrogram',
  component: SpectrogramPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
    rows: { control: false },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    rows: spectrogramRows,
  },
} satisfies Meta<typeof SpectrogramPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { rows: null },
};

export const Invalid: Story = {
  args: {
    // Ragged rows cannot be rasterized into an honest time/frequency image.
    rows: [[0, 0.5, 1], [0.5, 1]],
  },
};
