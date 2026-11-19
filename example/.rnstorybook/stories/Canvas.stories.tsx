import {
  BUILT_IN_THEMES,
  VisualizationCanvas,
  useDrawingContext,
  type NumericRange,
  type VisualizationTheme,
} from '@minimetermobile/ui';
import { Path, Skia } from '@shopify/react-native-skia';
import type { Meta, StoryObj } from '@storybook/react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { pcmFrame } from '../../fixtures/pcm-frame';

const SAMPLE_INDEX_DOMAIN: NumericRange = [0, pcmFrame.samplesPerChannel - 1];
const AMPLITUDE_DOMAIN: NumericRange = [-0.5, 0.5];

/**
 * Draws the left channel of the local PCM fixture through the shared drawing
 * context: indices map across the measured width, amplitudes map up the
 * reversed Y axis, and both the color and the stroke width come from the theme
 * and the structural tokens rather than from local constants.
 */
function PcmTrace() {
  const { colors, mapX, mapY, tokens } = useDrawingContext();

  const path = useMemo(() => {
    const trace = Skia.Path.Make();

    for (let index = 0; index < pcmFrame.samplesPerChannel; index += 1) {
      const x = mapX(index, SAMPLE_INDEX_DOMAIN);
      const y = mapY(pcmFrame.samples[index * pcmFrame.channels], AMPLITUDE_DOMAIN);

      if (index === 0) {
        trace.moveTo(x, y);
      } else {
        trace.lineTo(x, y);
      }
    }

    return trace;
  }, [mapX, mapY]);

  return (
    <Path
      path={path}
      color={colors.traces.primary}
      style="stroke"
      strokeWidth={tokens.strokeWidth.regular}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

function CanvasPreview({ theme }: { theme: VisualizationTheme }) {
  return (
    <View style={{ backgroundColor: '#02030A', padding: 16 }}>
      <View style={{ height: 240 }}>
        <VisualizationCanvas theme={theme}>
          <PcmTrace />
        </VisualizationCanvas>
      </View>
    </View>
  );
}

const meta = {
  title: 'Foundation/Canvas',
  component: CanvasPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
  },
} satisfies Meta<typeof CanvasPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PcmFixture: Story = {};
