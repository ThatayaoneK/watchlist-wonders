import { hostMatches, type UrlExtractor } from "./types";
export const xExtractor: UrlExtractor = { provider: "x", matches: (url) => hostMatches(url, ["x.com", "twitter.com"]) };
