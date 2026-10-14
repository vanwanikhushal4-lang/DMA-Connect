import { resolveEmulatorHost } from '../lib/emulator-host';

export const emulatorHost = resolveEmulatorHost(process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST);
