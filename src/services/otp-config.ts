import { usingEmulators } from './firebase';

// Live verification will use a server-side Twilio Verify integration.
// Until that is connected, Firebase phone auth is used only by demo emulators.
export const phoneOtpAvailable = usingEmulators;
export const phoneOtpUnavailableMessage = 'SMS verification is not available yet. Use an existing email account or try again later.';

export function requirePhoneOtp() {
  if (!phoneOtpAvailable) throw new Error(phoneOtpUnavailableMessage);
}
