// Expo's default config already supports npm workspaces (monorepo).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web build (used only by the browser smoke test): expo-sqlite runs SQLite as WebAssembly and
// needs SharedArrayBuffer, which requires cross-origin isolation headers.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
