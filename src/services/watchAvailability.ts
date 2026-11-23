import {
  fetchWatchProvidersViaProxy,
  searchTmdbIdViaProxy,
  type WatchProvidersResponse,
} from "@/services/tmdbProxy";
import { getPreferredRegionFromBrowser } from "@/lib/localeRegion";

export const WATCH_AVAILABILITY_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WATCH_REGION = "US";

export type AvailabilityStatus = "ok" | "no_tmdb_match" | "no_providers" | "error";

const AVAILABILITY_STATUS_VALUES: ReadonlySet<AvailabilityStatus> = new Set([
  "ok",
  "no_tmdb_match",
  "no_providers",
  "error",
]);
export type AvailabilityProviderType = "subscription" | "rent" | "buy";

export interface AvailabilityProvider {
  name: string;
  type: AvailabilityProviderType;
  url: string;
  region: string;
  providerId: number;
  logoUrl: string | null;
  score: number;
  /** ISO date string — when this title leaves the provider. Optional. */
  leaving_date?: string | null;
}

export interface BookmarkAvailability {
  providers: AvailabilityProvider[];
  lastUpdated: string;
  region: string;
  tmdbId: number | null;
  status: AvailabilityStatus;
}

interface AvailabilitySource {
  title: string;
  type: BookmarkType;
  provider?: BookmarkProvider | string | null;
  metadata?: Record<string, unknown> | null;
}

type BookmarkType = "movie" | "series" | "episode" | "video" | "doc" | "other";
type BookmarkProvider =
  | "youtube"
  | "imdb"
  | "netflix"
  | "instagram"
  | "facebook"
  | "x"
  | "letterboxd"
  | "tiktok"
  | "reddit"
  | "rottentomatoes"
  | "generic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function normalizeProviderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function computeScore(
  type: AvailabilityProviderType,
  providerName: string,
  userProviders: string[],
): number {
  const isAvailableInRegion = 1;
  const isSubscription = type === "subscription" ? 3 : 1;
  const providerToken = normalizeProviderToken(providerName);
  const userUsesPlatform = userProviders.some((item) =>
    providerToken.includes(normalizeProviderToken(item)),
  )
    ? 2
    : 0;

  return isAvailableInRegion * 5 + isSubscription + userUsesPlatform;
}

function normalizeRegion(region?: string | null): string {
  const trimmed = region?.trim().toUpperCase();
  if (trimmed) return trimmed;
  return getPreferredRegionFromBrowser()?.trim().toUpperCase() || DEFAULT_WATCH_REGION;
}

function toMediaType(type: BookmarkType): "movie" | "tv" {
  return type === "series" || type === "episode" ? "tv" : "movie";
}

function getMetadataTmdbId(metadata?: Record<string, unknown> | null): number | null {
  if (!metadata) return null;
  return readNumber(metadata.tmdb_id ?? metadata.tmdbId);
}

function getOverview(metadata?: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined;
  const value = metadata.overview;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getUserProviders(source: AvailabilitySource): string[] {
  const providers: string[] = [];
  if (source.provider && typeof source.provider === "string") {
    providers.push(source.provider);
  }

  const metadata = source.metadata;
  if (metadata && Array.isArray(metadata.preferred_providers)) {
    for (const item of metadata.preferred_providers) {
      if (typeof item === "string" && item.trim()) providers.push(item.trim());
    }
  }

  return providers;
}

function buildProviderUrl(
  providerName: string,
  title: string,
  watchProvidersLink?: string,
): string {
  if (watchProvidersLink) return watchProvidersLink;
  const query = encodeURIComponent(`${providerName} ${title}`);
  return `https://www.google.com/search?q=${query}`;
}

function mapProviderGroup(
  items: WatchProvidersResponse["flatrate"] | WatchProvidersResponse["rent"] | WatchProvidersResponse["buy"],
  type: AvailabilityProviderType,
  region: string,
  title: string,
  userProviders: string[],
  watchProvidersLink?: string,
): AvailabilityProvider[] {
  return items.map((provider) => ({
    name: provider.provider_name,
    type,
    url: buildProviderUrl(provider.provider_name, title, watchProvidersLink),
    region,
    providerId: provider.provider_id,
    logoUrl: provider.logoUrl ?? null,
    score: computeScore(type, provider.provider_name, userProviders),
  }));
}

export function buildFallbackSearchUrls(title: string) {
  const encoded = encodeURIComponent(title);
  return {
    google: `https://www.google.com/search?q=${encoded}`,
    youtube: `https://www.youtube.com/results?search_query=${encoded}`,
    web: `https://duckduckgo.com/?q=${encoded}`,
  };
}

export function getAvailabilityFromBookmark(
  bookmark?: { availability?: unknown; metadata?: Record<string, unknown> } | null,
): BookmarkAvailability | null {
  if (!bookmark) return null;
  const direct = asRecord(bookmark.availability);
  const metadataAvailability = asRecord(bookmark.metadata?.availability);
  const source = direct ?? metadataAvailability;
  if (!source) return null;

  const region = typeof source.region === "string" && source.region.trim()
    ? source.region.trim().toUpperCase()
    : DEFAULT_WATCH_REGION;
  const lastUpdated = typeof source.lastUpdated === "string" ? source.lastUpdated : "";
  const rawStatus = typeof source.status === "string" ? source.status : "";
  const status: AvailabilityStatus = AVAILABILITY_STATUS_VALUES.has(rawStatus as AvailabilityStatus)
    ? (rawStatus as AvailabilityStatus)
    : "error";
  const tmdbId = readNumber(source.tmdbId);
  const rawProviders = Array.isArray(source.providers) ? source.providers : [];

  const providers: AvailabilityProvider[] = rawProviders
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const name = typeof record.name === "string" ? record.name : "";
      const type = typeof record.type === "string" ? record.type : "";
      const url = typeof record.url === "string" ? record.url : "";
      if (!name || !url) return null;
      if (type !== "subscription" && type !== "rent" && type !== "buy") return null;

      return {
        name,
        type,
        url,
        region: typeof record.region === "string" && record.region.trim()
          ? record.region.trim().toUpperCase()
          : region,
        providerId: readNumber(record.providerId) ?? 0,
        logoUrl: typeof record.logoUrl === "string" ? record.logoUrl : null,
        score: readNumber(record.score) ?? 0,
      } as AvailabilityProvider;
    })
    .filter((item): item is AvailabilityProvider => item !== null);

  return {
    providers,
    lastUpdated,
    region,
    tmdbId,
    status,
  };
}

