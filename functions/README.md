# Firebase Cloud Functions

This folder contains Firebase Cloud Functions for WatchMarks.

## Function: `enrich`

- Trigger type: Callable HTTPS (`onCall`)
- Export: `functions/src/index.ts`
- Implementation: `functions/src/enrich.ts`
- Auth: required (`request.auth` must be present)
- Runtime options: Node.js 22, 256MiB, 30s timeout

The function enriches a submitted URL with metadata from supported providers (YouTube, TMDB-backed lookups, oEmbed/OpenGraph fallbacks).

## Setup

1. Install dependencies:

```bash
cd functions
npm install
```

2. Build TypeScript:

```bash
npm run build
```

3. Configure required secrets:

```bash
firebase functions:secrets:set YOUTUBE_API_KEY
firebase functions:secrets:set TMDB_API_KEY
```

4. Configure canonical app URL used in outgoing function emails and links:

```bash
firebase functions:params:set APP_URL="https://your-app.web.app"
```

5. Deploy:

```bash
firebase deploy --only functions
```

## Invocation Contract

This is not a REST `POST /enrich` endpoint. It is a Firebase callable function.

Frontend usage pattern:

```ts
import { httpsCallable } from 'firebase/functions';
import { fbFunctions } from '@/lib/firebase';

const enrich = httpsCallable(fbFunctions, 'enrich');
const result = await enrich({ url: 'https://example.com/item' });
```

## Local Development

Build/watch:

```bash
npm run build
npm run watch
```

View logs:

```bash
npm run logs
```

Run emulator:

```bash
firebase emulators:start --only functions
```

Important: the current frontend code does not auto-route callable requests to the local emulator. To do that, wire `connectFunctionsEmulator` in `src/lib/firebase.ts` for local development.

## Security Notes

- Input URL is validated before fetch attempts.
- Private/local hostnames are rejected.
- Outbound HTTP calls use explicit timeouts.
- Errors are normalized to Firebase `HttpsError` responses.
