import { hostMatches, type UrlExtractor } from "./types";
export const youtubeExtractor: UrlExtractor = { provider: "youtube", matches: (url) => hostMatches(url, ["youtube.com", "youtu.be"]) };
