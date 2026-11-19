# MiniMeters UI Storybook

The isolated Expo example runs Storybook on-device. Start it from the workspace
root:

```powershell
npm run start:ui-storybook
```

Stories live in `.rnstorybook/stories/`. Use deterministic local fixtures and
the public `@minimetermobile/ui` exports; stories must not connect to the
MiniMeters server or depend on app connection, scanning, or persistence
services.

The `Workspace smoke` story verifies that the example can load the workspace
package and PCM fixture. Add a story for each visualization as the library
components are implemented.
