import { createContext, useContext } from 'react';

import type { DrawingContextValue } from './types';

export const DrawingContext = createContext<DrawingContextValue | null>(null);

export function useDrawingContext(): DrawingContextValue {
  const context = useContext(DrawingContext);

  if (context === null) {
    throw new Error(
      'useDrawingContext must be used within a VisualizationCanvas.',
    );
  }

  return context;
}
