import Constants from 'expo-constants';
import { resolveEmulatorHost } from '../lib/emulator-host';

// A physical phone must reach the computer hosting Metro, not its own localhost.
export const emulatorHost = resolveEmulatorHost(
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
  __DEV__ ? Constants.expoConfig?.hostUri : undefined,
);
