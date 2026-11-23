/**
 * One-off script to grant or revoke the `admin` Firebase custom claim.
 *
 * Prerequisites:
 *   - Firebase CLI logged in: firebase login
 *   - Or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file path.
 *
 * Usage:
 *   node scripts/set-admin-claim.mjs <email-or-uid> [--revoke]
 *
 * Examples:
 *   node scripts/set-admin-claim.mjs tony@example.com
 *   node scripts/set-admin-claim.mjs tony@example.com --revoke
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2).filter(Boolean);
const target = args.find((a) => !a.startsWith('--'));
const revoke = args.includes('--revoke');

if (!target) {
  console.error('Usage: node scripts/set-admin-claim.mjs <email-or-uid> [--revoke]');
  process.exit(1);
}

// Use application default credentials (firebase login sets these up)
initializeApp({ credential: applicationDefault(), projectId: 'watch-wonders' });

const auth = getAuth();

async function run() {
  // Accept either a UID or an email address
  let uid = target;
  if (target.includes('@')) {
    const user = await auth.getUserByEmail(target);
    uid = user.uid;
    console.log(`Resolved ${target} → uid: ${uid}`);
  }

  const claim = revoke ? {} : { admin: true };
  await auth.setCustomUserClaims(uid, claim);

  const verb = revoke ? 'revoked' : 'granted';
  console.log(`✓ Admin claim ${verb} for uid: ${uid}`);
  console.log('The user must sign out and sign back in for the change to take effect.');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
