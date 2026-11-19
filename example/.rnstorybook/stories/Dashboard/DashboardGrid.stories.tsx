import {
  BUILT_IN_THEMES,
  DEFAULT_GRID_CONFIG,
  DashboardGrid,
  GRID_PRESETS,
  LoudnessModule,
  ModuleTray,
  OscilloscopeModule,
  SpectrogramModule,
  SpectrumModule,
  VectorscopeModule,
  VuModule,
  WaveformModule,
  setVisibility,
  type DashboardItem,
  type DashboardLayout,
  type LoudnessValues,
  type PcmBlock,
  type VisualizationTheme,
  type VuLevels,
} from '@minimetermobile/ui';
import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { spectrogramRows } from '../../../fixtures/spectrogram-rows';
import { spectrumBins, spectrumDbRange } from '../../../fixtures/spectrum-bins';

const FRAME_SIZE = 256;

/** One shared stereo frame keeps the seven previews visually consistent. */
function makeStereoFrame(): PcmBlock {
  const samples = new Float32Array(FRAME_SIZE * 2);

  for (let index = 0; index < FRAME_SIZE; index += 1) {
    const phase = (index / FRAME_SIZE) * Math.PI * 6;
    const left = Math.sin(phase) * 0.8;

    samples[index * 2] = left;
    samples[index * 2 + 1] = Math.sin(phase + 0.4) * 0.55;
  }

  return { samples, channels: 2, samplesPerChannel: FRAME_SIZE };
}

const stereoFrame = makeStereoFrame();

const vuLevels: VuLevels = {
  left: 0.72,
  right: 0.55,
  leftPeak: 0.85,
  rightPeak: 0.68,
};

const loudnessValues: LoudnessValues = {
  peak: -3.4,
  rms: -18.7,
  lufs: -14.2,
};

/** Every module once, in the order `overview.md` lists them. */
const stableLayout: DashboardLayout = {
  items: [
    item('waveform', 'waveform', 0, 0, 2, 2),
    item('oscilloscope', 'oscilloscope', 0, 2, 1, 1),
    item('vectorscope', 'vectorscope', 1, 2, 1, 1),
    item('spectrum', 'spectrum', 0, 3, 2, 2),
    item('vu', 'vu', 0, 5, 1, 1),
    item('loudness', 'loudness', 1, 5, 1, 1),
    item('spectrogram', 'spectrogram', 0, 6, 2, 2),
  ],
};

function item(
  id: string,
  kind: DashboardItem['kind'],
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): DashboardItem {
  return {
    id,
    kind,
    visible: true,
    label: kind,
    placement: { col, row, colSpan, rowSpan },
  };
}

/** The host owns data injection; the grid only asks for a body per item. */
function renderModule(theme: VisualizationTheme) {
  return (dashboardItem: DashboardItem) => {
    switch (dashboardItem.kind) {
      case 'waveform':
        return <WaveformModule theme={theme} block={stereoFrame} height={150} />;
      case 'oscilloscope':
        return <OscilloscopeModule theme={theme} block={stereoFrame} height={96} />;
      case 'vectorscope':
        return <VectorscopeModule theme={theme} block={stereoFrame} height={96} />;
      case 'spectrum':
        return (
          <SpectrumModule
            theme={theme}
            bins={spectrumBins}
            dbRange={spectrumDbRange}
            height={150}
          />
        );
      case 'vu':
        return <VuModule theme={theme} data={vuLevels} height={96} />;
      case 'loudness':
        return (
          <LoudnessModule
            theme={theme}
            data={loudnessValues}
            height={96}
            dbRange={[-60, 0]}
          />
        );
      case 'spectrogram':
        return (
          <SpectrogramModule
            theme={theme}
            rows={spectrogramRows}
            maxRows={64}
            height={150}
          />
        );
      default:
        return null;
    }
  };
}

function DashboardPreview({
  theme,
  layout,
  editing,
  tray,
}: {
  theme: VisualizationTheme;
  layout: DashboardLayout;
  editing: boolean;
  tray?: boolean;
}) {
  const [current, setCurrent] = useState(layout);

  const restore = (id: string) => {
    setCurrent({
      items: setVisibility(current.items, id, true, DEFAULT_GRID_CONFIG),
    });
  };

  return (
    <View style={{ backgroundColor: '#02030A', padding: 8, flex: 1 }}>
      <DashboardGrid
        layout={current}
        theme={theme}
        config={DEFAULT_GRID_CONFIG}
        metrics={GRID_PRESETS.phone}
        editing={editing}
        renderModule={renderModule(theme)}
        onLayoutChange={setCurrent}
      />
      {tray === true ? (
        <ModuleTray
          hidden={current.items.filter((entry) => !entry.visible)}
          theme={theme}
          onRestore={restore}
        />
      ) : null}
    </View>
  );
}

const meta = {
  title: 'Dashboard/Grid',
  component: DashboardPreview,
  argTypes: {
    theme: {
      control: 'select',
      options: ['midnight', 'ice', 'ember'],
      mapping: BUILT_IN_THEMES,
    },
    layout: { control: false },
    editing: { control: 'boolean' },
    tray: { control: 'boolean' },
  },
  args: {
    theme: BUILT_IN_THEMES.midnight,
    layout: stableLayout,
    editing: false,
    tray: false,
  },
} satisfies Meta<typeof DashboardPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Seven modules on a two-column phone grid — the layout the host ships. */
export const Stable: Story = {};

/** Read-only: no grab bar and no resize corner are rendered at all. */
export const Viewing: Story = {
  args: { editing: false },
};

/** Edit mode: every card grows a grab bar and a resize corner. */
export const Editing: Story = {
  args: { editing: true },
};

/**
 * Drag demo: the card follows the finger as a transform, and only on release is
 * the cell committed through `moveItem`. Displaced neighbours fall into the first
 * free hole, so shapes never swap.
 */
export const Drag: Story = {
  args: {
    editing: true,
    layout: {
      items: [
        item('waveform', 'waveform', 0, 0, 1, 1),
        item('oscilloscope', 'oscilloscope', 1, 0, 1, 1),
        item('vu', 'vu', 0, 1, 1, 1),
        item('loudness', 'loudness', 1, 1, 1, 1),
      ],
    },
  },
};

/**
 * Resize demo: the corner tracks the finger in pixels, then the span snaps to
 * whole cells through `resizeItem` on release. Limits come from the grid config,
 * so a card stops at `maxColSpan` instead of overlapping its neighbour.
 */
export const Resize: Story = {
  args: {
    editing: true,
    layout: {
      items: [
        item('spectrum', 'spectrum', 0, 0, 1, 1),
        item('vectorscope', 'vectorscope', 1, 0, 1, 1),
        item('waveform', 'waveform', 0, 1, 2, 1),
      ],
    },
  },
};

/** The tray lists whatever is hidden; restoring routes through `setVisibility`. */
export const HiddenTray: Story = {
  args: {
    editing: true,
    tray: true,
    layout: {
      items: [
        item('waveform', 'waveform', 0, 0, 2, 1),
        { ...item('vu', 'vu', 0, 1, 1, 1), visible: false },
        { ...item('loudness', 'loudness', 1, 1, 1, 1), visible: false },
      ],
    },
  },
};

/** Restore puts the module in the first free hole, then the grid compacts. */
export const Restored: Story = {
  args: {
    editing: true,
    tray: true,
    layout: {
      items: [
        item('waveform', 'waveform', 0, 0, 2, 1),
        item('vu', 'vu', 0, 1, 1, 1),
        item('loudness', 'loudness', 1, 1, 1, 1),
      ],
    },
  },
};
