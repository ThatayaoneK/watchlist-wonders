import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export function requireAdmin(request: CallableRequest<unknown>): string {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const isAdmin = auth.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin claim required");
  }
  return auth.uid;
}
