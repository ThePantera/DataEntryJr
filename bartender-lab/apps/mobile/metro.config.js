// Expo's default config already supports npm workspaces (monorepo).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
