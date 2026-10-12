import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { emulatorHost, firebaseApp, usingEmulators } from './firebase';

// The native SDK exports this helper; its web type entry omits the native-only API.
const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
export const auth = (() => {
  try { return FirebaseAuth.initializeAuth(firebaseApp, { persistence: nativeAuth.getReactNativePersistence(AsyncStorage) }); }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return FirebaseAuth.getAuth(firebaseApp);
    throw error;
  }
})();
if (usingEmulators && !auth.emulatorConfig) FirebaseAuth.connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
