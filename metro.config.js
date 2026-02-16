const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WatermelonDB configuration - add db file support
config.resolver.assetExts.push('db');

module.exports = config;
