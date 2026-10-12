import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { emulatorHost, firebaseApp, usingEmulators } from './firebase';
export const auth = getAuth(firebaseApp);
if (usingEmulators && !auth.emulatorConfig) connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
