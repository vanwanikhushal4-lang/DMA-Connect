import { linkWithPhoneNumber, RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth } from './auth-client';
import { usingEmulators } from './firebase';
import { requirePhoneOtp } from './otp-config';
export type OtpConfirmation = { confirm: (code: string) => Promise<void>; dispose: () => void };
export async function beginPhoneOtp(phoneNumber: string, linking = false, _onAutomaticError?: (error: unknown) => void): Promise<OtpConfirmation> {
  requirePhoneOtp();
  if (typeof document === 'undefined') throw new Error('Phone verification is available in the mobile app or a browser.');
  const container = document.createElement('div');
  document.body.appendChild(container);
  if (usingEmulators) auth.settings.appVerificationDisabledForTesting = true;
  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; verifier.clear(); container.remove(); };
  try {
    const confirmation = linking && auth.currentUser ? await linkWithPhoneNumber(auth.currentUser, phoneNumber, verifier) : await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return { confirm: async code => { await confirmation.confirm(code); }, dispose };
  } catch (error) { dispose(); throw error; }
}
export async function signOutPhone() { await signOut(auth); }
