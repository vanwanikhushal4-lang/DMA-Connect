import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

// Run against npm run emulators. Only the isolated demo project is accessed;
// random phone/email identities keep this smoke test independent of demo data.
globalThis.__DEV__ = true;
process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = '127.0.0.1';
const require = createRequire(import.meta.url);
const sdkUrls = new Map(['firebase/app', 'firebase/firestore'].map(name => [name, pathToFileURL(require.resolve(name)).href]));
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    // Match the SDK entry used by Metro on the phone, rather than Node's
    // Auth entry, which deliberately stubs browser/mobile phone credentials.
    if (specifier === 'firebase/auth') return { url: new URL('../node_modules/@firebase/auth/dist/rn/index.js', import.meta.url).href, shortCircuit: true };
    if (sdkUrls.has(specifier)) return { url: sdkUrls.get(specifier), shortCircuit: true };
    if (context.parentURL?.includes('/src/services/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) {
      return nextResolve(specifier + '.ts', context);
    }
    return nextResolve(specifier, context);
  },
});
const { createUserWithEmailAndPassword, deleteUser, signOut } = await import('firebase/auth');
const { doc, getDoc, terminate } = await import('firebase/firestore');
const { deleteApp } = await import('firebase/app');
const { beginPhoneOtp } = await import('../src/services/phone-auth-emulator.ts');
const { auth } = await import('../src/services/auth-client.ts');
const { db, firebaseApp } = await import('../src/services/firebase.ts');
assert.equal(auth.app.options.projectId, 'demo-dma-connect');
assert.ok(auth.emulatorConfig);
const suffix = String(Date.now()).slice(-8);
const phone = '+9197' + suffix;
const linkedPhone = '+9198' + suffix;
try {
  const session = await beginPhoneOtp(phone);
  assert.match(session.testCode, /^\d{6}$/);
  await assert.rejects(session.confirm(session.testCode === '000000' ? '111111' : '000000'), { code: 'auth/invalid-verification-code' });
  await session.confirm(session.testCode);
  assert.equal(auth.currentUser.phoneNumber, phone);
  assert.equal((await getDoc(doc(db, 'accounts', auth.currentUser.uid))).exists(), false);
  session.dispose();
  await assert.rejects(session.confirm(session.testCode), /Request a new/);
  await deleteUser(auth.currentUser);
  console.log('PASS test OTP is displayed, wrong code rejected, correct code signs in, account lookup succeeds, disposed session rejected');

  const legacy = await createUserWithEmailAndPassword(auth, `otp-${suffix}@example.invalid`, 'Demo-password-123!');
  const linking = await beginPhoneOtp(linkedPhone, true);
  assert.match(linking.testCode, /^\d{6}$/);
  await linking.confirm(linking.testCode);
  assert.equal(auth.currentUser.uid, legacy.user.uid);
  assert.equal(auth.currentUser.phoneNumber, linkedPhone);
  const cancelled = await beginPhoneOtp('+9199' + suffix, true);
  await signOut(auth);
  await assert.rejects(cancelled.confirm(cancelled.testCode), /Sign in again/);
  console.log('PASS email account keeps its UID when linking a phone, signed-out account cannot finish linking');
} finally {
  if (auth.currentUser) await signOut(auth);
  await terminate(db);
  await deleteApp(firebaseApp);
  hooks.deregister();
}
