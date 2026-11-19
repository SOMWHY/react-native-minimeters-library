# @minimetermobile/ui

Props-driven React Native rendering components for MiniMeters Mobile.

This package is the UI layer only. It does not open a WebSocket, parse audio
protocol frames, calculate audio metrics, manage routes, or persist dashboard
state. The initial package scaffold does not export visualization components;
those will be added in later phases.

## Visual direction

Future components use dark surfaces, compact technical labels, subtle gray/blue
grids, and saturated violet, magenta, red, cyan, blue, and orange audio accents.
The supplied screenshots are references, not assets.

## Development

This folder can be installed and developed as a standalone npm workspace:

```sh
npm install
npm run build
npm run typecheck
npm test
npm run start:ui-example
npm run start:ui-storybook
```

The Expo example consumes this package through a local `file:..` dependency.
