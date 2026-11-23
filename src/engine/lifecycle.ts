import type { Bookmark } from "@/types/database";

export type LifecycleState = "queued" | "up_next" | "in_progress" | "completed" | "archived";

export interface LifecycleMetadataUpdate {
  [key: string]: string;
}

export function deriveLifecycleState(bookmark: Bookmark): LifecycleState {
  if (bookmark.status === "done") return "completed";
  if (bookmark.status === "dropped") return "archived";
  if (bookmark.status === "watching" || (bookmark.progress_percent ?? 0) > 0) return "in_progress";
  if (bookmark.queue_status === "up_next") return "up_next";
  return "queued";
}

export function getNextStatus(current: Bookmark["status"]): Bookmark["status"] {
  switch (current) {
    case "backlog":
      return "watching";
    case "watching":
      return "done";
    case "done":
      return "backlog";
    case "scheduled":
      return "watching";
    case "dropped":
      return "backlog";
    default:
      return "backlog";
  }
}

function mergeMetadata(existing: Record<string, unknown> | undefined, state: LifecycleState, now: string) {
  return {
    ...(existing ?? {}),
    lifecycle_state: state,
    lifecycle_updated_at: now,
  };
}

export function buildLifecycleUpdate(
  bookmark: Bookmark,
  targetStatus: Bookmark["status"],
  now: Date = new Date(),
): Partial<Bookmark> {
  const timestamp = now.toISOString();
  const updates: Partial<Bookmark> = {
    status: targetStatus,
  };

  if (targetStatus === "watching") {
    updates.queue_status = "in_progress";
    updates.progress_percent = Math.max(1, bookmark.progress_percent ?? 0);
    const state: LifecycleState = "in_progress";
    updates.metadata = mergeMetadata(bookmark.metadata, state, timestamp);
    return updates;
  }

  if (targetStatus === "done") {
    updates.queue_status = "completed";
    updates.progress_percent = 100;
    if (!bookmark.watched_at) {
      updates.watched_at = timestamp;
    }
    const state: LifecycleState = "completed";
    updates.metadata = mergeMetadata(bookmark.metadata, state, timestamp);
    return updates;
  }

  if (targetStatus === "backlog") {
    const queueStatus = bookmark.queue_status === "up_next" ? "up_next" : "queued";
    updates.queue_status = queueStatus;
    updates.progress_percent = 0;
    const state: LifecycleState = queueStatus === "up_next" ? "up_next" : "queued";
    updates.metadata = mergeMetadata(bookmark.metadata, state, timestamp);
    return updates;
  }

  if (targetStatus === "scheduled") {
    updates.queue_status = "queued";
    const state: LifecycleState = "queued";
    updates.metadata = mergeMetadata(bookmark.metadata, state, timestamp);
    return updates;
  }

  if (targetStatus === "dropped") {
    updates.queue_status = "queued";
    const state: LifecycleState = "archived";
    updates.metadata = mergeMetadata(bookmark.metadata, state, timestamp);
    return updates;
  }

  const fallback = deriveLifecycleState(bookmark);
  updates.metadata = mergeMetadata(bookmark.metadata, fallback, timestamp);
  return updates;
}

export function buildLifecycleMetadataUpdate(state: LifecycleState, now: Date = new Date()): LifecycleMetadataUpdate {
  return {
    "metadata.lifecycle_state": state,
    "metadata.lifecycle_updated_at": now.toISOString(),
  };
}
