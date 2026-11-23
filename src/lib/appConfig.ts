const DEFAULT_APP_URL = "https://watchlist-wonders.app";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getCanonicalAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (typeof configured === "string" && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return DEFAULT_APP_URL;
}
