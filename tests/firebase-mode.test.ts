import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { deleteApp, getApps } from 'firebase/app';

test('test OTP uses the isolated demo in development and never in release bundles', async () => {
  const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  const previousFlag = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
  const sourceRoot = new URL('../src/', import.meta.url).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(specifier + '.ts', context);
      return nextResolve(specifier, context);
    },
  });
  try {
    for (const { dev, flag, expected } of [
      { dev: true, flag: 'true', expected: true },
      { dev: false, flag: 'true', expected: false },
      { dev: true, flag: 'false', expected: false },
    ]) {
      globals.__DEV__ = dev;
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = flag;
      const mode = await import(new URL(`../src/services/firebase.ts?dev=${dev}&flag=${flag}`, import.meta.url).href);
      assert.equal(mode.usingEmulators, expected);
      assert.equal(mode.firebaseApp.options.projectId, expected ? 'demo-dma-connect' : 'dma-connect-foundation');
      assert.equal(mode.firebaseApp.name, expected ? 'dma-connect-emulator' : '[DEFAULT]');
    }
  } finally {
    globals.__DEV__ = previousDev;
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
    else process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = previousFlag;
    hooks.deregister();
    await Promise.all(getApps().map(app => deleteApp(app)));
  }
});
