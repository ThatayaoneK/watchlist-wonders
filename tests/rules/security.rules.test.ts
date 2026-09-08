import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-watchmarks";
const ALICE = "alice";
const BOB = "bob";

let testEnv: RulesTestEnvironment;

function bookmark(overrides: Record<string, unknown> = {}) {
  const now = "2026-08-23T12:00:00.000Z";
  return {
    title: "Arrival",
    type: "movie",
    provider: "generic",
    source_url: null,
    canonical_url: null,
    platform_label: null,
    status: "backlog",
    runtime_minutes: null,
    release_year: null,
    poster_url: null,
    backdrop_url: null,
    tags: [],
    mood_tags: [],
    notes: null,
    metadata: {},
    user_id: ALICE,
    is_public: false,
    is_vaulted: false,
    last_shown_at: null,
    shown_count: 0,
    priority: 100,
    queue_status: "queued",
    progress_percent: 0,
    availability: null,
    enriched: false,
    enriched_at: null,
    enrich_fail_reason: null,
    tmdb: null,
    canonical_entity: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function bookmarkV2(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-08-23T12:00:00.000Z");
  return {
    schemaVersion: 2,
    ownerId: ALICE,
    source: { originalUrl: null, canonicalUrl: null, platform: "generic", rawTitle: "Arrival", capturedAt: now, captureId: null },
    media: { type: "movie", title: "Arrival", posterUrl: null, backdropUrl: null, releaseYear: 2016, runtimeMinutes: 116 },
    resolution: { status: "pending", provider: null, externalId: null, confidence: null, version: 1 },
    library: {
      state: "saved", scheduledAt: null, progressPercent: 0, priority: 100, queueState: "queued",
      tags: [], moodTags: [], notes: null, rating: null, review: null, watchedAt: null,
      lastShownAt: null, shownCount: 0, episodesWatched: null, totalEpisodes: null,
      trailerUrl: null, watchedWith: null,
    },
    visibility: { isPublic: false, isVaulted: false, shareToken: null },
    availability: null,
    intelligence: {
      autoTags: [], embeddingRef: null, fingerprint: null, clusterId: null, importanceScore: null,
      pendingClusterAssignment: false, pipelineVersion: 0, lastViewedAt: null, viewCount: 0,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(path).set(data);
  });
}

beforeAll(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile(resolve("firestore.rules"), "utf8"),
    readFile(resolve("storage.rules"), "utf8"),
  ]);
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
});

