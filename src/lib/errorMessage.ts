type ErrorLike = {
  code?: unknown;
  message?: unknown;
};

const ERROR_CODE_MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in and try again.",
  "permission-denied": "You do not have permission to perform this action.",
  unavailable: "The service is temporarily unavailable. Please try again.",
  "deadline-exceeded": "The request timed out. Please try again.",
  "resource-exhausted": "The service is busy right now. Please try again shortly.",
  "invalid-argument": "Some input values are invalid. Please review and try again.",
  "failed-precondition": "This action cannot be completed right now.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/requires-recent-login": "Please sign out and sign back in, then try again.",
};

function getErrorCodeCandidates(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];
  const candidate = (error as ErrorLike).code;
  if (typeof candidate !== "string") return [];
  const normalized = candidate.trim();
  if (!normalized) return [];

  const candidates = [normalized];
  if (normalized.includes("/")) {
    candidates.push(normalized.slice(normalized.lastIndexOf("/") + 1));
  }
  return [...new Set(candidates)];
}

export function errorHasCode(error: unknown, codes: string[]): boolean {
  const candidates = getErrorCodeCandidates(error);
  if (!candidates.length) return false;
  return codes.some((code) => candidates.includes(code));
}

export function getSafeErrorMessage(error: unknown, fallback: string): string {
  const candidates = getErrorCodeCandidates(error);
  if (!candidates.length) return fallback;

  for (const code of candidates) {
    const message = ERROR_CODE_MESSAGES[code];
    if (message) return message;
  }
  return fallback;
}
