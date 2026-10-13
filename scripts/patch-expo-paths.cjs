const fs = require('node:fs');
const path = require('node:path');

// Expo Constants 57.0.21 re-parses an unquoted workspace path through bash -c.
// Apply before pod generation; never edit generated ios/ or android/ projects.
// Upstream issue: https://github.com/expo/expo/issues/48350
function patchExpoPaths(projectRoot) {
  const packageFile = require.resolve('expo-constants/package.json', { paths: [projectRoot] });
  const root = path.dirname(packageFile);
  const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
  if (!version.startsWith('57.')) return;
  const podspecFile = path.join(root, 'ios/EXConstants.podspec');
  const original = fs.readFileSync(podspecFile, 'utf8');
  const oldCommand = String.raw`:script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`;
  const fixedCommand = String.raw`:script => "#{env_vars}bash -l \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`;
  let podspec = original.replace(oldCommand, fixedCommand);
  if (podspec.includes(fixedCommand)) {
    if (!podspec.includes("require 'shellwords'")) podspec = podspec.replace("require 'json'", "require 'json'\nrequire 'shellwords'");
    podspec = podspec.replace("#{ENV['PROJECT_ROOT']} ", "#{ENV['PROJECT_ROOT'].shellescape} ");
    if (podspec !== original) fs.writeFileSync(podspecFile, podspec);
  }
  const scriptFile = path.join(root, 'scripts/get-app-config-ios.sh');
  const script = fs.readFileSync(scriptFile, 'utf8');
  const fixed = script.replace('PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)', 'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")');
  if (fixed !== script) fs.writeFileSync(scriptFile, fixed);
}
module.exports = { patchExpoPaths };
if (require.main === module) patchExpoPaths(process.cwd());
