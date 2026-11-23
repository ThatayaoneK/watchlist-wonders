import { hostMatches, type UrlExtractor } from "./types";
export const instagramExtractor: UrlExtractor = { provider: "instagram", matches: (url) => hostMatches(url, ["instagram.com"]) };
