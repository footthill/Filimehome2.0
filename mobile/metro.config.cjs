const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..', 'shared'), path.resolve(__dirname, '..', 'src')];
// Shared modules must use the mobile React/dependency tree, not the web React tree.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
// Native packages may have nested dependencies, including virtualized-lists.
// Keep hierarchical lookup while pinning the app's React instance.
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};
module.exports = config;
