# Stabilization baseline — 2026-08-23

This baseline records the measurements available during the first WatchMarks implementation tranche. Values not measured against a deployed environment are called out explicitly rather than estimated.

## Environment

- Windows development host
- Node.js `v22.17.0`
- npm `11.7.0`
- Repository package manager: npm (the redundant Bun lockfile was removed)

## Quality gates

| Gate | Result |
| --- | --- |
| Frontend TypeScript | Pass |
| Functions TypeScript | Pass |
| ESLint | Pass with 26 warnings and 0 errors |
| Vitest | 21 files, 99 tests passed |
| Playwright public-shell smoke | 1 test passed, no credential-based skip |
| Production build | Pass |
| Bundle budget | Pass; largest raw JavaScript asset is 863.4 KiB against a 950 KiB limit |
| Full `npm run verify` | Pass |

The build generated 60 precache entries totaling 2900.58 KiB. Notable JavaScript assets from this run were:

| Asset group | Raw | Gzip |
| --- | ---: | ---: |
| Main index | 884.07 kB | 139.00 kB |
| Firebase | 681.18 kB | 157.67 kB |
| Charts | 517.75 kB | 149.04 kB |
| Dashboard | 172.32 kB | 48.63 kB |

## Installation result

A clean lockfile installation completed with `npm ci --prefer-offline --no-audit --no-fund --ignore-scripts`. A standard local `npm ci` did not complete within the available Windows verification session, so clean-install behavior with lifecycle scripts remains a CI/Linux verification item.

## Measurements requiring a deployed environment

The following plan baselines were not available from this local repository run and must be measured in staging or production with the relevant Firebase project access:

- Lighthouse scores on representative mobile and desktop hardware
- YouTube, IMDb, and generic-page capture latency and success rates
- Cloud Function latency, error rate, cold starts, and invocation volume
- Firestore document counts, index usage, read/write volume, and cost
- Authenticated and emulator-backed end-to-end user journeys

## Known risks and next gate

The original broad Firestore owner catch-all rule (`/users/{uid}/{document=**}`) was removed in the following security phase. Explicit collection contracts and an emulator-backed Firestore/Storage matrix now live in `firestore.rules`, `storage.rules`, and `tests/rules/security.rules.test.ts`.

The current Playwright smoke covers the public landing and authentication shell. It does not yet prove authenticated bookmark capture, editing, scheduling, sharing, or deletion.

Build output also reports a stale `caniuse-lite` database and an ambiguous Tailwind `duration-[800ms]` class; neither blocks the current gates, but both should be cleaned up in the next maintenance pass.
