# Security And Functionality Audit Report

## Executive Summary

No backend secrets, private keys, or service-account material were found exposed in the repo or shipped build.

The Firebase web config is present in the client bundle, but that is expected for a Vite/Firebase SPA and is not a secret by itself. The TMDB and YouTube API keys are kept server-side as Firebase Functions secrets in [functions/src/tmdb.ts](functions/src/tmdb.ts) and [functions/src/enrich.ts](functions/src/enrich.ts).

The most likely cause of the dashboard/login landing-page error was a React hook-order bug in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx). That issue was remediated during this audit by ensuring hooks run before the loading and error returns.

Outstanding issues remain around public data exposure design, public-profile permissions, browser hardening, and unsafe external-link handling.

## Remediated During Audit

### FUNC-001
- Severity: High
- Location: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx):540, [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx):636
- Evidence: `useEffect`/`useMemo` hooks now execute before the `isLoading` and `error` return branches. Before the fix, ESLint reported conditional hook usage in this file.
- Impact: React can throw runtime errors when a component sometimes returns before later hooks run, which matches a dashboard failure after login or during loading/error transitions.
- Fix: Completed. Loading/error guards were moved below the hook declarations so hook order is stable across renders.
- False positive notes: None. This was directly confirmed by lint before the change and by a successful production rebuild after the change.

## High Severity Findings

### SEC-001
- Severity: High
- Location: [firestore.rules](firestore.rules):10, [src/services/sharing.ts](src/services/sharing.ts):25, [src/services/sharing.ts](src/services/sharing.ts):45
- Evidence: Public access is granted to the full bookmark document with `allow read: if resource.data.is_public == true;`, and the share service returns `...d.data()` for public bookmarks after simply flipping `is_public` on the original private bookmark document.
- Impact: Making a bookmark public also exposes every field on that document, including `notes`, `metadata`, review fields, and source URLs. A user may believe they are sharing just title/poster data while actually exposing more personal data.
- Fix: Move public sharing to a dedicated, sanitized public document shape such as `users/{uid}/publicBookmarks/{id}` or explicitly map only share-safe fields when returning public data.
- Mitigation: At minimum, strip `notes`, personal review fields, and nonessential metadata from public responses until the data model is separated.
- False positive notes: This is only exploitable for bookmarks the owner explicitly marks public, but once public, the full document becomes readable.

## Medium Severity Findings

### FUNC-002
- Severity: Medium
- Location: [src/pages/PublicProfile.tsx](src/pages/PublicProfile.tsx):51, [src/services/social.ts](src/services/social.ts):67, [firestore.rules](firestore.rules):5
- Evidence: The public profile page queries follower and following counts for arbitrary users, but Firestore rules allow reads on `users/{uid}/{document=**}` only when `request.auth.uid == uid`, with no public exception for `followers` or `following`.
- Impact: Public profile counts can fail with permission errors or silently degrade, creating inconsistent public-profile behavior.
- Fix: Either publish follower/following counters into [users/{uid}/profile/public](firestore.rules) or add explicit read rules for the exact data you intend to expose publicly.
- Mitigation: If counts should remain private, remove those public queries from the profile UI and render only data that is actually public.
- False positive notes: If counts are being served elsewhere outside this repo, verify that path; no such path is visible here.

### SEC-002
- Severity: Medium
- Location: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx):620, [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx):1244, [src/pages/ShareView.tsx](src/pages/ShareView.tsx):184, [src/pages/TonightPick.tsx](src/pages/TonightPick.tsx):103, [src/components/bookmarks/PosterCard.tsx](src/components/bookmarks/PosterCard.tsx):226
- Evidence: Several external links use `window.open(url, "_blank")` without `noopener,noreferrer`. Other parts of the app already use the safer form, for example [src/pages/BookmarkDetail.tsx](src/pages/BookmarkDetail.tsx):325 and [src/components/bookmarks/DecisionMode.tsx](src/components/bookmarks/DecisionMode.tsx):76.
- Impact: A malicious destination page can retain access to `window.opener`, enabling reverse-tabnabbing or opener-based navigation attacks.
- Fix: Standardize all external opens through a helper that validates `http/https` URLs and always applies `"noopener,noreferrer"`.
- Mitigation: Reuse the existing `isSafeUrl` approach from [src/pages/BookmarkDetail.tsx](src/pages/BookmarkDetail.tsx):43.
- False positive notes: Risk depends on users opening untrusted third-party URLs, but this app is explicitly designed around outbound links from external platforms.

## Low Severity Findings

### SEC-003
- Severity: Low
- Location: [index.html](index.html):1, [firebase.json](firebase.json):22
- Evidence: The static entrypoint has no visible CSP meta tag, and Firebase Hosting headers only define cache-control behavior. No `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or similar browser hardening headers are visible in the repo.
- Impact: Reduced defense-in-depth against XSS, clickjacking, and data-leakage classes if another issue appears later.
- Fix: Add Firebase Hosting headers for a CSP, `Referrer-Policy`, and clickjacking protection. Prefer header delivery over meta tags.
- Mitigation: If these headers are configured outside the repo, verify the live deployment directly and document that configuration.
- False positive notes: This finding is limited to what is visible in this codebase; edge/CDN headers may exist but are not represented here.

## Informational Checks

### INFO-001
- Result: No exposed backend API secrets found
- Evidence: [functions/src/tmdb.ts](functions/src/tmdb.ts):5 and [functions/src/enrich.ts](functions/src/enrich.ts):5 use `defineSecret(...)`; `.env` is gitignored in [.gitignore](.gitignore):24; only [.env.example](.env.example) is tracked; no source maps were found in `dist`.
- Note: The Firebase web config in [src/lib/firebase.ts](src/lib/firebase.ts):56 and the built bundle is public client configuration, not a server secret.

