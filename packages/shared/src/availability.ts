export type AvailabilityStatus = "ok" | "no_tmdb_match" | "no_providers" | "error";

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


