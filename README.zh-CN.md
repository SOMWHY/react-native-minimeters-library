[English](README.md) · **简体中文**

# @minimetermobile/ui

[![npm 版本](https://img.shields.io/npm/v/@minimetermobile/ui.svg)](https://www.npmjs.com/package/@minimetermobile/ui)
[![许可证](https://img.shields.io/npm/l/@minimetermobile/ui.svg)](LICENSE)

面向 MiniMeters Mobile 的、由 props 驱动的 React Native 渲染组件。

本包只负责 UI 层。它不建立 WebSocket、不解析音频协议帧、不计算音频指标、不做路由，也不持久化仪表盘
状态。它渲染可视化模块（波形、示波器、矢量示波器、频谱、VU、响度、声谱）以及它们共用的 Skia 基础层；
音频分析始终归宿主应用所有。

## 安装

```sh
npm install @minimetermobile/ui
```

已发布到 npm：[`@minimetermobile/ui`](https://www.npmjs.com/package/@minimetermobile/ui)。
对等依赖请通过你自己的 Expo SDK 安装 —— Skia 与 Worklets 必须与宿主构建一致，不能由本包提供。

## 视觉方向

组件使用深色底、紧凑的技术感标签、克制的灰/蓝网格，以及饱和度较高的紫、品红、红、青、蓝、橙作为音频
强调色。仓库里的截图是参考，不是资源文件。

## 渲染基础

每个模块都由两类数据驱动：

- **结构令牌**（`STRUCTURAL_TOKENS`）是间距、圆角、排版、层级、描边宽度、网格密度、固定状态色和动效
  时长的唯一来源。它们被深度冻结，在所有主题下完全一致。
- **颜色角色**（`VisualizationColors`）来自 `VisualizationTheme`。主题只携带颜色，永远不会覆盖结构值。

```ts
import { BUILT_IN_THEMES, STRUCTURAL_TOKENS } from '@minimetermobile/ui';

BUILT_IN_THEMES.midnight; // 另有 .ice、.ember
STRUCTURAL_TOKENS.grid.subdivisions;
STRUCTURAL_TOKENS.strokeWidth.hairline;
```

每个主题都暴露同一组角色：`canvas`、`surface`、`grid`、`axis`、`text`、`textMuted`、`accent`，以及
`traces.{primary,secondary,left,right,low,mid,high}`。

### 画布与绘制上下文

`VisualizationCanvas` 是唯一创建 Skia `Canvas` 的组件。它测量宿主视图、绘制背景与共享网格，并向下提供
绘制上下文：

```tsx
import {
  BUILT_IN_THEMES,
  VisualizationCanvas,
  useDrawingContext,
} from '@minimetermobile/ui';
import { Path, Skia } from '@shopify/react-native-skia';

function Trace() {
  const { width, height, colors, tokens, mapX, mapY } = useDrawingContext();
  // mapX 把定义域映射到 [0, width]；mapY 映射到 [height, 0]（音频向上生长）
  // ...用你自己的数据构建 Skia path...
}

<View style={{ height: 240 }}>
  <VisualizationCanvas theme={BUILT_IN_THEMES.midnight}>
    <Trace />
  </VisualizationCanvas>
</View>;
```

`useDrawingContext()` 返回 `width`、`height`、`theme`、`colors`（每个颜色角色一个动画 `SharedValue<string>`）、
`tokens`（即 `STRUCTURAL_TOKENS`）、`mapX` 和 `mapY`。在 `VisualizationCanvas` 之外调用它会抛错。

模块作者的规矩：

- 用注入的网格、颜色角色和结构令牌；不要硬编码颜色、描边宽度或排版。
- 只动颜色。主题切换通过 Reanimated 在 UI 线程插值颜色；几何和排版保持固定。
- 不要另建 Skia `Canvas`。
- 尺寸为 0 时渲染空内容而不是抛错，所以模块不能假设首次布局过程中画布已经就绪。
- `mapX`/`mapY` 是线性且不钳制的；非有限输入抛 `TypeError`，退化定义域抛 `RangeError`。

纯函数 `mapLinear` 和 `isCanvasReady` 也导出了，便于测试。

## 可视化模块

本次发布包含七个模块。每一个都是 props 驱动的界面：宿主应用负责解码、分析和历史，交给模块的是
**可直接显示**的值。

| 模块 | Props | 绘制内容 |
| --- | --- | --- |
| `WaveformModule` | `frames`（或 `block`）、`channel`、`columns` | **近期历史**的填充 min/max 包络，加上零轴 |
| `OscilloscopeModule` | `block`、`channel`、`points`、`trigger` | 不透底面上的折线；`points` 默认取 block 自身采样数，`trigger`（默认 `'rising'`，或 `'none'`）以第一个上升过零点锚定轨迹，使稳定音高静止不动 |
| `VectorscopeModule` | `block`、`points` | 投影后的立体声散点，带对角线与 mid-side 轴 |
| `SpectrumModule` | `bins`、`dbRange` | 归一化 dB 曲线下的填充区域，`low`→`high` 渐变 |
| `VuModule` | `data: { left, right, leftPeak?, rightPeak? }`、`readout?` | 渐变轨道上的两根条，可选峰值刻度和可选的角落读数（例如 `-14.2 LUFS`） |
| `LoudnessModule` | `data: { peak, rms, lufs }`、`dbRange` | 三个水平 dB 表，带数字读数 |
| `SpectrogramModule` | `rows`、`maxRows` | RGBA 历史图 —— 横轴是时间（最新在右），纵轴是频率（最低 bin 在底部），强度经 `SPECTROGRAM_GAMMA` 曲线化 |

每个模块还接受 `theme`、`height`、`label` 和 `style`。`label` 是可选加入的：不传就不画标题，这在仪表盘卡片
里正合适 —— 卡片本身已经有标题了。

```tsx
import { WaveformModule, BUILT_IN_THEMES } from '@minimetermobile/ui';

// 波形是历史视图：给它最近几秒的数据，按从旧到新排列。
<WaveformModule
  theme={BUILT_IN_THEMES.midnight}
  frames={recentBlocks}
  height={160}
/>;
```

`WaveformModule` 接收 `frames` —— 覆盖 `WAVEFORM_HISTORY_SECONDS`（3 秒）的、按时序排列的 `PcmBlock` 列表 ——
并按时片各画一列 min/max，正是这一点让起音、持续和空隙可见。仍接受单个 `block` 作为兜底，但单块只能画出
一个瞬间，和 `OscilloscopeModule` 无法区分；这也是两个模块分开存在的原因。

### 数据准备边界

组件库负责**显示**，不负责分析。它从不解析线上格式，也从不计算 FFT、峰值、RMS 或 LUFS。具体来说：

- PCM 模块接收交错的 `PcmBlock`（`{ samples, channels, samplesPerChannel }`）。抽取到列/点是显示变换，
  不是音频指标，所以放在这里做。
- `SpectrumModule` 接收宿主已经算好的 dB 幅度 bin。
- `SpectrogramModule` 接收宿主已经算好的归一化行（`0..1`，从旧到新），并按横轴时间、纵轴频率绘制：
  `rows[i]` 成为图像的一列（最旧在左，最新在右），`rows[i][0]`（最低频 bin）落在最底部像素行。
- `VuModule` 接收归一化 `0..1` 电平；`LoudnessModule` 接收 dB 值。

权威的边界说明见 `docs/data-contract.zh-CN.md`。

## 仪表盘容器

`DashboardGrid` 把模块摆在整数单元格网格上，自身不持有状态：宿主传入 `DashboardLayout`，并通过
`onLayoutChange` 收到每一次落定后的变更。

```tsx
import {
  DashboardGrid,
  compact,
  DEFAULT_GRID_CONFIG,
  GRID_PRESETS,
  WaveformModule,
  BUILT_IN_THEMES,
} from '@minimetermobile/ui';

const THEME = BUILT_IN_THEMES.midnight;

const [layout, setLayout] = useState<DashboardLayout>(() => ({
  items: compact(initialItems, DEFAULT_GRID_CONFIG),
}));

<DashboardGrid
  layout={layout}
  theme={THEME}
  config={DEFAULT_GRID_CONFIG}
  metrics={GRID_PRESETS.phone}
  editing={editing}
  onLayoutChange={setLayout}
  renderModule={(item, rect) => (
    <WaveformModule theme={THEME} block={blocks[item.id]} height={rect.height} />
  )}
/>;
```

`renderModule` 还会收到解析后的 `CellRect`。把 `rect.height` 作为模块高度传进去，图表才能填满用户调整过的
卡片 —— 只有网格知道测量出来的列宽。

### 布局模型

- `DashboardItem` 是 `{ id, kind, placement: { col, row, colSpan, rowSpan }, visible, label? }`。网格画出来的
  一切都来自这个对象。
- 隐藏项在数组里保留自己的位置。重力压实会跳过它们，所以删掉一张卡片不会永久占住它以后可能想要的空位。
- 每个变更函数都返回新的 `DashboardItem[]`，从不修改入参（`moveItem`、`resizeItem`、`setVisibility`、
  `compact`、`normalizeLayout`、`resetLayout`）。
- `moveItem` 和 `resizeItem` 把卡片放到目标位置就停。它们**不会**随后压实，所以移动一张卡片不会在用户
  背后把其余布局重新洗一遍。想要重力效果就显式调 `compact`。
- 当跨度会超过 `maxColSpan`、`maxRowSpan` 或发生碰撞时，`resizeItem` 会钳制到最后一个合法跨度 ——
  卡片停在最后合法尺寸，而不是压到邻居身上。

### 编辑交互

拖拽和缩放是 `PanResponder` 手势，不是 Reanimated worklet：拖拽路径只在松手时写入一次落定后的布局，
中途没有任何东西对布局数组做动画。

- 编辑模式下整张卡片都是拖拽面，但只有静止按住 `DRAG_HOLD_MS`（150 ms）之后才开始拖拽。在此之前 responder
  保持被动，所以普通滑动是滚动页面而不是拿起卡片 —— 网格放在 `ScrollView` 里时最常出问题的正是这一点。
- `shouldArmDrag` / `shouldCancelArm` / `DRAG_CANCEL_DISTANCE` 就是那个按住规则背后的纯函数：在按住成立
  之前移动超过取消距离，手势就交还给滚动视图。
- responder 回调只创建一次，并通过 ref 读取，所以手势过程中的重渲染不可能把它从 PanResponder 底下换掉。
- 手势中卡片通过 `transform`（拖拽）或像素尺寸增量（缩放）跟随手指。松手之前布局数组完全不动，因此
  `onLayoutChange` 只会带着宿主能直接持久化的位置触发。
- 缩放手柄是一个 32 dp 的角部命中区域（带 `hitSlop`）—— 拇指够大，而且它是把变小的卡片拉大，而不是把
  目标埋起来。
- `dragDeltaToCells` 和 `resizeDeltaToSpans` 把像素增量换算成单元格目标并钳制到网格内；两者都是纯函数，
  且不依赖 React 就能单测。
- 非编辑模式下根本不创建 responder，所以网格上的滚动手势永远不会被拦截。
- `ModuleTray` 列出隐藏的模块，并通过 `setVisibility` 恢复它们（找一个空位再重新压实）。所有模块都可见时
  它不渲染任何内容。
- 卡片只画一个标题，不是两个：模块不再默认设置 `label`，卡片头部保持 `label ?? id`。

### 模块状态

每个模块在绘制前先分类输入，绝不凭空造数据：

- `ready` —— 输入存在、有限、结构一致。
- `waiting` —— 输入缺失、为 `null` 或为空。界面显示 `WAITING FOR DATA`。
- `invalid` —— 输入存在但非有限或结构不一致（`samplesPerChannel` 不匹配、把单声道 block 交给矢量示波器、
  dB 窗口反向、声谱行参差不齐）。界面显示 `INVALID DATA`。

声谱是唯一绘制不透明图像而非透明轨迹的模块，所以它的色带从 `colors.surface` 起步：第 0 档是静音，之后才是
三个轨迹色调。这样一张安静的声谱卡片与空卡片无法区分，而只由轨迹色构建的色带会把整块画成
`traces.low`。`buildSpectrogramRamp` 负责构建它，并在主题颜色不是纯十六进制时回退到中性灰色带。

仍然有意义但超范围的值会被钳制而不是拒绝：VU 电平超过 `1` 钳到满量程，dB 值超出 `dbRange` 钳到表的
两端。`ModuleSurface` 渲染共享外壳（宿主视图、单个 `VisualizationCanvas`，以及 React Native 的标签/读数
覆盖层），所以模块文字留在 React Native 里，不会打包 Skia 字体资源。

`VisualizationCanvas` 拥有 `Canvas` 并提供绘制上下文，因此模块内容可以调用 `useDrawingContext` 而无需知道
自己挂在哪。在 Android 上画布是 `TextureView`：这样图层化的宿主（`Animated` 包装、透明覆盖层）会合成
图表，而不是留下一个黑洞。

仪表盘容器同样只是显示层：它摆放模块并报告用户把它们放到了哪里。布局持久化、编辑模式外观、按设备偏好，
都归宿主应用。

## 对等依赖

宿主应用提供 React Native、Reanimated、Gesture Handler、Skia 和 Worklets。Skia 与 Worklets 的版本由宿主的
Expo SDK 钉住，这也是它们在这里是 peer、永远不是运行期依赖的原因。

## 暂缓

暂不支持导入 MiniMeters 的 INI 主题：等有真实样本或权威格式来源再说。

## 开发

这个目录可以作为独立的 npm workspace 安装和开发：

```sh
npm install
npm run build
npm run typecheck
npm test
npm run start:ui-example
npm run start:ui-storybook
```

Expo 示例通过本地 `file:..` 依赖消费本包，并承载画布基础层在设备上的 Storybook 预览。

## 参与贡献

见 [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md)。
