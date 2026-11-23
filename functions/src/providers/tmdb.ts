export interface TmdbProviderCandidate {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year?: number;
}

export interface TmdbProvider {
  search(title: string): Promise<TmdbProviderCandidate[]>;
}
