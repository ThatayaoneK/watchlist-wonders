import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';
import { resolveAppUrl } from './config';

const resendApiKey = defineSecret('RESEND_API_KEY');

let firestoreDb: Firestore | null = null;

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  if (!getApps().length) initializeApp();
  firestoreDb = getFirestore();
  return firestoreDb;
}

function ensureInit(): void {
  if (!getApps().length) initializeApp();
}

/** Max lookahead: schedules whose reminder fires within this window are eligible. */
const MAX_OFFSET_MINUTES = 43200;

interface PrivateProfile {
  fcm_token?: string | null;
  push_enabled?: boolean;
  email_reminders_enabled?: boolean;
}

interface ScheduleData {
  user_id?: string;
  bookmark_id?: string;
  scheduled_for?: string;
  reminder_offset_minutes?: number;
  state?: string;
}

interface BookmarkData {
  title?: string;
  type?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(
  title: string,
  scheduledFor: Date,
  reminderOffsetMinutes: number,
  appUrl: string,
): string {
  const escapedTitle = escapeHtml(title);
  const escapedAppUrl = escapeHtml(appUrl);
  const watchTime = scheduledFor.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const countdown =
    reminderOffsetMinutes === 0
      ? 'Starting now'
      : `Starts in ${reminderOffsetMinutes} minute${reminderOffsetMinutes === 1 ? '' : 's'}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>${escapedTitle} — WatchMarks Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <span style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${countdown} — ${escapedTitle}
  </span>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#141414;border-radius:8px;overflow:hidden;border:1px solid #2a2a2a;">

          <!-- Red accent bar -->
          <tr>
            <td style="background-color:#E50914;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Wordmark -->
                    <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
                      Watch<span style="color:#E50914;">Marks</span>
                    </span>
                  </td>
                  <td align="right">
                    <!-- Badge -->
                    <span style="display:inline-block;background-color:#E50914;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:4px 10px;border-radius:4px;">
                      Reminder
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background-color:#2a2a2a;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <!-- Countdown pill -->
              <div style="display:inline-block;background-color:#1f1f1f;border:1px solid #333;border-radius:100px;padding:6px 16px;margin-bottom:20px;">
                <span style="font-size:13px;font-weight:600;color:#E50914;letter-spacing:0.3px;">
                  &#9200; ${escapeHtml(countdown)}
                </span>
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.3px;">
                ${escapedTitle}
              </h1>

              <!-- Scheduled time -->
              <p style="margin:0 0 28px;font-size:14px;color:#888888;line-height:1.5;">
                Scheduled for&nbsp;&nbsp;<span style="color:#cccccc;font-weight:600;">${escapeHtml(watchTime)}</span>
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#E50914;border-radius:4px;">
                    <a href="${escapedAppUrl}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      Open WatchMarks &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                You're receiving this because email reminders are enabled in your WatchMarks account.
                You can turn them off in&nbsp;<a href="${escapedAppUrl}/settings" target="_blank" style="color:#888888;text-decoration:underline;">Settings</a>.
              </p>
            </td>
          </tr>

        </table>
        <!-- / Email card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const sendReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    memory: '256MiB',
    timeoutSeconds: 300,
    secrets: [resendApiKey],
  },
  async () => {
    ensureInit();
    const db = getDb();
    const messaging = getMessaging();
    const auth = getAuth();
    const appUrl = resolveAppUrl();
    const now = new Date();

    // Upper bound: only fetch schedules that could have a reminder due now.
    // The latest a reminder fires is reminder_offset_minutes before scheduled_for,
    // so scheduled_for must be <= now + MAX_OFFSET_MINUTES.
    const upperBound = new Date(now.getTime() + MAX_OFFSET_MINUTES * 60 * 1000).toISOString();

    let schedulesSnap;
    try {
      schedulesSnap = await db
        .collectionGroup('schedules')
        .where('state', '==', 'scheduled')
        .where('scheduled_for', '<=', upperBound)
        .get();
    } catch (err) {
      logger.error('[reminders] Failed to query schedules', { error: String(err) });
      return;
    }

    if (schedulesSnap.empty) {
      logger.info('[reminders] No eligible schedules found.');
      return;
    }

    // Collect schedules whose reminder time has passed
    interface DueSchedule {
      docRef: FirebaseFirestore.DocumentReference;
      uid: string;
      data: ScheduleData;
    }

    const due: DueSchedule[] = [];
    for (const snap of schedulesSnap.docs) {
      const data = snap.data() as ScheduleData;
      const scheduledFor = data.scheduled_for ? new Date(data.scheduled_for) : null;
      if (!scheduledFor || isNaN(scheduledFor.getTime())) continue;

      const offsetMs = (data.reminder_offset_minutes ?? 60) * 60 * 1000;
      const reminderAt = new Date(scheduledFor.getTime() - offsetMs);
      if (reminderAt > now) continue; // Not yet time

      // Extract uid from path: users/{uid}/schedules/{id}
      const uid = snap.ref.parent?.parent?.id;
      if (!uid) continue;

      due.push({ docRef: snap.ref, uid, data });
    }

    if (due.length === 0) {
      logger.info('[reminders] No reminders due at this time.');
      return;
    }

    logger.info(`[reminders] Processing ${due.length} due reminder(s).`);

    // Batch-fetch unique private profiles
    const uniqueUids = [...new Set(due.map((d) => d.uid))];
    const profileMap = new Map<string, PrivateProfile>();
    await Promise.all(
      uniqueUids.map(async (uid) => {
        try {
          const snap = await db.doc(`users/${uid}/profile/private`).get();
          profileMap.set(uid, (snap.data() as PrivateProfile) ?? {});
        } catch {
          profileMap.set(uid, {});
        }
      }),
    );

    // Batch-fetch user emails from Firebase Auth
    const emailMap = new Map<string, string>();
    await Promise.all(
      uniqueUids.map(async (uid) => {
        try {
          const record = await auth.getUser(uid);
          if (record.email) emailMap.set(uid, record.email);
        } catch {
          // User may have been deleted
        }
      }),
    );

    // Batch-fetch bookmark titles
    const bookmarkMap = new Map<string, BookmarkData>();
    const bookmarkKeys = new Map(due.filter(d => d.data.bookmark_id).map(d => [`${d.uid}/${d.data.bookmark_id}`, d]));
    await Promise.all([...bookmarkKeys].map(async ([key, item]) => {
      try {
        const snap = await db.doc(`users/${item.uid}/bookmarks/${item.data.bookmark_id}`).get();
        const data = snap.data();
        if (data) bookmarkMap.set(key, { title: data.schemaVersion === 2 ? data.media?.title : data.title });
      } catch { /* Delivery can still use its generic title. */ }
    }));
    // Build Resend client (only if needed)
    const emailEnabled = due.some(({ uid }) => profileMap.get(uid)?.email_reminders_enabled);
    let resend: Resend | null = null;
    if (emailEnabled && resendApiKey.value()) {
      resend = new Resend(resendApiKey.value());
    }

    let sent = 0;
    let failed = 0;

    await Promise.all(
      due.map(async ({ docRef, uid, data }) => {
        const profile = profileMap.get(uid) ?? {};
        const email = emailMap.get(uid);
        const bookmark = data.bookmark_id ? bookmarkMap.get(`${uid}/${data.bookmark_id}`) : undefined;
        const title = bookmark?.title ?? 'Your show';
        const scheduledFor = new Date(data.scheduled_for!);
        const offsetMinutes = data.reminder_offset_minutes ?? 60;

        const notifTitle = `Time to watch: ${title}`;
        const notifBody = `Starts in ${offsetMinutes} minute${offsetMinutes === 1 ? '' : 's'}`;

        const tasks: Promise<void>[] = [];

        // Push notification
        if (profile.push_enabled && profile.fcm_token) {
          tasks.push(
            messaging
              .send({
                token: profile.fcm_token,
                notification: { title: notifTitle, body: notifBody },
                webpush: {
                  notification: {
                    title: notifTitle,
                    body: notifBody,
                    icon: '/icons/icon-192x192.png',
                  },
                  fcmOptions: { link: '/' },
                },
              })
              .then(() => {
                logger.info('[reminders] Push sent', { uid });
              })
              .catch((err: unknown) => {
                logger.warn('[reminders] Push failed', { uid, error: String(err) });
                throw err;
              }),
          );
        }

        // Email via Resend
        if (profile.email_reminders_enabled && email && resend) {
          tasks.push(
            resend.emails
              .send({
                from: 'WatchMarks <noreply@watchlist-wonders.app>',
                to: email,
                subject: notifTitle,
                html: buildEmailHtml(title, scheduledFor, offsetMinutes, appUrl),
              })
              .then((result) => {
                if (result.error) throw new Error(result.error.message);
                logger.info('[reminders] Email sent via Resend', { uid });
              })
              .catch((err: unknown) => {
                logger.warn('[reminders] Email failed via Resend', { uid, error: String(err) });
                throw err;
              }),
          );
        }

        // Write in-app notification
        const nowIso = new Date().toISOString();
        tasks.push(
          db
            .collection(`users/${uid}/notifications`)
            .doc(`schedule-${docRef.id}-${scheduledFor.getTime()}`)
            .set({
              user_id: uid,
              bookmark_id: data.bookmark_id ?? null,
              schedule_id: docRef.id,
              title: notifTitle,
              body: notifBody,
              read_at: null,
              created_at: nowIso,
            })
            .then(() => {})
            .catch((err: unknown) => {
              logger.warn('[reminders] Failed to write notification doc', { uid, error: String(err) });
              throw err;
            }),
        );

        // Execute all notification tasks and check for at least one success
        let notificationSucceeded = false;
        try {
          const results = await Promise.allSettled(tasks);
          // Check if at least one notification succeeded
          notificationSucceeded = results.some((result) => result.status === 'fulfilled');
        } catch {
          notificationSucceeded = false;
        }

        // Only update state to 'fired' if at least one notification succeeded
        if (notificationSucceeded) {
          try {
            await docRef.update({ state: 'fired', updated_at: nowIso });
            sent++;
          } catch (err) {
            logger.warn('[reminders] Failed to mark schedule fired', { uid, error: String(err) });
            failed++;
          }
        } else {
          failed++;
        }
      }),
    );

    logger.info('[reminders] Run complete', { due: due.length, sent, failed });
  },
);

