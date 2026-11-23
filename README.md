# WatchMarks

WatchMarks is a React + Firebase watchlist application for saving, organizing, and enriching streaming links.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: Firebase Auth, Firestore, Storage, Cloud Functions (Gen 2)
- Data fetching: TanStack Query
- Routing: React Router 7

## Requirements

- Node.js 22.x
- npm 10 or 11
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project

## Quick Start

1. Install all root and workspace dependencies from the lockfile:

```bash
npm ci
```

2. Create local environment file:

```bash
cp .env.example .env
```

3. Fill Firebase web app values in `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_APP_URL=
```

4. Start the app:

```bash
npm run dev
```

## Firebase Setup

1. Login and select project:

```bash
firebase login
firebase use --add
```

2. Enable Firebase services in console:

- Authentication (Email/Password)
- Firestore
- Storage

3. Set function secrets (used by `functions/src/enrich.ts`):

```bash
firebase functions:secrets:set YOUTUBE_API_KEY
firebase functions:secrets:set TMDB_API_KEY
```

4. Set canonical app URL for function emails/links:

```bash
firebase functions:params:set APP_URL="https://your-app.web.app"
```

5. Deploy infrastructure and app:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```

## Local emulator usage

When developing locally, you can route Firebase Auth, Firestore, and callable Functions to the emulator by setting these values in `.env`:

```env
VITE_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:8080
VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost:5001
```

Then run:

```bash
firebase emulators:start --only auth,firestore,functions
```

The frontend will automatically connect to the emulator hosts when running in development.

## Enrichment Flow

The canonical ingestion contract, asynchronous worker, SSRF boundary, fixture policy, and rollout procedure are documented in [Capture pipeline v2](docs/capture-pipeline.md).

- Frontend calls Firebase callable function `enrich` via `httpsCallable`.
- There is no `VITE_ENRICH_URL` runtime setting in the current app path.
- Callable requires authenticated users.

See function details in `functions/README.md`.

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build frontend
- `npm run typecheck` - Type-check the frontend
- `npm run typecheck:functions` - Type-check Cloud Functions
- `npm run verify` - Run the authoritative local web verification suite
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run Vitest once
- `npm run test:watch` - Run Vitest in watch mode

## Notes

- Root tests currently cover URL/provider detection and enrichment helpers.
- The frontend is now wired to route callable requests to the emulator when the appropriate `VITE_FIREBASE_*_EMULATOR_HOST` values are set in `.env` and you run the Firebase emulators.
