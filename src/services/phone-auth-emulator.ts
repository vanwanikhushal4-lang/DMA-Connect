import { linkWithCredential, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './auth-client';
import { emulatorHost, usingEmulators } from './firebase';
import { getEmulatorOtp } from './emulator-otp';
import { requirePhoneOtp } from './otp-config';
import type { OtpConfirmation } from './phone-auth';

// Expo Go has no RNFirebase native modules. The local Auth emulator can issue
// a verification session over REST; the JS SDK still verifies the entered code
// and persists the resulting Firebase session, including legacy-account linking.
export async function beginPhoneOtp(phoneNumber: string, linking = false, _onAutomaticError?: (error: unknown) => void): Promise<OtpConfirmation> {
  requirePhoneOtp();
  if (!usingEmulators || !auth.emulatorConfig || auth.app.options.projectId !== 'demo-dma-connect') {
    throw new Error('Test phone verification requires the local demo Auth emulator.');
  }
  const user = linking ? auth.currentUser : null;
  if (linking && !user) throw new Error('Sign in again before linking your phone number.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`http://${emulatorHost}:9099/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${encodeURIComponent(auth.app.options.apiKey || 'demo-key')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, recaptchaToken: 'emulator' }), signal: controller.signal,
    });
  } catch {
    throw new Error('Cannot reach the local test server. Start the Firebase emulators and connect your phone and computer to the same network.');
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json() as { sessionInfo?: string; error?: { message?: string } };
  if (!response.ok || !data.sessionInfo) {
    const code = data.error?.message?.split(' : ')[0].toLowerCase().replace(/_/g, '-') || 'internal-error';
    throw Object.assign(new Error('The test server could not start phone verification.'), { code: `auth/${code}` });
  }
  const verificationId = data.sessionInfo;
  let disposed = false;
  return {
    testCode: await getEmulatorOtp(phoneNumber, verificationId),
    dispose: () => { disposed = true; },
    confirm: async code => {
      if (disposed) throw new Error('Request a new verification code.');
      const credential = PhoneAuthProvider.credential(verificationId, code);
      if (linking) {
        if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Sign in again before linking your phone number.');
        await linkWithCredential(user, credential);
      } else {
        await signInWithCredential(auth, credential);
      }
    },
  };
}
