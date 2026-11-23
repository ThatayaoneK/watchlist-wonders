# Firestore query and index map

| Consumer | Scope | Fields | Index |
| --- | --- | --- | --- |
| Library v1 compatibility | user bookmarks | `created_at desc` | automatic |
| Library v2 | user bookmarks | `createdAt desc` | automatic |
| Status v1 compatibility | user bookmarks | `status ==`, `created_at desc` | composite |
| Status v2 | user bookmarks | `library.state ==`, `createdAt desc` | composite |
| Vault counts | user bookmarks | `is_vaulted ==` or `visibility.isVaulted ==` | automatic |
| Sharing lookup | user bookmarks | `is_public ==` or `visibility.isPublic ==` | automatic |
| Capture deduplication | user bookmarks | one URL/external-ID equality field | automatic |
| Bookmark v2 migration | bookmark collection group | document path ordering | automatic |
| Enrichment/availability compatibility jobs | bookmark collection group | legacy pipeline and availability fields | retained until v1 contraction |

The obsolete public collection-group composites for `share_token/is_public` and
`user_id/is_public` were removed because public reads now use server-created
`publicBookmarks` projections. The invalid/redundant composite that ordered
`created_at` in both directions was also removed.

Indexes for temporarily retained intelligence, schedules, notifications and
resurfacing features remain because their server jobs still exist. They should
be deleted with those features, not before their code is removed.
