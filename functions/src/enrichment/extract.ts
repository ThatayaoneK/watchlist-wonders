import type { EnrichResponse } from "../enrich";
import { runEnrichmentRequest } from "../enrich";
import { facebookExtractor } from "../extractors/facebook";
import { genericOpenGraphExtractor } from "../extractors/genericOpenGraph";
import { imdbExtractor } from "../extractors/imdb";
import { instagramExtractor } from "../extractors/instagram";
import { letterboxdExtractor } from "../extractors/letterboxd";
import { tiktokExtractor } from "../extractors/tiktok";
import type { UrlExtractor } from "../extractors/types";
import { xExtractor } from "../extractors/x";
import { youtubeExtractor } from "../extractors/youtube";

const extractors: readonly UrlExtractor[] = [
  youtubeExtractor, imdbExtractor, tiktokExtractor, instagramExtractor,
  facebookExtractor, xExtractor, letterboxdExtractor, genericOpenGraphExtractor,
];

export function extractorForUrl(input: string): UrlExtractor {
  const url = new URL(input);
  return extractors.find((extractor) => extractor.matches(url)) ?? genericOpenGraphExtractor;
}

/**
 * Canonical capture extraction facade. The legacy engine remains behind this
 * boundary while provider fixtures are compared during the rollout.
 */
export async function extractCapture(input: { url?: string; title?: string }): Promise<EnrichResponse> {
  const extractor = input.url ? extractorForUrl(input.url) : genericOpenGraphExtractor;
  const result = await runEnrichmentRequest(input);
  return { ...result, provider: result.provider ?? extractor.provider };
}
