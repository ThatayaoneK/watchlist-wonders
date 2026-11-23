import type { Bookmark } from "@/types/database";
import { getRails, type DecisionRail } from "@/engine/decisionEngine";

export interface RailConfig extends DecisionRail {
  reason?: string;
}

interface UserContext {
  now?: Date;
}

export function generateRails(
  bookmarks: Bookmark[],
  context: UserContext = {},
): RailConfig[] {
  return getRails(bookmarks, {
    now: context.now,
    maxRails: 5,
  }).map((rail) => ({
    ...rail,
    reason: rail.subtitle,
  }));
}
