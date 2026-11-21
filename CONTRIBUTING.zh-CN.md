[English](CONTRIBUTING.md) · **简体中文**

# 参与贡献

谢谢你看这个项目。本仓库是 MiniMeters Mobile 的可视化层：一批 props 驱动的 React Native 组件，用 Skia 绘制
音频表头。它没有传输层、没有分析、也没有应用状态。

## 动手之前

- **边界就是产品。** 这个库显示已经备好的值。如果一项改动需要解析 PCM、跑 FFT、计算 RMS/LUFS 或者保存历史，
  那它属于宿主应用 —— 或者它需要一个新的显式 prop，而不是偷偷做计算。见
  [`docs/data-contract.zh-CN.md`](docs/data-contract.zh-CN.md)。
- **结构令牌 vs 颜色角色。** 间距、圆角、排版、描边宽度和动效时长来自 `STRUCTURAL_TOKENS`，在所有主题下
  完全一致。主题只携带颜色。硬编码其中任何一个，都是最常见的破坏设计系统的方式。
- **先开 issue**。新增模块或改动 prop 形状都先开 issue。prop 变更会波及宿主应用，那是另一个仓库。

## 环境准备

```sh
npm install
npm run build
npm run typecheck
npm test
```

Expo 示例通过 `file:..` 消费本包，所以要让示例（或工作区里的宿主应用）看到源码改动，必须先跑
`npm run build`。这里没有 watch 构建：请显式重新构建。

## 检查项

提 PR 前这四项都要过：

```sh
npm run typecheck
npm test
npm run lint          # 如果你的检出里有
npm run build         # 发布的产物必须能编译
```

## 测试

- 测试从 `src/` 导入，而不是 `dist/`；除非被测的就是构建产物。
- 宿主应用对这个包跑 Jest 时用的是深引（`@minimetermobile/ui/dist/...`），因为根入口会拉进 Skia 的 ESM 构建，
  Jest 无法转换。请保持 `dist/` 产物可按子路径导入 —— 正是这一点让宿主的测试成为可能。
- 纯函数的存在就是为了不依赖 React 也能测行为：`mapLinear`、`isCanvasReady`、`dragDeltaToCells`、
  `resizeDeltaToSpans`、`shouldArmDrag`、`shouldCancelArm`、`compact`、`normalizeLayout`、
  `buildSpectrogramRamp`、`toSpectrogramPixels`、`resolveSpectrogramState`。新的几何或手势规则先写成纯函数。
- 模块的状态分类（`ready` / `waiting` / `invalid`）三种结果都要测。对退化输入凭空造数据的模块就是 bug，
  哪怕它看起来没问题。

## 约定

- 提交信息用 Conventional Commits：`feat(scope): ...`、`fix(scope): ...`、`docs`、`refactor`、
  `test`、`chore`。一个提交只做一件事。
- **语义化版本。** `0.x` 允许破坏性改动，但必须在提交正文和发布说明里点明 —— 宿主应用是钉住这个包的。
- 不新增运行期依赖。Skia、Reanimated、Gesture Handler、Worklets 都是宿主 Expo SDK 提供的 peer；把它们写成
  `dependency` 会装出第二份，直接破坏渲染。
- 绝不创建第二个 Skia `Canvas`。`VisualizationCanvas` 拥有它。
- 只动颜色。主题切换过程中几何和排版保持固定。
- 公共 API 变更需要在 README 里加一句；行为变更需要加测试。

## Pull Request

- 任何可见的改动请附截图或录屏；这是渲染库。
- 如果你在宿主应用里测过，说明测的是哪个版本。
- 合并前由维护者跑检查并构建一次真机包；请不要自己合并自己的 PR。
