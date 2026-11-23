/**
 * Maps Firebase error codes to user-readable messages.
 *
 * Firebase SDKs throw errors with a stable `code` property (e.g.
 * `auth/network-request-failed`) and a developer-oriented `message`. The raw
 * message is fine in logs but not in the UI — surface friendly copy through
 * this helper instead of `error.message`.
 *
 * Unknown codes fall back to the provided `defaultMessage` so callers can
 * tailor the wording per call-site (e.g. "Failed to sign in." vs. "Failed
 * to save your settings.").
 */

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

const AUTH_MESSAGES: Record<string, string> = {
  "auth/network-request-failed":
    "Couldn't reach our servers. Check your connection and try again.",
  "auth/too-many-requests":
    "Too many attempts. Wait a moment, then try again.",
  "auth/user-not-found":
    "No account found with that email.",
  "auth/wrong-password":
    "Incorrect password.",
  "auth/invalid-credential":
    "That email or password didn't match. Try again.",
  "auth/email-already-in-use":
    "An account already exists with that email.",
  "auth/weak-password":
    "Please use at least 6 characters for your password.",
  "auth/requires-recent-login":
    "Please sign out and sign back in to confirm this change.",
  "auth/invalid-email":
    "That email address doesn't look right.",
  "auth/user-disabled":
    "This account has been disabled. Contact support.",
  "auth/popup-closed-by-user":
    "Sign-in window was closed before completing.",
  "auth/cancelled-popup-request":
    "Another sign-in is already in progress.",
  "auth/operation-not-allowed":
    "That sign-in method is not enabled for this app.",
};

const FIRESTORE_MESSAGES: Record<string, string> = {
  "permission-denied":
    "You don't have permission to perform that action.",
  unavailable:
    "Service is temporarily unavailable. Try again in a moment.",
  "failed-precondition":
    "Couldn't complete the action. The data may be out of date — refresh and retry.",
  "deadline-exceeded":
    "Request timed out. Check your connection and try again.",
};

export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as FirebaseLikeError).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

export function getFriendlyFirebaseError(
  error: unknown,
  defaultMessage = "Something went wrong. Please try again.",
): string {
  const code = getErrorCode(error);
  if (!code) {
    if (error instanceof Error && error.message) {
      return error.message.length > 200 ? defaultMessage : error.message;
    }
    return defaultMessage;
  }

  if (code in AUTH_MESSAGES) return AUTH_MESSAGES[code];
  if (code in FIRESTORE_MESSAGES) return FIRESTORE_MESSAGES[code];

  return defaultMessage;
}
