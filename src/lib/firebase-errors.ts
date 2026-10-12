export function friendlyFirebaseError(error: unknown) {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists. Please sign in.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'The email or password is incorrect. Please try again.';
    case 'auth/weak-password': return 'Choose a stronger password with at least 8 characters.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/network-request-failed': case 'unavailable': return 'Check your internet connection and try again.';
    case 'auth/too-many-requests': return 'There have been too many attempts. Please wait a moment and try again.';
    case 'permission-denied': return 'These details couldn’t be saved. Check your assigned area and try again.';
    default: return 'Something went wrong. Your details are still here. Please try again.';
  }
}
