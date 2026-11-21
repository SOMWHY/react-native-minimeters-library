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

const parseVersion = (version) =>
  String(version)
    .replace(/^[>=^~v\s]+/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

const compareVersions = (left, right) => {
  const [a, b] = [parseVersion(left), parseVersion(right)];
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

// Enough range support for the shapes this manifest uses. `^` and `~` are treated
// as lower bounds, which is all this check needs: the dev pin has to reach the
// version the peer range starts at.
const satisfiesRange = (version, range) =>
  String(range)
    .split('||')
    .some((alternative) =>
      alternative
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every((bound) => {
          const match = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(bound);
          const operator = match[1] || '=';
          const order = compareVersions(version, match[2]);
          if (operator === '>=' || operator === '^' || operator === '~') return order >= 0;
          if (operator === '>') return order > 0;
          if (operator === '<=') return order <= 0;
          if (operator === '<') return order < 0;
          return order === 0;
        }),
    );

// Whether the peer spec is a range or a pin, the version installed for local tests
// must fall inside it. Otherwise the suite is not exercising a version that a
// consumer is allowed to install.
for (const name of ['react', 'react-native', '@shopify/react-native-skia', 'react-native-worklets']) {
  const devVersion = packageJson.devDependencies?.[name];
  if (!devVersion) continue;
  assert.ok(
    satisfiesRange(devVersion, packageJson.peerDependencies[name]),
    `${name}: devDependencies ${devVersion} is outside peerDependencies ${packageJson.peerDependencies[name]}`,
  );
}
