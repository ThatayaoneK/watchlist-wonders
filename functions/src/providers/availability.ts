export interface AvailabilityProvider {
  lookup(input: { tmdbId: number; mediaType: "movie" | "tv"; region: string }): Promise<Record<string, unknown>>;
}
