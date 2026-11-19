import {
  BUILT_IN_THEMES,
  SpectrumModule,
  type NumericRange,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { spectrumBins, spectrumDbRange } from '../../../fixtures/spectrum-bins';

function SpectrumPreview({
  theme,
  bins,
  dbRange,
}: {
  theme: VisualizationTheme;
  bins?: ArrayLike<number> | null;
  dbRange: NumericRange;
}) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <SpectrumModule theme={theme} bins={bins} dbRange={dbRange} height={180} />
    </View>
  );
}

const meta = {
  title: 'Modules/Spectrum',
  component: SpectrumPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
    bins: { control: false },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    bins: spectrumBins,
    dbRange: spectrumDbRange,
  },
} satisfies Meta<typeof SpectrumPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Waiting: Story = {
  args: { bins: null },
};

export const Invalid: Story = {
  args: {
    // An inverted window cannot be normalized, so the surface says so.
    dbRange: [0, -90],
  },
};
