import type { Meta, StoryObj } from '@storybook/react-native';
import * as MiniMetersUI from '@minimetermobile/ui';
import { Text, View } from 'react-native';

import { pcmFrame } from '../../fixtures/pcm-frame';

function WorkspaceSmoke() {
  return (
    <View style={{ gap: 8, padding: 24 }}>
      <Text>MiniMeters UI isolated preview</Text>
      <Text>Library exports: {Object.keys(MiniMetersUI).length}</Text>
      <Text>
        PCM fixture: {pcmFrame.sampleRate} Hz, {pcmFrame.channels} channels,{' '}
        {pcmFrame.samplesPerChannel} samples/channel
      </Text>
    </View>
  );
}

const meta = {
  title: 'Foundation/Workspace smoke',
  component: WorkspaceSmoke,
} satisfies Meta<typeof WorkspaceSmoke>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
