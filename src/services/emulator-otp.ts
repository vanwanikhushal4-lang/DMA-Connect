import { emulatorHost, usingEmulators } from './firebase';

// The Auth emulator exposes test codes for local development. Never query it
// outside emulator mode, and show only the code for this exact phone/session.
export async function getEmulatorOtp(phoneNumber: string, verificationId: string): Promise<string | undefined> {
  if (!usingEmulators) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`http://${emulatorHost}:9099/emulator/v1/projects/demo-dma-connect/verificationCodes`, { signal: controller.signal });
    if (!response.ok) return undefined;
    const data = await response.json() as { verificationCodes?: { phoneNumber: string; sessionInfo: string; code: string }[] };
    const code = data.verificationCodes?.find(row => row.phoneNumber === phoneNumber && row.sessionInfo === verificationId)?.code;
    return code && /^\d{6}$/.test(code) ? code : undefined;
  } catch {
    // Retrieving the display hint must not invalidate the verification session.
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
