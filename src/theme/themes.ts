import type { VisualizationTheme } from './types';

function createTheme(theme: VisualizationTheme): VisualizationTheme {
  return Object.freeze({
    ...theme,
    colors: Object.freeze({
      ...theme.colors,
      traces: Object.freeze({ ...theme.colors.traces }),
    }),
  });
}

export const BUILT_IN_THEMES = Object.freeze({
  midnight: createTheme({
    id: 'midnight',
    name: 'Midnight',
    colors: {
      canvas: '#080A12',
      surface: '#10131E',
      grid: '#252A3A',
      axis: '#444B62',
      text: '#DCE1F0',
      textMuted: '#8A91A8',
      accent: '#B85CFF',
      traces: {
        primary: '#A855F7',
        secondary: '#22D3EE',
        left: '#38BDF8',
        right: '#F472B6',
        low: '#6366F1',
        mid: '#D946EF',
        high: '#F97316',
      },
    },
  }),
  ice: createTheme({
    id: 'ice',
    name: 'Ice',
    colors: {
      canvas: '#071015',
      surface: '#0D1920',
      grid: '#1C3039',
      axis: '#385864',
      text: '#DAEEF1',
      textMuted: '#819AA3',
      accent: '#38BDF8',
      traces: {
        primary: '#0EA5E9',
        secondary: '#22D3EE',
        left: '#38BDF8',
        right: '#A78BFA',
        low: '#2DD4BF',
        mid: '#3B82F6',
        high: '#67E8F9',
      },
    },
  }),
  ember: createTheme({
    id: 'ember',
    name: 'Ember',
    colors: {
      canvas: '#120A0B',
      surface: '#1B1012',
      grid: '#372125',
      axis: '#604047',
      text: '#F4E0E2',
      textMuted: '#AD858A',
      accent: '#F43F5E',
      traces: {
        primary: '#F43F5E',
        secondary: '#FB923C',
        left: '#FB7185',
        right: '#F97316',
        low: '#EC4899',
        mid: '#EF4444',
        high: '#FACC15',
      },
    },
  }),
});
