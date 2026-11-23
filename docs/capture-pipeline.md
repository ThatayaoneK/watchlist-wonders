# Capture pipeline v2

Capture v2 is the canonical ingestion boundary for web paste, PWA share, mobile share integrations, and manual saves.

## Runtime flow

1. A client sends `captureBookmark` with a UUID `requestId`, source payload, surface, and client timestamp.
2. The callable validates the strict shared schema and transactionally writes an owner-readable capture receipt plus a server-only job. Reusing a request ID returns the stored response and cannot enqueue a second job.
3. `onCaptureJobCreated` performs extraction and resolution outside the share-sheet acknowledgement window.
4. The worker writes a Bookmark v2 document and changes the capture response to `saved`, `needs_selection`, `unresolved`, or `duplicate`.
5. A client can observe `users/{uid}/captures/{captureId}`. Candidate choices go through `confirmCandidate`; the callable verifies that the candidate was actually offered for that capture before writing protected resolution fields.

`processing` is the acknowledgement-only state. Terminal responses use the four product outcomes above. Web paste, PWA share, and manual save now use this path. The Expo mobile package exposes the same callable contract for the native share-intent integration.

## Trust boundary

- Browser and mobile clients submit raw URL/title/text only; they do not write provider matches or resolution fields.
- URL fetches reject embedded credentials, non-HTTP schemes, non-standard ports, local hostnames, and any hostname with a private, loopback, link-local, documentation, metadata, or otherwise non-public DNS answer.
- The outbound connection is pinned to the validated DNS answer. Every redirect is parsed and validated again, with a maximum of three redirects.
- Fetches use an explicit user agent, fixed connect/total timeouts, an allowlist of text/JSON content types, `Accept-Encoding: identity`, and a two MiB streamed response limit.
- Extraction never executes page JavaScript.
- Capture jobs and resolution events are server-only in Firestore rules; owners can read only their capture receipts.

## Matching policy

The canonical boundaries are deterministic and tested with labeled fixtures:

- score `>= 0.90`: automatic match
- score `0.65–0.899`: user selection
- score `< 0.65`: unresolved draft

Scores retain title, year, and media-type components for diagnosis. Provider fixtures live under `functions/src/fixtures/providers/v1` and cover valid, missing metadata, redirect, region restriction, deleted content, rate limiting, markup change, and malicious input cases.

## Transition and rollout

`captureShare` and the legacy enrichment engine remain exported temporarily so staging can compare outcomes before deletion. New capture traffic enters through `captureBookmark`; the legacy engine is reachable only behind the new extraction facade and the old compatibility callable.

Before removing the compatibility callable:

1. Deploy the shared package, rules, `captureBookmark`, `onCaptureJobCreated`, and `confirmCandidate` to staging.
2. Confirm p95 callable acknowledgement is below three seconds and inspect terminal outcome/error metrics by surface.
3. Replay the versioned provider fixtures and compare legacy/new outputs on a labeled production-safe sample.
4. Exercise PWA and native share-sheet cold starts, retries with the same request ID, ambiguous selection, and duplicate URLs.
5. Roll out clients, hold the compatibility path for one release, then remove it after traffic reaches zero.

Rollback is a client callable-name switch back to `captureShare`; do not delete v2 capture receipts or bookmarks. The worker is idempotent and existing jobs may finish safely during rollback.
