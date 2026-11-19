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
assert.equal(packageJson.dependencies, undefined);
