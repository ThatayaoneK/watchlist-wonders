import { hostMatches, type UrlExtractor } from "./types";
export const letterboxdExtractor: UrlExtractor = { provider: "letterboxd", matches: (url) => hostMatches(url, ["letterboxd.com"]) };
