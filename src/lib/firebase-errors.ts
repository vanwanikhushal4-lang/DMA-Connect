export function friendlyFirebaseError(error: unknown) {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-verification-code': return 'That verification code is incorrect. Check the code and try again.';
    case 'auth/code-expired': case 'auth/session-expired': return 'This code has expired. Request a new verification code.';
    case 'auth/invalid-phone-number': return 'Enter a valid mobile number with its country code.';
    case 'auth/billing-not-enabled': case 'auth/operation-not-allowed': return 'Phone verification has not been activated yet. Contact the foundation administrator.';
    case 'auth/credential-already-in-use': return 'This phone number is already linked to another account. Sign in using phone OTP.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Please sign in.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'The email or password is incorrect. Please try again.';
    case 'auth/weak-password': return 'Choose a stronger password with at least 8 characters.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/network-request-failed': case 'unavailable': return 'Check your internet connection and try again.';
    case 'auth/too-many-requests': return 'There have been too many attempts. Please wait a moment and try again.';
    case 'permission-denied': return 'These details couldn’t be saved. Check your assigned area and try again.';
    default: return !code && error instanceof Error ? error.message : 'Something went wrong. Your details are still here. Please try again.';
  }
}