afterEach(async () => {
  await Promise.all([testEnv.clearFirestore(), testEnv.clearStorage()]);
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("private bookmark ownership and schema", () => {
  it("allows canonical v2 creates and limits updates to user-owned nested fields", async () => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/bookmarks/v2`);
    await assertSucceeds(ref.set(bookmarkV2()));
    await assertSucceeds(ref.update({ "library.notes": "Personal note", updatedAt: new Date() }));
    await assertFails(ref.update({ ownerId: BOB, updatedAt: new Date() }));
    await assertFails(ref.update({ "resolution.status": "matched", updatedAt: new Date() }));
    await assertFails(ref.update({ "availability.status": "ok", updatedAt: new Date() }));
  });

  it("rejects invalid or server-populated v2 creates", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(db.doc(`users/${ALICE}/bookmarks/v2-owner`).set(bookmarkV2({ ownerId: BOB })));
    await assertFails(db.doc(`users/${ALICE}/bookmarks/v2-resolution`).set(bookmarkV2({
      resolution: { status: "matched", provider: "tmdb", externalId: "329865", confidence: 1, version: 1 },
    })));
    await assertFails(db.doc(`users/${ALICE}/bookmarks/v2-tags`).set(bookmarkV2({
      library: { ...bookmarkV2().library, tags: Array(31).fill("tag") },
    })));
  });

  it("allows a valid owner create and blocks anonymous or cross-user access", async () => {
    const aliceDoc = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/bookmarks/a`);
    await assertSucceeds(aliceDoc.set(bookmark()));

    await assertFails(testEnv.unauthenticatedContext().firestore().doc(aliceDoc.path).get());
    await assertFails(testEnv.authenticatedContext(BOB).firestore().doc(aliceDoc.path).get());
    await assertFails(
      testEnv.authenticatedContext(BOB).firestore().doc(aliceDoc.path).update({ title: "Stolen" }),
    );
  });

  it("rejects owner changes and server-owned field changes", async () => {
    const path = `users/${ALICE}/bookmarks/a`;
    await seed(path, bookmark({ canonical_entity: { id: "server-value" } }));
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(path);

    await assertFails(ref.update({ user_id: BOB }));
    await assertFails(ref.update({ canonical_entity: { id: "spoofed" } }));
    await assertFails(ref.update({ availability: { US: ["fake"] } }));
    await assertSucceeds(ref.update({ notes: "Personal note", updated_at: "2026-08-23T12:01:00.000Z" }));
  });

  it.each([
    ["type", "podcast"],
    ["provider", "attacker"],
    ["status", "published"],
    ["queue_status", "invalid"],
  ])("rejects invalid %s values", async (field, value) => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/bookmarks/a`);
    await assertFails(ref.set(bookmark({ [field]: value })));
  });

  it("rejects excessive notes and tags", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(db.doc(`users/${ALICE}/bookmarks/notes`).set(bookmark({ notes: "x".repeat(10001) })));
    await assertFails(db.doc(`users/${ALICE}/bookmarks/tags`).set(bookmark({ tags: Array(51).fill("tag") })));
  });

  it("rejects public vaulted bookmarks", async () => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/bookmarks/a`);
    await assertFails(ref.set(bookmark({ is_public: true, is_vaulted: true })));
  });

  it("rejects public creates and server-owned metadata", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(db.doc(`users/${ALICE}/bookmarks/public`).set(bookmark({ is_public: true })));
    await assertFails(db.doc(`users/${ALICE}/bookmarks/metadata`).set(bookmark({
      metadata: { resolution_confidence: 1 },
    })));
  });

  it("never exposes a private bookmark document through a public read", async () => {
    const path = `users/${ALICE}/bookmarks/public-legacy`;
    await seed(path, bookmark({ is_public: true, share_token: "legacy", notes: "private" }));
    await assertFails(testEnv.unauthenticatedContext().firestore().doc(path).get());
  });

  it("denies unlisted owner subcollections", async () => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/unexpected/a`);
    await assertFails(ref.set({ value: true }));
    await assertFails(ref.get());
  });
});

describe("explicit user subcollection contracts", () => {
  it("separates public and private profile access", async () => {
    const alice = testEnv.authenticatedContext(ALICE).firestore();
    const bob = testEnv.authenticatedContext(BOB).firestore();
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const publicPath = `users/${ALICE}/profile/public`;
    const privatePath = `users/${ALICE}/profile/private`;

    await assertSucceeds(alice.doc(publicPath).set({ display_name: "Alice", bio: null, avatar_url: null }));
    await assertSucceeds(anonymous.doc(publicPath).get());
    await assertFails(bob.doc(publicPath).set({ display_name: "Mallory" }));
    await assertSucceeds(alice.doc(privatePath).set({ push_enabled: true }));
    await assertFails(anonymous.doc(privatePath).get());
    await assertFails(bob.doc(privatePath).get());
  });

  it("keeps watch plans owner-scoped", async () => {
    const path = `users/${ALICE}/watchPlans/plan-a`;
    const plan = {
      user_id: ALICE,
      name: "Weekend",
      description: null,
      preferred_days: [6],
      time_windows: [{ start: "18:00", end: "22:00" }],
      max_runtime_minutes: 180,
      mood_tags: [],
      platforms_allowed: [],
      auto_suggest: true,
      created_at: "2026-08-23T12:00:00.000Z",
      updated_at: "2026-08-23T12:00:00.000Z",
    };
    await assertSucceeds(testEnv.authenticatedContext(ALICE).firestore().doc(path).set(plan));
    await assertFails(testEnv.authenticatedContext(BOB).firestore().doc(path).get());
    await assertFails(testEnv.authenticatedContext(BOB).firestore().doc(path).update({ name: "Stolen" }));
  });

  it("lets owners manage schedules but prevents owner spoofing", async () => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/schedules/a`);
    const schedule = {
      user_id: ALICE,
      bookmark_id: "bookmark-a",
      scheduled_for: "2026-08-24T18:00:00.000Z",
      reminder_offset_minutes: 60,
      recurrence_type: "none",
      state: "scheduled",
      created_at: "2026-08-23T12:00:00.000Z",
      updated_at: "2026-08-23T12:00:00.000Z",
    };
    await assertSucceeds(ref.set(schedule));
    await assertFails(ref.update({ user_id: BOB }));
    await assertSucceeds(ref.update({ state: "cancelled", updated_at: "2026-08-23T12:01:00.000Z" }));
  });

  it("allows only read-state updates on server-created notifications", async () => {
    const path = `users/${ALICE}/notifications/a`;
    await seed(path, {
      user_id: ALICE,
      bookmark_id: null,
      schedule_id: null,
      title: "Reminder",
      body: "Time to watch",
      read_at: null,
      created_at: "2026-08-23T12:00:00.000Z",
    });
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(path);
    await assertSucceeds(ref.update({ read_at: "2026-08-23T12:01:00.000Z" }));
    await assertFails(ref.update({ title: "Forged" }));
    await assertFails(
      testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/notifications/b`).set({ title: "spam" }),
    );
  });

  it("allows bounded attachment metadata and rejects invalid type or size", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const valid = {
      user_id: ALICE,
      bookmark_id: "bookmark-a",
      file_url: "https://firebasestorage.googleapis.com/file",
      file_type: "image/png",
      file_name: "poster.png",
      size: 1024,
      created_at: "2026-08-23T12:00:00.000Z",
      storage_path: `attachments/${ALICE}/bookmark-a/poster.png`,
    };
    await assertSucceeds(db.doc(`users/${ALICE}/attachments/a`).set(valid));
    await assertFails(db.doc(`users/${ALICE}/attachments/b`).set({ ...valid, file_type: "text/html" }));
    await assertFails(db.doc(`users/${ALICE}/attachments/c`).set({ ...valid, size: 20 * 1024 * 1024 + 1 }));
  });

  it("keeps server-generated activity collections read-only", async () => {
    for (const collection of ["captures", "activity", "resurfaceEvents", "clusters"]) {
      const path = `users/${ALICE}/${collection}/a`;
      await seed(path, { value: true });
      const ref = testEnv.authenticatedContext(ALICE).firestore().doc(path);
      await assertSucceeds(ref.get());
      await assertFails(ref.set({ value: false }));
    }
  });

  it("keeps capture jobs completely server-only", async () => {
    await seed("captureJobs/job-a", { uid: ALICE, state: "queued" });
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc("captureJobs/job-a");
    await assertFails(ref.get());
    await assertFails(ref.set({ uid: ALICE, state: "complete" }));
  });
});

describe("social graph integrity", () => {
  it("requires reciprocal follow documents in one atomic batch", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const following = db.doc(`users/${ALICE}/following/${BOB}`);
    const follower = db.doc(`users/${BOB}/followers/${ALICE}`);
    const data = {
      follower_uid: ALICE,
      following_uid: BOB,
      created_at: "2026-08-23T12:00:00.000Z",
    };

    await assertFails(follower.set(data));
    const batch = db.batch();
    batch.set(following, data);
    batch.set(follower, data);
    await assertSucceeds(batch.commit());
  });

  it("rejects follower spoofing", async () => {
    const ref = testEnv.authenticatedContext(ALICE).firestore().doc(`users/${BOB}/followers/mallory`);
    await assertFails(ref.set({
      follower_uid: "mallory",
      following_uid: BOB,
      created_at: "2026-08-23T12:00:00.000Z",
    }));
  });
});

describe("public and administrative boundaries", () => {
  it("denies orphaned projections immediately after private deletion", async () => {
    await seed(`users/${ALICE}/bookmarks/shared`, bookmark({ is_public: true, share_token: "deleted-token" }));
    await seed("publicBookmarkOwners/deleted-token", { uid: ALICE, bookmarkId: "shared" });
    await seed("publicBookmarks/deleted-token", { title: "Private after deletion" });
    const publicRef = testEnv.unauthenticatedContext().firestore().doc("publicBookmarks/deleted-token");
    await assertSucceeds(publicRef.get());
    await assertSucceeds(testEnv.authenticatedContext(ALICE).firestore().doc(`users/${ALICE}/bookmarks/shared`).delete());
    await assertFails(publicRef.get());
  });
  it("exposes only the public projection seeded by trusted server code", async () => {
    const projection = {
      schemaVersion: 1,
      ownerDisplayName: null,
      title: "Arrival",
      mediaType: "movie",
      posterUrl: null,
      releaseYear: 2016,
      runtimeMinutes: 116,
      canonicalUrl: null,
      createdAt: "2026-08-23T12:00:00.000Z",
    };
    await seed("publicBookmarks/share-token", projection);
    await seed("publicBookmarkOwners/share-token", { uid: ALICE, bookmarkId: "shared" });
    await seed(`users/${ALICE}/bookmarks/shared`, bookmark({ is_public: true, share_token: "share-token" }));
    const snap = await assertSucceeds(
      testEnv.unauthenticatedContext().firestore().doc("publicBookmarks/share-token").get(),
    );
    expect(snap.data()).toEqual(projection);
    await assertFails(
      testEnv.authenticatedContext(ALICE).firestore().doc("publicBookmarks/forged").set({
        ...projection,
        notes: "private",
      }),
    );
  });

  it("closes the direct browser error-report spam path", async () => {
    await assertFails(
      testEnv.authenticatedContext(ALICE).firestore().collection("errorReports").add({
        uid: ALICE,
        error: { message: "spam" },
      }),
    );
  });
});

describe("Storage attachment boundaries", () => {
  it("allows owner images and PDFs but blocks cross-user and active content", async () => {
    const aliceStorage = testEnv.authenticatedContext(ALICE).storage(`gs://${PROJECT_ID}.appspot.com`);
    const bobStorage = testEnv.authenticatedContext(BOB).storage(`gs://${PROJECT_ID}.appspot.com`);
    const path = `attachments/${ALICE}/bookmark-a/file.png`;

    await assertSucceeds(aliceStorage.ref(path).put(new Uint8Array([1, 2, 3]), { contentType: "image/png" }));
    await assertFails(bobStorage.ref(`attachments/${ALICE}/bookmark-a/other.png`).put(new Uint8Array([1]), { contentType: "image/png" }));
    await assertFails(aliceStorage.ref(`attachments/${ALICE}/bookmark-a/page.html`).put(new Uint8Array([1]), { contentType: "text/html" }));
  });
});

