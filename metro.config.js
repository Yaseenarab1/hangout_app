const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Lock Metro to THIS folder. Without this, Metro can wander up the tree
// looking for node_modules and end up at /Users/yassenarab/Desktop/hangout_app
// instead of the actual project at hangout_app/Phase1/hangout-planner.
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