export function isAvailabilityFresh(
  availability: BookmarkAvailability | null | undefined,
  preferredRegion?: string,
  ttlMs = WATCH_AVAILABILITY_TTL_MS,
): boolean {
  if (!availability) return false;
  if (!availability.lastUpdated) return false;
  const updatedAt = Date.parse(availability.lastUpdated);
  if (!Number.isFinite(updatedAt)) return false;
  const age = Date.now() - updatedAt;
  if (age > ttlMs) return false;

  const targetRegion = normalizeRegion(preferredRegion);
  return availability.region === targetRegion;
}

export function toAvailabilityMetadataUpdate(
  currentMetadata: Record<string, unknown> | undefined,
  availability: BookmarkAvailability,
  tmdbId?: number | null,
): Record<string, unknown> {
  const metadata = { ...(currentMetadata || {}) };
  metadata.availability = availability;
  if (tmdbId && tmdbId > 0 && !getMetadataTmdbId(metadata)) {
    metadata.tmdb_id = tmdbId;
  }
  return metadata;
}

export function rankAvailabilityProviders(availability: BookmarkAvailability): BookmarkAvailability {
  return {
    ...availability,
    providers: [...availability.providers].sort((a, b) => b.score - a.score),
  };
}

export async function resolveTitleToTmdbId(
  source: AvailabilitySource,
): Promise<number | null> {
  const existing = getMetadataTmdbId(source.metadata || undefined);
  if (existing) return existing;
  const title = source.title?.trim();
  if (!title) return null;
  const mediaType = toMediaType(source.type);
  const overview = getOverview(source.metadata || undefined);
  return searchTmdbIdViaProxy(title, mediaType, overview);
}

export function buildAvailabilityFromWatchProviders(
  source: AvailabilitySource,
  watchProviders: WatchProvidersResponse,
  preferredRegion?: string,
  tmdbId?: number | null,
): BookmarkAvailability {
  const region = normalizeRegion(watchProviders.resolvedRegion || preferredRegion);
  const userProviders = getUserProviders(source);

  const providers = [
    ...mapProviderGroup(
      watchProviders.flatrate || [],
      "subscription",
      region,
      source.title,
      userProviders,
      watchProviders.link,
    ),
    ...mapProviderGroup(
      watchProviders.rent || [],
      "rent",
      region,
      source.title,
      userProviders,
      watchProviders.link,
    ),
    ...mapProviderGroup(
      watchProviders.buy || [],
      "buy",
      region,
      source.title,
      userProviders,
      watchProviders.link,
    ),
  ];

  return rankAvailabilityProviders({
    providers,
    lastUpdated: new Date().toISOString(),
    region,
    tmdbId: tmdbId ?? null,
    status: providers.length > 0 ? "ok" : "no_providers",
  });
}

export async function resolveAndFetchAvailability(
  source: AvailabilitySource,
  preferredRegion?: string,
): Promise<{ availability: BookmarkAvailability; tmdbId: number | null }> {
  const region = normalizeRegion(preferredRegion);
  const tmdbId = await resolveTitleToTmdbId(source);
  if (!tmdbId) {
    return {
      tmdbId: null,
      availability: {
        providers: [],
        lastUpdated: new Date().toISOString(),
        region,
        tmdbId: null,
        status: "no_tmdb_match",
      },
    };
  }

  const watchProviders = await fetchWatchProvidersViaProxy(
    tmdbId,
    toMediaType(source.type),
    region,
  );
  return {
    tmdbId,
    availability: buildAvailabilityFromWatchProviders(source, watchProviders, region, tmdbId),
  };
}
