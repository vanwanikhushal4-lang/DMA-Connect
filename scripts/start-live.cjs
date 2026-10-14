const { spawn } = require('node:child_process');

// Explicit opt-out for testing existing email accounts against live Firebase.
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', ...process.argv.slice(2)], {
  env: { ...process.env, EXPO_PUBLIC_USE_FIREBASE_EMULATORS: 'false' },
  stdio: 'inherit', windowsHide: true,
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
