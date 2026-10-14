import { signOut } from 'firebase/auth';
import { auth } from './auth-client';
import { requirePhoneOtp } from './otp-config';
import { phoneAuthRuntimeAvailable } from './phone-auth-runtime';
import type { OtpConfirmation } from './phone-auth';

// Loading RNFirebase evaluates its native module registry. Defer that until
// phone verification is requested in a build containing the required modules.
export async function beginPhoneOtp(phoneNumber: string, linking = false, onAutomaticError?: (error: unknown) => void): Promise<OtpConfirmation> {
  requirePhoneOtp();
  const provider = phoneAuthRuntimeAvailable
    ? await import('./phone-auth-native')
    : await import('./phone-auth-emulator');
  return provider.beginPhoneOtp(phoneNumber, linking, onAutomaticError);
}

export async function signOutPhone() {
  await signOut(auth);
  if (!phoneAuthRuntimeAvailable) return;
  const native = await import('./phone-auth-native');
  await native.signOutPhone();
}
