# Firebase security contract

Firestore and Storage rules are the authorization boundary for browser clients. UI checks are convenience only; Admin SDK writes from trusted Cloud Functions bypass these rules and must validate authentication and payloads themselves.

## Ownership model

| Path | Browser access |
| --- | --- |
| `users/{uid}/bookmarks/*` | Owner read/create/delete; owner updates only user-controlled fields |
| `users/{uid}/schedules/*` | Owner CRUD with bounded schedule fields |
| `users/{uid}/notifications/*` | Owner read/delete; only `read_at` is client-editable |
| `users/{uid}/profile/public` | Public read; owner writes a bounded public profile |
| `users/{uid}/profile/private` | Owner only, with an explicit preference/token schema |
| `users/{uid}/following/*`, `followers/*` | Owner reads; reciprocal writes must occur atomically and cannot spoof follower IDs |
| `users/{uid}/attachments/*` | Owner metadata create/read/delete with MIME and size limits |
| `users/{uid}/watchPlans/*` | Owner CRUD with explicit nested bookmark entries |
| `captures`, `activity`, `resurfaceEvents`, `clusters`, `feed`, notifications | Client read where needed; trusted server writes only |
| `publicBookmarks/{shareToken}` | Public read of server-created projections; all client writes denied |
| `errorReports/*` | Admin read and callable-only writes |
| Unlisted paths | Denied |

Bookmark identity, extraction, enrichment, provider availability, embeddings, clustering, importance, pipeline fields, sharing tokens, and public projections are server-owned. Browser updates are limited to title, library/queue state, personal notes and tags, rating/review, progress, vault state, and a small allowlist of user-owned metadata.

## Public sharing

`setBookmarkSharing` creates or revokes a random-token projection. The projection builder copies only:

- schema version
- owner display name
- title and normalized media type
- safe HTTP(S) poster and canonical URLs
- release year and runtime
- creation timestamp

Notes, tags, raw capture content, device identifiers, internal metadata, ownership IDs, and pipeline fields are never copied. Public-profile lists are returned by `listPublicBookmarks`, which builds the same projection server-side rather than querying private bookmark documents from the browser.

## Client error reporting

Direct browser writes to `errorReports` are denied. `reportClientError` requires authentication, validates request size and shape, truncates nested data, redacts common credentials, emails, and query parameters, and limits each user to ten accepted reports per minute.

App Check logging is currently in monitoring mode for the new callables (`enforceAppCheck: false` plus warnings for missing tokens). Before switching enforcement on:

1. configure a supported App Check provider in the web client and production Firebase project;
2. verify legitimate-token metrics in the Functions/App Check console;
3. set `enforceAppCheck: true` on protected callable endpoints;
4. deploy and monitor rejected-request rates.

## Local and CI verification

Run `npm run test:rules`. The command starts isolated Firestore and Storage emulators against the `demo-watchmarks` project and executes `tests/rules/security.rules.test.ts`. Java 21 is required; CI installs it explicitly.

Any data-contract change must update the rules and add both an allowed and denied emulator assertion before deployment.
