const assert = require('node:assert/strict');
const path = require('node:path');

const appPath = path.resolve(__dirname, '../../minimeters-mobile');
const entryPath = require.resolve('@minimetermobile/ui', { paths: [appPath] });
const packageJson = require('../package.json');

assert.ok(entryPath.includes(`${path.sep}dist${path.sep}`), entryPath);
assert.equal(packageJson.name, '@minimetermobile/ui');
assert.equal(packageJson.main, 'dist/index.js');
assert.equal(packageJson.types, 'dist/index.d.ts');
assert.ok(packageJson.peerDependencies.react);
assert.ok(packageJson.peerDependencies['react-native']);
assert.ok(packageJson.peerDependencies['react-native-reanimated']);
assert.ok(packageJson.peerDependencies['react-native-gesture-handler']);

// Skia and Worklets are provided by the host app (and pinned by its Expo SDK),
// so they must stay peers and never become runtime dependencies of this package.
assert.ok(packageJson.peerDependencies['@shopify/react-native-skia']);
assert.ok(packageJson.peerDependencies['react-native-worklets']);
assert.equal(packageJson.dependencies, undefined);
assert.equal(packageJson.devDependencies['@shopify/react-native-skia'], packageJson.peerDependencies['@shopify/react-native-skia']);
