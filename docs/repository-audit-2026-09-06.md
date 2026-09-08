# WatchMarks repository audit — 6 September 2026

## Executive assessment

The repository has useful foundations: strict shared capture schemas, owner-scoped Firestore rules, explicit server-owned fields, admin claim checks, a DNS-pinned outbound fetch boundary, and tests for several pure decision and normalization paths. However, the current source has release-significant integration defects. Address account isolation, production CSP, capture recovery, and web/mobile schema consistency before treating the core capture–recall loop as reliable.

This was an audit only. No application fixes were made. Findings below are based on source tracing unless explicitly described as runtime-verified. P1 means high-priority correctness/privacy work; P2 means a material defect with narrower impact; P3 means lower-priority reliability/configuration work. No critical remote compromise was established.

Revision observed: `f2e013b610bbc951991cb7eba4b520a828745893`. Paths and line numbers refer to the inspected working tree. Existing audit documents were not treated as proof that an issue remains or has been fixed.

## Prioritized findings

### F01 — P1 — Account switches reuse private query results

**Evidence:** `src/lib/queryKeys.ts:5–10`; `src/features/library/useLibraryBookmarks.ts:9`; `src/App.tsx:46–50`; `src/contexts/AuthContext.tsx:72–73`.

Library pages, bookmark details, and Tonight candidates have no UID in their cache identity. The module-level QueryClient survives sign-out, has a five-minute freshness window and ten-minute garbage-collection window, and sign-out only calls Firebase Auth. There is no query-cache reset in the inspected auth transition path.

**Impact/reproduction:** Account A loads its library, signs out, and B signs in in the same tab within the freshness window. B can receive A's cached library without a new authorized Firestore read. Deterministic capture IDs make detail-key collisions realistic too. Firestore ownership rules do not protect data already in React Query memory.

**Remediation:** Include UID in every private query key; disable queries until auth is settled; cancel in-flight private queries and remove private data on any UID change. Validate A → sign-out → B with separate seeded datasets, including an outstanding request during the transition.

### F02 — P1 — Production CSP blocks the app's callable Functions

**Evidence:** `firebase.json:69`; `src/lib/firebase.ts:88`; `src/services/captureShare.ts:21`; installed SDK `node_modules/@firebase/functions/dist/esm/index.esm.js:484`.

The deployed `connect-src` list excludes `cloudfunctions.net`. `getFunctions(app)` uses its default endpoint, and the installed SDK constructs `https://<region>-<project>.cloudfunctions.net/<name>`. Hosting rewrites only serve the SPA; there is no same-origin callable proxy configured.

**Impact:** With this Hosting configuration applied, capture, enrichment, candidate confirmation, admin calls, and other callable-backed operations are rejected by the browser before reaching the function. Vite development/preview does not exercise these Hosting headers, so its smoke test cannot catch this.

