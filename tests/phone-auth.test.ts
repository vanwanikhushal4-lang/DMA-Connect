import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

// Exercise the native entry point with no device or Firebase network access.
async function withRuntime(modules: string[], emulators: boolean, check: (runtime: {
  phone: typeof import('../src/services/phone-auth.native.ts');
  config: typeof import('../src/services/otp-config.ts');
  jsSignOuts: () => number;
  nativeLoads: () => number;
  nativeCalls: unknown[][];
  emulatorCalls: unknown[][];
}) => Promise<void>) {
  const id = randomUUID();
  const sourceUrl = (name: string) => new URL(`../src/services/${name}.ts?case=${id}`, import.meta.url).href;
  const mockUrl = (source: string) => `data:text/javascript,${encodeURIComponent(`// ${id}\n${source}`)}`;
  const jsAuthUrl = mockUrl('export let signOuts = 0; export async function signOut() { signOuts++; }');
  const providerSource = `
    export const calls = [];
    export async function beginPhoneOtp(...args) {
      calls.push(args);
      return { confirm: async () => {}, dispose: () => {} };
    }
    export async function signOutPhone() { calls.push(['signOut']); }
  `;
  const nativeUrl = mockUrl(`// native\n${providerSource}`);
  const emulatorUrl = mockUrl(`// emulator\n${providerSource}`);
  const mocks = new Map([
    ['react-native', mockUrl(`export const TurboModuleRegistry = { get: name => ${JSON.stringify(modules)}.includes(name) ? {} : null };`)],
    ['firebase/auth', jsAuthUrl],
    ['./auth-client', mockUrl('export const auth = {};')],
    ['./firebase', mockUrl(`export const usingEmulators = ${emulators};`)],
    ['./otp-config', sourceUrl('otp-config')],
    ['./phone-auth-runtime', sourceUrl('phone-auth-runtime.native')],
  ]);
  let nativeLoads = 0;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === './phone-auth-native') {
        nativeLoads++;
        return { url: nativeUrl, shortCircuit: true };
      }
      if (specifier === './phone-auth-emulator') return { url: emulatorUrl, shortCircuit: true };
      const url = mocks.get(specifier);
      return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
    },
  });
  try {
    const phone = await import(sourceUrl('phone-auth.native'));
    const config = await import(sourceUrl('otp-config'));
    const jsAuth = await import(jsAuthUrl);
    const native = await import(nativeUrl);
    const emulator = await import(emulatorUrl);
    await check({ phone, config, jsSignOuts: () => jsAuth.signOuts, nativeLoads: () => nativeLoads, nativeCalls: native.calls, emulatorCalls: emulator.calls });
  } finally {
    hooks.deregister();
  }
}

test('Expo Go and incomplete builds use test OTP and sign out without native Firebase', async () => {
  for (const modules of [[], ['NativeRNFBTurboApp'], ['NativeRNFBTurboAuth']]) {
    await withRuntime(modules, true, async ({ phone, config, jsSignOuts, nativeLoads, emulatorCalls }) => {
      assert.equal(nativeLoads(), 0, 'startup must not load native Firebase');
      assert.equal(config.phoneOtpAvailable, true);
      await phone.beginPhoneOtp('+919000000001');
      assert.deepEqual(emulatorCalls, [['+919000000001', false, undefined]]);
      await phone.signOutPhone();
      assert.equal(jsSignOuts(), 1);
      assert.equal(nativeLoads(), 0, 'test OTP and sign-out must not load native Firebase');
    });
  }
});

test('development builds lazily delegate phone verification and sign out both SDKs', async () => {
  await withRuntime(['NativeRNFBTurboApp', 'NativeRNFBTurboAuth'], true, async ({ phone, config, nativeLoads, nativeCalls, jsSignOuts }) => {
    assert.equal(config.phoneOtpAvailable, true);
    assert.equal(nativeLoads(), 0);
    const onError = () => {};
    const confirmation = await phone.beginPhoneOtp('+919000000001', true, onError);
    assert.equal(typeof confirmation.confirm, 'function');
    assert.deepEqual(nativeCalls, [['+919000000001', true, onError]]);
    await phone.signOutPhone();
    assert.equal(jsSignOuts(), 1);
    assert.deepEqual(nativeCalls[1], ['signOut']);
  });
});

test('live SMS stays disabled even when native Firebase is installed', async () => {
  for (const modules of [[], ['NativeRNFBTurboApp', 'NativeRNFBTurboAuth']]) {
    await withRuntime(modules, false, async ({ phone, config, nativeLoads, emulatorCalls }) => {
      assert.equal(config.phoneOtpAvailable, false);
      await assert.rejects(phone.beginPhoneOtp('+919000000001'), { message: config.phoneOtpUnavailableMessage });
      assert.equal(nativeLoads(), 0);
      assert.deepEqual(emulatorCalls, []);
    });
  }
});
