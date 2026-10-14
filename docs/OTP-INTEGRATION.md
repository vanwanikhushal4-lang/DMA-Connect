# DMA Connect OTP integration

## Current decision

On 13 October 2026, the owner chose **Twilio for live SMS OTP later** and asked that development continue without waiting for Firebase billing. Twilio is not integrated or activated yet. Do not create an account, purchase SMS, enable Firebase SMS or collect provider credentials as part of the current development step.

Local signup continues to use Firebase Auth emulators. `usingEmulators` requires a development JavaScript bundle (`__DEV__`) and the emulator flag, enabled by the checked-in `.env.development`. `npm start` / `npm run start:demo` check the local services and set the LAN host. Direct Expo commands also enable test mode, with native devices using Metro's host address. `npm run start:live` opts out for live email testing. The emulator generates a fresh code for each session and the app displays it; there is no fixed code. Expo Go uses the emulator REST interface with JS SDK credential verification, while builds containing React Native Firebase retain their native flow. `src/services/otp-config.ts` blocks OTP requests outside emulator mode, and the Expo Go fallback also requires the connected Auth emulator and the demo project.

## Later integration

Preserve the `beginPhoneOtp` / `OtpConfirmation` interface used by the signup screen. Replace its live implementation with calls to a trusted server:

1. Start verification: validate the Indian E.164 phone number, enforce abuse controls and cooldowns, then ask Twilio Verify to send an SMS. Return an opaque verification session to the app, never Twilio credentials or the verification code.
2. Check verification: accept the session and the six-digit code. Only Twilio's server response with `status: approved` proves possession. Bind the session to its original phone and any authenticated legacy UID, expire it and prevent replay.
3. Establish identity: get or create the Firebase Auth user for that verified phone. For an authenticated legacy email account, link the verified phone to the same UID; reject a phone already owned by a different UID rather than merging accounts automatically. Deny disabled accounts.
4. Issue a Firebase custom token for that UID and sign in using the Firebase client SDK. The existing backend reads the phone from the trusted Auth user, and derives appointments/invitations itself; neither the request nor token grants a president role.

Keep the chosen Twilio API key secret on the server, configure a Verify Service for six-digit SMS codes and India delivery, and enforce server-side phone/IP attempt limits. The current mobile UI's resend timer is not an abuse control. Twilio's token length and expiry are service settings; do not trust client timing as verification evidence.

The verification server may use the existing Functions backend or another trusted deployment. Twilio itself does not require Firebase SMS billing. The currently selected Firebase Functions, Storage and scheduled birthday backend has its own production deployment requirements; switching the SMS provider does not deploy those services.

## Acceptance checks when enabled

Verify real handset receipt, wrong and expired codes, resend limits, replay rejection, new member signup, invited president activation, legacy UID preservation, duplicate phone rejection, disabled accounts and iOS/Android/web sessions. Keep emulator mode development-only. Do not report live OTP as working until these checks pass.

References: [Twilio Verify API](https://www.twilio.com/docs/verify/api), [Twilio verification checks](https://www.twilio.com/docs/verify/api/verification-check), [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens).