**Remediation:** Allow the exact deployed callable origin(s), or deliberately configure a tested same-origin routing strategy. Test a real callable under the production header policy. This is a confirmed configuration mismatch, not a claim that live production headers were inspected. See [MDN connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) and [Firebase callable functions](https://firebase.google.com/docs/functions/callable).

### F03 — P1 — Offline captures are replayed under whichever account is current

**Evidence:** `src/features/capture/offlineQueue.ts:5,18–39`; `src/components/QuickAddBar.tsx:333–347`; `src/services/captureShare.ts:21–27`.

The persistent capture queue is one origin-wide key containing requests without an owner binding. It flushes on mounting QuickAddBar and reconnecting, using current Firebase credentials. Signing out does not clear or segregate it.

**Impact/reproduction:** A queues a private URL offline; after switching to B, mounting the capture UI while online saves A's URL/text to B's account. Independently, the flush's final write replaces the entire queue with a slice of its initial snapshot, so a newly appended request during the await can be discarded.

**Remediation:** Store entries under the initiating UID and enforce that identity before every replay. Serialize flushes and remove acknowledged request IDs from the latest queue rather than overwriting it from a stale snapshot. Test account changes and concurrent enqueue/flush explicitly.

### F04 — P1 — Capture jobs can remain permanently processing after termination

**Evidence:** `functions/src/capture/captureBookmark.ts:199–225`.

The worker transaction changes `queued` to `processing`, and every retry refuses any state other than `queued`. Only the catch handler resets the state. A hard timeout, process termination, or failure while resetting the state bypasses that recovery. Although the trigger has `retry: true`, the redelivered event then returns successfully without doing work.

**Impact:** The capture remains processing indefinitely; retrying the same request returns the stored processing response. The UI's 45-second wait does not repair the job.

**Remediation:** Use an expiring claim/lease with an attempt identifier and reclaim stale jobs; make completion idempotent and add a bounded retry/dead-letter strategy. Validate termination immediately after the claim and immediately after bookmark creation, not just caught exceptions.

### F05 — P1 — Mobile cannot list newly created v2 bookmarks

**Evidence:** `apps/mobile/lib/bookmarks.ts:41–50`; `src/services/bookmarks.ts:292–344`; `functions/src/capture/captureBookmark.ts:72–112`.

Mobile queries `orderBy("created_at")` and casts raw documents to the legacy shape. Both current web creation and v2 capture write `createdAt`, `media.title`, and `library.state`. Those documents are excluded from the mobile query; direct detail reads also return the wrong shape.

**Impact:** Titles successfully saved on the web are missing from mobile. Opening a v2 detail yields undefined legacy fields. Successful TypeScript compilation does not detect this because the raw-data cast bypasses validation.

**Remediation:** Share a runtime-normalized bookmark view model and schema-aware, paginated reads across clients. Test legacy-only, v2-only and mixed accounts on mobile.

### F06 — P1 — Deleting a published bookmark leaves its public copy accessible

**Evidence:** `src/services/bookmarks.ts:453–455`; `functions/src/sharing.ts:95,104–108,118`; `firestore.rules:502–504`; exports in `functions/src/index.ts`.

Deletion removes only the private bookmark. Publishing creates an independent `publicBookmarks/<token>` projection. No bookmark-deletion cleanup trigger was found, and anonymous reads of projections remain allowed. Revocation requires the private bookmark to exist before it can delete the projection.

**Impact:** Previously shared title/link/display-name data remains publicly readable after deletion, and the normal revoke endpoint can no longer remove it. Attachments, schedules and vector entries also lack a coordinated bookmark-deletion lifecycle. Social UI is currently disabled, which reduces new UI exposure but does not revoke existing projections or disable the callable.

**Remediation:** Implement trusted, idempotent deletion cleanup, preserve an ownership lookup for orphaned projections, and clean existing orphans. Test publish → delete → anonymous token read and concurrent publish/delete.

### F07 — P2 — Older saved titles can disappear from all library sections

**Evidence:** `src/features/library/model.ts:30–54`; `src/features/library/pages/LibraryPage.tsx:44–51`.

Recently Saved is capped at 20. Other sections include only watching items, unresolved items, or members of a qualifying genre/mood group. There is no all-items section. A resolved backlog item older than the newest 20 with no matching tags/moods is excluded from all rails unless it happens to be the single hero pick. Loading another page does not remove this exclusion.

**Impact:** Users can load their full library and still be unable to browse many saved items. This is display loss, not deletion; the separate search screen can still expose loaded records.

**Remediation:** Keep the editorial sections but provide a complete paginated all-saved view. Validate 60 resolved, untagged backlog records and confirm every item is reachable through library browsing.

### F08 — P2 — Deduplication conflates movie and TV identifiers

**Evidence:** `functions/src/capture/deduplicate.ts:17–33`; caller `functions/src/capture/captureBookmark.ts:126`; `src/services/bookmarks.ts:198–208`.

Capture ID generation correctly incorporates media type, but the preceding duplicate query compares only TMDB numeric ID. Movie and TV IDs occupy separate namespaces. The browser's duplicate lookup has the same ID-only behavior, and v2 lookup does not restrict the resolution provider either.

**Impact:** A movie and TV show with the same numeric ID can be treated as one item; the second capture returns the existing item instead of saving the requested title.

**Remediation:** Use provider + media type + external ID as the identity tuple in lookups and relevant indexes. Test a movie and TV candidate sharing the same numeric ID, including legacy documents.

### F09 — P2 — Fresh v2 captures skip the intelligence pipeline entirely

**Evidence:** `functions/src/capture/captureBookmark.ts:108–109`; `functions/src/index.ts:96–98,132–145`; `functions/src/pipeline/ingest.ts:49–140`.

Capture writes `intelligence.pipelineVersion: 2` while embeddings, auto-tags and cluster ID remain empty. The bookmark-created trigger immediately skips version 2. The retroactive job queries legacy `pipeline_version`/`enriched`, not v2 intelligence fields, so it does not backfill these records. Its fallback only runs on query errors, not when a successful query excludes documents with absent fields.

**Impact:** Normal v2 captures can stay unindexed and unclustered despite being marked as pipeline-complete. Optional semantic search consequently falls back rather than having the expected data.

**Remediation:** Track capture/resolution version separately from intelligence completion; enqueue downstream stages explicitly and track their success independently. Add v2 backfill/retry selection. Verify one v2 capture through extraction, persistence, vector indexing and clustering with configured infrastructure.

### F10 — P2 — Scheduled intelligence jobs enumerate a user registry the app does not create

**Evidence:** `functions/src/intelligence/importance.ts:107–109`; `functions/src/intelligence/cluster.ts:161–163`; `functions/src/intelligence/resurface.ts:118–120`; `src/contexts/AuthContext.tsx:68–69`; `src/services/social.ts:149,168–173`.

Jobs query the top-level `users` collection. Signup creates a Firebase Auth account, while app data is written into subcollections such as `users/<uid>/profile` and `bookmarks`; no corresponding parent-document creation path was found. Child documents do not materialize a parent document for collection queries. Existing users without parent documents are therefore skipped. Even with a populated registry, the same first 200 users are selected every run without a continuation cursor. Resurfacing additionally reads only legacy importance fields (`resurface.ts:50–61`).

**Impact:** Importance, clustering and resurfacing can silently do no work for ordinary new accounts, and later registry users are starved once the cap is exceeded. Externally provisioned parent documents may mitigate the first issue; deployment data was not inspected.

**Remediation:** Establish and backfill an authoritative user registry or enumerate Auth users with pagination, persist progress across bounded scheduled runs, and normalize both bookmark schemas. Validate an account created through the actual signup flow and more than 200 users.

### F11 — P2 — Reminder failures are swallowed before the success decision

**Evidence:** `functions/src/reminders.ts:346–348,365–367,386–404`.

Every delivery task catches failures and resolves. `Promise.allSettled` then sees fulfilled results, so `notificationSucceeded` becomes true even when push, email, and the in-app write all fail. The schedule is marked `fired`, preventing retry.

**Impact:** Reminders can be permanently lost while the worker reports success. Scheduling UI is currently disabled, but the scheduled backend export remains active. Additional correctness gaps: v2 titles are read as legacy `title` (`:318`), and the two-hour query horizon (`:27,209`) does not cover the larger offsets allowed by rules.

**Remediation:** Preserve channel failures or return explicit delivery outcomes; only acknowledge a genuinely successful required outcome. Use idempotent notification identities and schema-aware titles. Test all-channel failure and repeat delivery.

### F12 — P2 — Functions deployment is not self-contained

**Evidence:** `firebase.json:9–19`; `functions/package.json:4,14`; `packages/shared/package.json:6–9`; `.github/workflows/ci.yml:37–39`.

Functions deploy from `functions`, but depend on `file:../packages/shared`, outside that source root. There is no Functions predeploy build/staging hook. CI type-checks with `--noEmit`; a clean checkout does not have the ignored `functions/lib/index.js` main entry. Root workspace installation can conceal these problems locally.

**Impact:** The documented clean-checkout deployment can lack compiled code, and the isolated cloud dependency install may not find the sibling shared package. This is a confirmed non-self-contained configuration; a live deployment failure was not exercised.

**Remediation:** Build and stage a complete deployable Functions artifact, including shared runtime code, before deployment; use a packaged/published dependency or verified supported workspace packaging. Add a clean artifact installation/load check, without deploying as part of an audit.

### F13 — P3 — App icon paths are missing

**Evidence:** `vite.config.ts:29,35` points to `/favicon.png`, which is absent from `public`; `apps/mobile/app.config.ts:10` references absent `apps/mobile/assets/icon.png`.

**Impact:** The generated PWA manifest advertises missing install icons; mobile packaging also references a nonexistent asset. The separate public manifest is not the manifest configuration generated by the Vite PWA plugin.

**Remediation:** Add real appropriately sized assets, consolidate manifest ownership, and validate generated manifest URLs and an Expo release bundle.

## Additional bounded risks and dormant defects

- **Legacy queue writes:** `src/services/queue.ts:122–143` and `src/services/bookmarks.ts:568–574` still update legacy fields and will be denied for v2 documents by `firestore.rules:258–271`. Their principal consumer is the old Dashboard mutation hook; `/dashboard` now redirects to `/library`, so this is dormant-path debt rather than a demonstrated current Library action failure.
- **Abuse/cost controls:** authenticated capture can enqueue arbitrary numbers of jobs with fresh request IDs; no per-user capture quota or App Check enforcement was found there. This is exposure to authenticated resource abuse, not an established exploit or measured bill. The client-error endpoint does have a transactional rate limiter and redaction.
- **SSRF boundary:** central URL validation, address pinning, bounded redirects and body limits are positive controls. `fetchUrl.ts` does not attach an explicit response-stream error listener, and its timers begin after DNS resolution and reset each redirect. Abrupt/oversized response behavior and an end-to-end DNS deadline deserve fault-injection tests; no SSRF bypass is claimed.
- **Resolution concurrency:** pipeline persistence checks whether the user confirmed a match in a separate read before writing. A user confirmation between that read and write can be overwritten. A transactional check or precondition would preserve the user's choice.
- **Social writes:** `src/services/social.ts:92–108` still writes follower feeds directly, while rules explicitly deny client feed writes. Social is disabled; reconcile the service with a trusted fan-out function before enabling it.
- **Search completeness:** current Search deliberately searches loaded library pages and offers “Search more of my library.” This is disclosed partial search, not whole-library retrieval. Confirm that repeated manual pagination meets the intended recall product requirement. Initial load errors also fall through to no-match UI without a dedicated error treatment.
- **CI configuration:** web build validation needs Firebase environment values, but the workflow does not explicitly supply them. A clean runner may fail validation or build a shell that throws at runtime; live repository CI variables were not inspected. The deployment/build environment contract should be explicit and tested with non-secret fixture configuration where appropriate.
- **Documentation drift:** Functions README says emulator routing is absent, while `src/lib/firebase.ts` implements it. Root README setup does not describe the complete shared-package deployment artifact or reminder secret configuration.

## Architecture and coverage

| Area | Reviewed scope and assessment |
|---|---|
| Web | React 18/Vite, lazy routes, auth provider, QueryClient lifetime, active Library/Search/Tonight pages, capture/share UI, bookmark detail mutations, legacy Dashboard services, feature flags. Core routes are clearer than the remaining older feature implementations. |
| Mobile | Expo Router auth gate, Firebase bootstrap, library/detail read contract, shared callables and app configuration. No device/simulator execution. |
| Shared | Dual ESM/CJS package, Zod bookmark/capture contracts, schema normalization and migration boundaries. Raw casts in consumers weaken the benefit of shared validation. |
| Backend | Capture request/worker lifecycle, deduplication, candidate confirmation, extraction dispatch and safe fetch, ingestion stages, persistence, sharing projections, reminders, availability, retrieval/vector boundary, scheduled intelligence and admin authorization. |
| Data and rules | Private/public projections, owner checks, server-owned bookmark fields, schedules, notifications, attachments, follows, watch plans, admin collections, Storage restrictions and migration backups. Strong deny-by-default baseline; deletion and identity lifecycle gaps remain outside those rules. |
| Configuration | Firebase source/Hosting/CSP, Vite/PWA/cache configuration, TS/lint/test settings, root and workspace manifests/lockfiles, CI, environment handling, release icons and setup docs. Environment values were not printed. `.env` and Functions `.env` are not tracked in the inspected index. |
| Tests | Vitest includes web and Functions unit tests; rules tests are separately configured; E2E is one public landing/auth-form smoke test. No authenticated capture → library → detail → account-switch browser scenario, mobile test suite, or complete worker recovery integration suite was found. |

This is a broad review of major areas and high-risk data paths, not a proof that every component or line is defect-free. Provider fixture tests establish local behavior only; they do not prove live provider compatibility. No production data, IAM configuration, deployed headers, real emails/pushes, Vertex index, credentials, or mobile release was exercised.

## Verification record

| Check | Observed result |
|---|---|
| Shared package build + web TypeScript | Passed in the root verification sequence, which advanced to lint. |
| Functions TypeScript | `tsc -p functions/tsconfig.json --noEmit`: completed with no diagnostics. |
| Mobile TypeScript | `tsc -p apps/mobile/tsconfig.json --noEmit`: completed with no diagnostics. This does not validate Firestore data at runtime. |
| Unit tests | **30 files, 138 tests passed**, Vitest 2.1.9; completed run took 546.50 seconds. Admin rendering tests emitted server-rendering/useLayoutEffect warnings. |
| ESLint | **0 errors, 26 warnings**. The umbrella verify command was stopped after lint to avoid repeating the completed unit suite. |
| Environment validator | Passed: 9 keys checked, 4 optional. Values were not included in the report or output. |
| Production build | Started with Vite 5.4.19, reached transformation, then was stopped after prolonged non-completion. Printed stale Browserslist data and ambiguous `duration-[800ms]` utility warnings. **No successful production build or bundle-budget result established.** This is not evidence of a source compilation error. |
| Dependency advisories | `npm audit --json` failed to obtain a registry advisory response. No vulnerability count or clean dependency bill asserted. |
| Firestore/Storage emulator rules | Test source inspected; emulator suite not executed to completion in this audit. |
| Browser E2E / mobile runtime | Not executed; no verified fresh production build or device session. Existing E2E coverage is the public landing/auth-form smoke only. |

Sandbox execution initially failed to load Vitest config because esbuild could not read a parent directory. The subsequent permitted retry produced the passing test result above; the startup failure was an environment limitation, not a failed assertion. Build/lint/test logs from this audit are local ignored `audit-*.log` files; `audit-dependencies.json` records the unsuccessful advisory request. No package installations, deployments, application edits or live external notifications were performed. Read/build commands that remained pending were stopped before delivery.

## Recommended order of work

1. Fix and regression-test UID cache/queue isolation and production callable access (F01–F03).
2. Make capture jobs recoverable, mobile schema-aware, and public deletion complete (F04–F06).
3. Restore complete library browsing and correct compound media identity (F07–F08).
4. Reconcile capture/intelligence completion, user enumeration and deployment packaging (F09–F10, F12).
5. Fix reminder outcomes and missing assets, then reconcile dormant feature paths before enabling them.

Each fix should have a targeted integration test for the stated reproduction. Do not weaken ownership rules to make legacy clients succeed; migrate their reads and writes to the canonical contract.
