import { hostMatches, type UrlExtractor } from "./types";
export const imdbExtractor: UrlExtractor = { provider: "imdb", matches: (url) => hostMatches(url, ["imdb.com"]) };
