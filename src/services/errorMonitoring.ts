import { auth } from '@/lib/firebase';
import { reportClientError } from '@/services/functions';

type ErrorContext = Record<string, unknown>;

/**
 * Persistent error sink.
 *
 * - In dev: just logs to console.
 * - In prod: sends a bounded payload to an authenticated, rate-limited callable.
 * - Optionally forwards to Sentry's `window.Sentry.captureException` if
 *   `@sentry/react` was initialised at app boot (no hard dependency).
 *
 * Reports are coalesced by an in-session fingerprint to avoid spamming the
 * sink if the same error fires repeatedly (e.g. inside a render loop).
 */

interface ReportedFingerprint {
  count: number;
  firstAt: number;
}

const FINGERPRINT_TTL_MS = 60_000;
const fingerprints = new Map<string, ReportedFingerprint>();

function fingerprintOf(error: unknown, context: ErrorContext): string {
  if (error instanceof Error) {
    return `${error.name}:${error.message}`;
  }
  try {
    return `nonerror:${JSON.stringify(error)}:${JSON.stringify(context)}`.slice(0, 200);
  } catch {
    return `nonerror:${String(error)}`.slice(0, 200);
  }
}

function shouldReport(fp: string): boolean {
  const now = Date.now();
  const existing = fingerprints.get(fp);
  if (!existing || now - existing.firstAt > FINGERPRINT_TTL_MS) {
    fingerprints.set(fp, { count: 1, firstAt: now });
    return true;
  }
  existing.count += 1;
  return false;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === 'string' ? error.stack.slice(0, 4000) : null,
    };
  }
  try {
    return { value: JSON.parse(JSON.stringify(error)) };
  } catch {
    return { value: String(error) };
  }
}

function forwardToSentry(error: unknown, context: ErrorContext): void {
  const sentry = (globalThis as { Sentry?: { captureException?: (e: unknown, opts?: unknown) => void } }).Sentry;
  if (sentry?.captureException) {
    try {
      sentry.captureException(error, { extra: context });
    } catch {
      // Sentry forwarding must never throw.
    }
  }
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  if (import.meta.env.DEV) {
    console.error('[error-monitoring]', { error, context });
    return;
  }

  const fp = fingerprintOf(error, context);
  if (!shouldReport(fp)) return;

  forwardToSentry(error, context);

  try {
    if (!auth.currentUser) return;
    void reportClientError({
      url: typeof window !== 'undefined' ? window.location.pathname : null,
      fingerprint: fp,
      error: serializeError(error),
      context,
    }).catch(() => undefined);
  } catch {
    // Even the sink can fail (e.g. offline) — never escalate from reporter.
  }
}
