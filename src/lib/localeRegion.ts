function extractRegionFromLocale(locale: string): string | null {
  const parts = locale
    .split(/[-_]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const candidate = parts[i];
    if (/^[a-zA-Z]{2}$/.test(candidate)) {
      return candidate.toUpperCase();
    }
  }

  return null;
}

export function buildRegionFallbackList(preferredRegion?: string | null): string[] {
  const candidates = [preferredRegion, "BW", "ZA", "US"];
  const deduped = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) continue;
    deduped.add(normalized);
  }

  return Array.from(deduped);
}

export function getPreferredRegionFromBrowser(): string | undefined {
  if (typeof navigator === "undefined") return undefined;

  const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const locale of locales) {
    const region = extractRegionFromLocale(locale);
    if (region) return region;
  }

  return "US";
}
