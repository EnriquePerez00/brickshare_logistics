const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages
//    First look in apps/mobile/node_modules, then monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Explicit mapping for the shared workspace package
config.resolver.extraNodeModules = {
  '@brickshare/shared': path.resolve(monorepoRoot, 'packages/shared'),
};

// 4. Ensure we don't resolve duplicate react/react-native from root
config.resolver.disableHierarchicalLookup = true;

module.exports = config;