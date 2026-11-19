import * as MiniMetersUI from '@minimetermobile/ui';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { pcmFrame } from './fixtures/pcm-frame';

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <StatusBar style="light" />
      <Text>MiniMeters UI isolated preview</Text>
      <Text>Library exports: {Object.keys(MiniMetersUI).length}</Text>
      <Text>
        PCM fixture: {pcmFrame.sampleRate} Hz, {pcmFrame.channels} channels,{' '}
        {pcmFrame.samplesPerChannel} samples/channel
      </Text>
    </View>
  );
}
