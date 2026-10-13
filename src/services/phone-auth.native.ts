import { getApp, initializeApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth, getIdToken, linkWithCredential, onAuthStateChanged, PhoneAuthProvider, signInWithCustomToken as signInNativeToken, signInWithPhoneNumber, signOut as nativeSignOut } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from './auth-client';
import { api } from './api';
import { emulatorHost, usingEmulators } from './firebase';
import { firebaseConfig } from './firebase-config';
import { requirePhoneOtp } from './otp-config';
import { getEmulatorOtp } from './emulator-otp';
import type { OtpConfirmation } from './phone-auth';

async function nativeAuth() {
  if (!usingEmulators) return getAuth();
  let app;
  try { app = getApp('dma-otp-emulator'); }
  // RNFirebase requires a databaseURL string for secondary apps, even when
  // Realtime Database is unused. An empty value keeps it unconfigured.
  catch { app = await initializeApp({ ...firebaseConfig, appId: Platform.OS === 'ios' ? '1:536704319606:ios:b8359d5b5fa2f41e3e5f57' : '1:536704319606:android:aec3ed2447aa26513e5f57', projectId: 'demo-dma-connect', databaseURL: '' }, { name: 'dma-otp-emulator' }); }
  const instance = getAuth(app);
  if (!instance.emulatorConfig) connectAuthEmulator(instance, `http://${emulatorHost}:9099`);
  instance.settings.appVerificationDisabledForTesting = true;
  return instance;
}
async function bridge() {
  const user = (await nativeAuth()).currentUser;
  if (!user) throw new Error('Phone verification could not be completed. Please retry.');
  const { token } = await api<{ token: string }>('exchangeNativeToken', { idToken: await getIdToken(user, true) });
  await signInWithCustomToken(auth, token);
}
export async function beginPhoneOtp(phoneNumber: string, linking = false, onAutomaticError?: (error: unknown) => void): Promise<OtpConfirmation> {
  requirePhoneOtp();
  const instance = await nativeAuth();
  if (linking && auth.currentUser) {
    const { token } = await api<{ token: string }>('createNativeSessionToken');
    const result = await signInNativeToken(instance, token);
    const verificationId = await new PhoneAuthProvider(instance).verifyPhoneNumber(phoneNumber, undefined as never);
    return { confirm: async code => { await linkWithCredential(result.user, PhoneAuthProvider.credential(verificationId, code)); await bridge(); }, dispose: () => {}, testCode: await getEmulatorOtp(phoneNumber, verificationId) };
  }
  const confirmation = await signInWithPhoneNumber(instance, phoneNumber);
  let bridgePromise: Promise<void> | undefined;
  const finish = () => bridgePromise ||= bridge().catch(error => { bridgePromise = undefined; throw error; });
  // Android may verify the SMS before the user enters it. Bridge that native
  // sign-in as well, so an already-consumed code is never required by the UI.
  const stop = onAuthStateChanged(instance, user => {
    if (user?.phoneNumber === phoneNumber) void finish().catch(error => onAutomaticError?.(error));
  });
  return { confirm: async code => {
    if (instance.currentUser?.phoneNumber !== phoneNumber) await confirmation.confirm(code);
    await finish();
  }, dispose: stop, testCode: await getEmulatorOtp(phoneNumber, confirmation.verificationId) };
}
export async function signOutPhone() {
  await signOut(auth);
  await nativeSignOut(await nativeAuth());
}
