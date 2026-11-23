import { hostMatches, type UrlExtractor } from "./types";
export const facebookExtractor: UrlExtractor = { provider: "facebook", matches: (url) => hostMatches(url, ["facebook.com", "fb.watch"]) };
