/* eslint-disable no-console */
/**
 * One-shot script to set the `admin: true` custom claim on a Firebase Auth user.
 *
 * Usage (from functions/ dir):
 *   npx ts-node scripts/grantAdmin.ts <uid>
 *   npx ts-node scripts/grantAdmin.ts <uid> --revoke
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key
 * with the "Firebase Authentication Admin" role.
 */
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  const uid = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!uid) {
    console.error("Usage: grantAdmin.ts <uid> [--revoke]");
    process.exit(1);
  }
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const existing = user.customClaims ?? {};
  const next = { ...existing, admin: revoke ? false : true };
  await auth.setCustomUserClaims(uid, next);
  console.log(`✓ ${revoke ? "Revoked" : "Granted"} admin claim for ${user.email ?? uid}`);
  console.log("  User must sign out and back in (or refresh ID token) for the new claim to take effect.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
