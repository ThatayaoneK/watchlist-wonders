# Bookmark data model

## Bookmark v2

`@watchmarks/shared` is the schema source of truth for web and Functions. Its
`BookmarkV2Schema` validates the canonical document stored at
`users/{uid}/bookmarks/{bookmarkId}`.

The document has these top-level sections:

- `source`: immutable original/canonical URLs, capture source and capture ID.
- `media`: normalized display data.
- `resolution`: matching status, provider, external ID and confidence.
- `library`: user-owned state, notes, tags, rating and progress.
- `visibility`: vault/public state and server-owned share token.
- `availability`: one normalized provider snapshot.
- `intelligence`: server-owned retrieval and pipeline state.

Firestore timestamps are used for all v2 timestamp fields. Raw extractor and
share payloads belong in `users/{uid}/captures`, referenced by `source.captureId`.
New writes must not add legacy aliases such as `source_url`, `metadata.tmdb_id`,
`canonical_entity`, `queue_status`, `enriched_at`, or top-level `availability`.

## Compatibility window

The web service reads both v1 and v2 and maps both into the existing UI view
model. New client and capture writes are v2. Legacy writes remain accepted only
for existing v1 documents until migration and the two-release compatibility
window are complete.

## Migration

`migrateBookmarksV2` is an IAM-private HTTP job. It is dry-run-first, processes
1–250 documents, orders by document path, and returns a cursor for safe restart.
Every applied conversion:

1. validates the complete v2 result;
2. verifies the source hash inside a transaction;
3. creates a rollback copy in `bookmarkMigrationBackups`;
4. replaces the source document without deprecated aliases;
5. records per-document status beneath `adminJobs/{jobId}/documents`.

Failures are recorded in `migrationDeadLetters` using path hashes and stable
error codes; raw bookmark data is not copied into logs or dead-letter records.
Export Firestore before enabling `dryRun: false` in staging or production.

Example request body:

```json
{
  "jobId": "bookmark-v2-staging-001",
  "dryRun": true,
  "batchSize": 200,
  "cursor": null
}
```

Repeat with the returned `nextCursor` until `complete` is true. Apply mode must
reuse a stable job ID and must only begin after the dry-run exception list has
been reviewed.
