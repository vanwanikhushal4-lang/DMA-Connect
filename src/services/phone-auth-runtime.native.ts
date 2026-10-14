import { TurboModuleRegistry } from 'react-native';

// Check without importing RNFirebase, which throws when a module is absent
// (for example, in Expo Go or a development build made before it was added).
export const phoneAuthRuntimeAvailable =
  TurboModuleRegistry.get('NativeRNFBTurboApp') !== null &&
  TurboModuleRegistry.get('NativeRNFBTurboAuth') !== null;
