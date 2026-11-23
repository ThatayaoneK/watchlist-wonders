import { hostMatches, type UrlExtractor } from "./types";
export const tiktokExtractor: UrlExtractor = { provider: "tiktok", matches: (url) => hostMatches(url, ["tiktok.com"]) };
