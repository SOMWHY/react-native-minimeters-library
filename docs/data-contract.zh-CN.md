[English](data-contract.md) · **简体中文**

# 音频数据契约

本文记录当前服务端发什么、当前手机端解码什么。它不定义新的线上格式，也不意味着 UI 组件库会做音频分析。

## 核对过的源码

这些源文件是在上层 `MiniMetersMobile` 工作区里查阅的；服务端与宿主应用的源码树并不包含在本仓库中：

- 服务端音频采集与排队：`MiniMetersMobileServer/PluginProcessor.cpp`、`MiniMetersMobileServer/AudioBlockQueue.h`
- 服务端帧序列化与广播时机：`MiniMetersMobileServer/WebSocketServer.cpp`
- 协议说明：`MiniMetersMobileServer/protocol/audio_frame.md`
- 手机端二进制解码器：`minimeters-mobile/src/features/monitoring/pcm-frame.ts`
- 手机端 WebSocket 客户端：`minimeters-mobile/src/features/connection/pcm-socket-client.ts`
- 当前的采样监视页：`minimeters-mobile/src/features/monitoring/PcmMonitorScreen.tsx`

## 传输与帧节奏

WebSocket 认证之后，服务端发送二进制帧，不会以 JSON 发送音频。广播线程每 10 ms 触发一次，每次取空队列并
**把排队的每个 block 合并进一个帧**，因此一帧里可能包含多个 DAW block 的连续采样。`samplesPerChannel`
是这一帧的总数，时间戳取最新那个 block 的。投递的 tick 不等于音频采样率。

如果每个 tick 只发一个 block，大约只能达到三分之一实时率 —— 合并正是为此存在。接收方必须根据
`samplesPerChannel` 安排缓冲区，**永远不要假设一帧等于一个 DAW block**。当前措辞见
`MiniMetersMobileServer/protocol/audio_frame.md`。

音频回调目前排队时写入的是零时间戳。序列化时由服务端替换为当前 Unix 毫秒时间。因此这个时间戳大致表示
服务端序列化/发送该 block 的时刻，而不是其首个采样的精确采集时刻。

## 二进制头部

头部的整数字段均为小端序。头部共 32 字节：

| 偏移 | 字节数 | 字段 | 当前含义 |
|---:|---:|---|---|
| 0 | 4 | `magic` | ASCII `MMSA` |
| 4 | 1 | `version` | `1` |
| 5 | 1 | `messageType` | `1` = 音频块 |
| 6 | 2 | `headerSize` | `32` 字节 |
| 8 | 8 | `timestamp` | Unix 纪元毫秒，发送时填充 |
| 16 | 4 | `sampleRate` | 音频采样率（Hz） |
| 20 | 2 | `channels` | 当前处理器写 `2` |
| 22 | 2 | `samplesPerChannel` | 本帧每声道采样数（可能跨多个 DAW block） |
| 24 | 4 | `sampleFormat` | `1` = 小端 IEEE-754 `float32` |
| 28 | 4 | `payloadSize` | PCM 负载字节数 |

负载从第 32 字节开始，包含 `channels * samplesPerChannel` 个 float32。立体声采样交错排列：
`L0, R0, L1, R1, ...`。采样率和 block 大小取决于 DAW 的音频配置。协议未规定采样值的钳制范围。

### 单声道差异

协议正文说单声道输入可以表示为 1 个声道。而当前处理器是把每个单声道采样同时复制到左右、交错后以
`channels = 2` 入队，所以当前网络输出始终是双声道，单声道输入也不例外。本文记录的是实现行为，不修改协议。

## 手机端解码后的形状

手机端解码器校验头部与负载长度，然后产出：

```ts
export type PcmAudioFrame = {
  timestampMs: number;
  sampleRate: number;
  channels: number;
  samplesPerChannel: number;
  samples: Float32Array;
};
```

`samples` 仍是交错的。双声道时，声道 `c`、采样索引 `i` 的值在 `samples[i * channels + c]`。`PcmSocketClient`
只保留最新解码帧；当前监视页以 100 ms 间隔读取它并显示少部分原始采样。

## 可视化模块能拿到的数据

| 模块 | 当前服务端可提供 | 并未以「可直接渲染」的形式发送 |
|---|---|---|
| 波形 | 原始 PCM block | 更长的时间历史，或降采样后的波形包络 |
| 示波器 | 原始 PCM block | 触发数据或更长的时间历史 |
| 矢量示波器 | 交错的左/右采样对 | 投影后的 XY 点或累积轨迹 |
| 频谱 | 原始 PCM，宿主可据此计算频谱 | FFT bin 或频段值 |
| 声谱 | 原始 PCM，宿主可据此计算频谱序列 | 随时间变化的 FFT bin 或声谱历史 |
| 响度 | 原始 PCM，宿主可据此计算表头 | 峰值、RMS 或 LUFS 值 |
| VU | 原始 PCM，宿主可据此计算 VU 表 | VU 包络或表头弹道 |

服务端目前不发送预算好的峰值、RMS、LUFS、频段、FFT、矢量示波器、示波器、声谱或 VU 数据。现有手机端只
解码并显示原始采样，尚未计算这些派生值。

## UI 组件库的边界

UI 组件库消费的是**已经备好**的模块 props。它不解析这套二进制协议、不计算音频指标、不凭空捏造指标字段。
如果某个可视化所需的 prop 不可用，模块渲染自己的 waiting / unavailable 状态，而不是合成数据。宿主侧分析
是另一项独立职责。
