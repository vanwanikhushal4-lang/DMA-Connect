const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const { patchExpoPaths } = require('../scripts/patch-expo-paths.cjs');
module.exports = config => {
  config = withXcodeProject(config, config => {
    const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};
    for (const phase of Object.values(phases)) {
      if (!phase?.shellScript || !phase.name?.includes('Bundle React Native code and images')) continue;
      const script = JSON.parse(phase.shellScript);
      const lines = script.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('`') || !trimmed.endsWith('`') || !trimmed.includes('react-native-xcode.sh')) return line;
        const expression = trimmed.slice(1, -1);
        return `REACT_NATIVE_BUNDLE_SCRIPT="$(${expression})"\n"$REACT_NATIVE_BUNDLE_SCRIPT"`;
      });
      phase.shellScript = JSON.stringify(lines.join('\n'));
    }
    return config;
  });
  return withDangerousMod(config, ['ios', config => {
    patchExpoPaths(config.modRequest.projectRoot);
    return config;
  }]);
};
