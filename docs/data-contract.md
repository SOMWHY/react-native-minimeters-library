# Audio Data Contract

This document records what the current server sends and what the current mobile
client decodes. It does not define a new wire format or imply that the UI
library performs audio analysis.

## Sources checked

These source files were inspected in the parent `MiniMetersMobile` workspace;
the server and host-app source trees are not included in this library
repository:

- Server audio capture and queueing: `MiniMetersMobileServer/PluginProcessor.cpp`, `MiniMetersMobileServer/AudioBlockQueue.h`
- Server frame serialization and broadcast timing: `MiniMetersMobileServer/WebSocketServer.cpp`
- Protocol description: `MiniMetersMobileServer/protocol/audio_frame.md`
- Mobile binary decoder: `minimeters-mobile/src/features/monitoring/pcm-frame.ts`
- Mobile WebSocket client: `minimeters-mobile/src/features/connection/pcm-socket-client.ts`
- Current sample monitor: `minimeters-mobile/src/features/monitoring/PcmMonitorScreen.tsx`

## Transport and frame cadence

After WebSocket authentication, the server sends binary frames. It does not send
audio as JSON. The broadcaster targets one frame every 33 ms (about 30 Hz), but
the actual rate depends on audio-block production and network conditions. It
selects the newest queued block, so intermediate queued blocks may be skipped.
Each frame carries one DAW audio block; the 30 Hz delivery target is not the
audio sample rate.

The audio callback currently queues a zero timestamp. During serialization, the
server substitutes the current Unix time in milliseconds. Therefore the
timestamp describes approximately when the server serialized/sent the block,
not the precise capture time of its first sample.

## Binary header

All integer header fields are little-endian. The header is 32 bytes:

| Offset | Size | Field | Current meaning |
|---:|---:|---|---|
| 0 | 4 | `magic` | ASCII `MMSA` |
| 4 | 1 | `version` | `1` |
| 5 | 1 | `messageType` | `1` = audio block |
| 6 | 2 | `headerSize` | `32` bytes |
| 8 | 8 | `timestamp` | Unix epoch milliseconds, filled at send time |
| 16 | 4 | `sampleRate` | Audio sample rate in Hz |
| 20 | 2 | `channels` | The current processor writes `2` |
| 22 | 2 | `samplesPerChannel` | Number of samples in this DAW block per channel |
| 24 | 4 | `sampleFormat` | `1` = little-endian IEEE-754 `float32` |
| 28 | 4 | `payloadSize` | PCM payload length in bytes |

The payload starts at byte 32 and contains
`channels * samplesPerChannel` float32 values. Stereo samples are interleaved:
`L0, R0, L1, R1, ...`. The sample rate and block size depend on the DAW's audio
configuration. The protocol does not specify a clamping range for sample values.

### Mono discrepancy

The protocol prose says mono input may be represented as one channel. The
current processor instead duplicates each mono input sample to left and right,
interleaves the result, and queues the frame with `channels = 2`. The current
network output is therefore two-channel, including for mono input. This document
records the implementation behavior; it does not change the protocol.

## Mobile decoded shape

The mobile decoder validates the header and payload size, then produces:

```ts
export type PcmAudioFrame = {
  timestampMs: number;
  sampleRate: number;
  channels: number;
  samplesPerChannel: number;
  samples: Float32Array;
};
```

`samples` remains interleaved. For two channels, channel `c` at sample index
`i` is at `samples[i * channels + c]`. `PcmSocketClient` retains only the latest
decoded frame; the current monitor screen reads it on a 100 ms interval and
displays a small subset of raw samples.

## Data available to visualization modules

| Module | Available from current server | Not sent as a ready-to-render value |
|---|---|---|
| Waveform | Raw PCM blocks | A longer time history or downsampled waveform envelope |
| Oscilloscope | Raw PCM blocks | Triggering data or a longer time history |
| Vectorscope | Interleaved left/right sample pairs | Projected XY points or accumulated trace |
| Spectrum | Raw PCM from which a host may calculate a spectrum | FFT bins or frequency-band values |
| Spectrogram | Raw PCM from which a host may calculate spectra | FFT bins over time or spectrogram history |
| Loudness | Raw PCM from which a host may calculate meters | Peak, RMS, or LUFS values |
| VU | Raw PCM from which a host may calculate a VU meter | VU envelope or meter ballistics |

The server does not currently send precomputed peak, RMS, LUFS, frequency-band,
FFT, vectorscope, oscilloscope, spectrogram, or VU data. The existing mobile
client only decodes and displays raw samples; it does not yet calculate those
derived values.

## UI library boundary

The UI library consumes already-prepared module props. It does not decode this
binary protocol, calculate audio metrics, or invent metric fields. If a
visualization's required prop is unavailable, the module renders its waiting or
unavailable state rather than synthesizing data. Host-side analysis is a
separate responsibility.
