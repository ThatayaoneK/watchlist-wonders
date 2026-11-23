import type { ExtractedSignals, PipelineBookmark } from "../types";

const PLATFORM_BY_PROVIDER: Record<string, string> = {
  youtube: "youtube",
  instagram: "instagram",
  tiktok: "tiktok",
  reddit: "reddit",
  facebook: "facebook",
  x: "x",
  netflix: "netflix",
  imdb: "imdb",
  letterboxd: "letterboxd",
  rottentomatoes: "rottentomatoes",
  generic: "web",
};

const DOMAIN_TYPE_BY_PROVIDER: Record<string, ExtractedSignals["domainType"]> = {
  youtube: "video",
  tiktok: "social",
  instagram: "social",
  facebook: "social",
  x: "social",
  reddit: "social",
  imdb: "media",
  letterboxd: "media",
  rottentomatoes: "media",
  netflix: "media",
  generic: "article",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  if (!matches) return [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 20);
}

export function extract(bookmark: PipelineBookmark): ExtractedSignals {
  const metadata = bookmark.metadata ?? {};

  const rawTitle =
    asString(bookmark.title) ||
    asString(metadata.ogTitle) ||
    asString(metadata.og_title) ||
    asString(metadata.oembedTitle) ||
    asString(metadata.oembed_title) ||
    asString(metadata.title);

  const description =
    asString(metadata.description) ||
    asString(metadata.og_description) ||
    asString(metadata.ogDescription) ||
    asString(metadata.summary);

  const thumbnailUrl =
    asString(metadata.thumbnail_url) ||
    asString(metadata.og_image) ||
    asString(metadata.ogImage) ||
    asString(bookmark.poster_url) ||
    null;

  const username =
    asString(metadata.author_name) ||
    asString(metadata.username) ||
    asString(metadata.uploader) ||
    null;

  const provider = asString(bookmark.provider).toLowerCase() || "generic";
  const platform = PLATFORM_BY_PROVIDER[provider] ?? "web";
  const domainType = DOMAIN_TYPE_BY_PROVIDER[provider] ?? "article";

  const hashtagSources = [description, rawTitle, ...asArray(metadata.tags)].join(" ");
  const hashtags = extractHashtags(hashtagSources);

  const fullText = [rawTitle, description, ...hashtags.map((h) => `#${h}`)]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  return {
    rawTitle,
    description,
    thumbnailUrl,
    hashtags,
    username,
    platform,
    fullText,
    domainType,
  };
}
