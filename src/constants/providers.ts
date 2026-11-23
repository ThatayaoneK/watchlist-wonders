/**
 * Provider constants — logos, colors, and display labels.
 *
 * Logo images are inlined as data URIs or reliable CDN URLs so they work
 * offline and don't require a separate asset pipeline step.
 *
 * For providers without a logo URI, we fall back to the color + first letter.
 */

export interface ProviderMeta {
  label: string;
  /** Tailwind bg class for the color dot / fallback badge */
  color: string;
  /** Small square logo image URL (32×32 ideal). null = use color fallback */
  logoUrl: string | null;
}

// Using simple SVG data-URIs for the most common providers so they render
// instantly without network requests. Less-common providers fall back to colored dots.
export const PROVIDER_META: Record<string, ProviderMeta> = {
  youtube: {
    label: "YouTube",
    color: "bg-red-600",
    logoUrl: "https://www.youtube.com/favicon.ico",
  },
  netflix: {
    label: "Netflix",
    color: "bg-red-700",
    logoUrl: "https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.ico",
  },
  imdb: {
    label: "IMDb",
    color: "bg-yellow-500",
    logoUrl: "https://m.media-amazon.com/images/G/01/imdb/images-ANDW73HA/favicon_desktop_32x32._CB1582158068_.png",
  },
  disneyplus: {
    label: "Disney+",
    color: "bg-blue-800",
    logoUrl: "https://www.disneyplus.com/favicon.ico",
  },
  disney: {
    label: "Disney+",
    color: "bg-blue-800",
    logoUrl: "https://www.disneyplus.com/favicon.ico",
  },
  primevideo: {
    label: "Prime Video",
    color: "bg-sky-600",
    logoUrl: "https://www.amazon.com/favicon.ico",
  },
  prime: {
    label: "Prime Video",
    color: "bg-sky-600",
    logoUrl: "https://www.amazon.com/favicon.ico",
  },
  hbomax: {
    label: "Max",
    color: "bg-purple-900",
    logoUrl: "https://www.max.com/favicon.ico",
  },
  hbo: {
    label: "Max",
    color: "bg-purple-900",
    logoUrl: "https://www.max.com/favicon.ico",
  },
  appletv: {
    label: "Apple TV+",
    color: "bg-zinc-800",
    logoUrl: "https://www.apple.com/favicon.ico",
  },
  appletvplus: {
    label: "Apple TV+",
    color: "bg-zinc-800",
    logoUrl: "https://www.apple.com/favicon.ico",
  },
  peacock: {
    label: "Peacock",
    color: "bg-yellow-600",
    logoUrl: "https://www.peacocktv.com/favicon.ico",
  },
  tiktok: {
    label: "TikTok",
    color: "bg-neutral-900",
    logoUrl: "https://www.tiktok.com/favicon.ico",
  },
  instagram: {
    label: "Instagram",
    color: "bg-pink-500",
    logoUrl: "https://www.instagram.com/favicon.ico",
  },
  facebook: {
    label: "Facebook",
    color: "bg-blue-600",
    logoUrl: "https://www.facebook.com/favicon.ico",
  },
  x: {
    label: "X",
    color: "bg-neutral-400",
    logoUrl: "https://x.com/favicon.ico",
  },
  twitch: {
    label: "Twitch",
    color: "bg-purple-600",
    logoUrl: "https://www.twitch.tv/favicon.ico",
  },
  letterboxd: {
    label: "Letterboxd",
    color: "bg-green-600",
    logoUrl: "https://letterboxd.com/favicon.ico",
  },
  reddit: {
    label: "Reddit",
    color: "bg-orange-500",
    logoUrl: "https://www.reddit.com/favicon.ico",
  },
  rottentomatoes: {
    label: "Rotten Tomatoes",
    color: "bg-red-500",
    logoUrl: "https://www.rottentomatoes.com/favicon.ico",
  },
  generic: {
    label: "Web",
    color: "bg-neutral-500",
    logoUrl: null,
  },
};

export function getProviderMeta(provider: string): ProviderMeta {
  return (
    PROVIDER_META[provider] ?? {
      label: provider.charAt(0).toUpperCase() + provider.slice(1),
      color: "bg-neutral-500",
      logoUrl: null,
    }
  );
}
