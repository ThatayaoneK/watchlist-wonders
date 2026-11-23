import type { Bookmark } from "@/types/database";
import type { buildSmartFillData } from "@/lib/enrichmentSmartFill";

type SmartFill = ReturnType<typeof buildSmartFillData>;

export function buildCreatePayloadFromShare(
  data: {
    title: string;
    type: Bookmark["type"];
    provider: string;
    url: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
  },
  smartFill: SmartFill | null,
) {
  return {
    title: data.title,
    type: data.type,
    provider: data.provider as Bookmark["provider"],
    source_url: data.url || null,
    poster_url: data.posterUrl || null,
    runtime_minutes: data.runtimeMinutes,
    release_year: smartFill?.releaseYear ?? null,
    canonical_url: smartFill?.canonicalUrl ?? null,
    status: "backlog" as const,
    tags: smartFill?.tags ?? [],
    mood_tags: smartFill?.moodTags ?? [],
    metadata: smartFill?.metadata ?? {},
  };
}
