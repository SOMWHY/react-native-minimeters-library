/**
 * CommonJS-safe access to `react-native-reanimated`.
 *
 * `react-native-reanimated` publishes its declarations as an ECMAScript module
 * (`lib/typescript/package.json` is `{"type":"module"}`), while this package is
 * compiled as CommonJS so `dist` stays loadable by Node (tests, tooling) as
 * well as by Metro. A plain `import` of the runtime therefore fails type
 * checking with TS1479, so the runtime is required once here and typed through
 * an explicit `resolution-mode` import type.
 *
 * Keep this file the only place that touches the Reanimated runtime.
 */
import type { SharedValue } from 'react-native-reanimated' with { 'resolution-mode': 'import' };

type ReanimatedModule = typeof import('react-native-reanimated', { with: { 'resolution-mode': 'import' } });

declare const require: (moduleName: 'react-native-reanimated') => ReanimatedModule;

const reanimated = require('react-native-reanimated');

export const {
  interpolateColor,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} = reanimated;

export type { SharedValue };
