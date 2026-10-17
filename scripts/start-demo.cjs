const { spawn } = require('node:child_process');
const { networkInterfaces } = require('node:os');
const { createConnection } = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const addresses = Object.values(networkInterfaces()).flat().filter(address => address && address.family === 'IPv4' && !address.internal);
const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || addresses[0]?.address || '127.0.0.1';
const env = {
  ...process.env,
  EXPO_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
  EXPO_PUBLIC_BACKEND_API_URL: '',
  EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: host,
  FIREBASE_AUTH_EMULATOR_HOST: `${host}:9099`,
  FIRESTORE_EMULATOR_HOST: `${host}:8180`,
  GCLOUD_PROJECT: 'demo-dma-connect',
};

function listening(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    socket.setTimeout(3000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command exited with code ${code}.`)));
  });
}

async function main() {
  const ports = [9099, 8180, 5001, 9199];
  const ready = await Promise.all(ports.map(listening));
  if (ready.some(value => !value)) {
    throw new Error(`Local demo services are unavailable at ${host} (ports ${ports.filter((_, i) => !ready[i]).join(', ')}). Run npm run emulators in another terminal and wait until it is ready. Set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST if this is the wrong LAN address.`);
  }
  console.log(`Test OTP enabled. Demo Firebase services: ${host}. No SMS will be sent.`);
  await run(['functions/scripts/bootstrap.js', '--project', 'demo-dma-connect', '--phone', '+919000000001', '--district', 'Navi Mumbai', '--apply']);
  const args = process.argv.slice(2);
  const mode = args.includes('--dev-client') ? [] : ['--go'];
  const port = args.includes('--port') ? [] : ['--port', '8081'];
  await run([require.resolve('expo/bin/cli'), 'start', ...mode, '--clear', ...port, ...args]);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
