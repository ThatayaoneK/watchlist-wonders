import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 0) return "Past";
      if (mins < 60) return `In ${mins}m`;
    }
    if (hours < 0) return "Past";
    return `In ${hours}h`;
  }
  
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 7) return `In ${days} days`;
  if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
  
  return date.toLocaleDateString();
}

export function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function detectProvider(url: string): "youtube" | "imdb" | "netflix" | "instagram" | "facebook" | "x" | "letterboxd" | "tiktok" | "reddit" | "rottentomatoes" | "generic" {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("imdb.com")) return "imdb";
    if (hostname.includes("netflix.com")) return "netflix";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("facebook.com") || hostname.includes("fb.com")) return "facebook";
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "x";
    if (hostname.includes("letterboxd.com")) return "letterboxd";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("reddit.com")) return "reddit";
    if (hostname.includes("rottentomatoes.com")) return "rottentomatoes";

    return "generic";
  } catch {
    return "generic";
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes("youtube.com")) {
      return urlObj.searchParams.get("v");
    }
  } catch {}
  return null;
}

export function extractImdbId(url: string): string | null {
  const match = url.match(/tt\d+/);
  return match ? match[0] : null;
}

export function getMoodEmoji(mood: string): string {
  const moods: Record<string, string> = {
    action: "💥",
    comedy: "😂",
    drama: "🎭",
    horror: "😱",
    romance: "💕",
    thriller: "😰",
    documentary: "📚",
    scifi: "🚀",
    fantasy: "🧙",
    animation: "🎨",
    family: "👨‍👩‍👧‍👦",
    music: "🎵",
    mystery: "🔍",
    western: "🤠",
    war: "⚔️",
    crime: "🔫",
    relaxing: "😌",
    inspiring: "✨",
    intense: "🔥",
    thoughtful: "🤔",
    nostalgic: "📼",
    uplifting: "🌟",
    dark: "🌑",
    quirky: "🎪",
    epic: "🏔️",
    emotional: "💔",
    fun: "🎉",
    educational: "📖",
  };
  return moods[mood.toLowerCase()] || "🎬";
}


/**
 * Normalizes shared URLs for duplicate detection without changing the saved source URL.
 * Removes fragments and common tracking parameters while preserving content identifiers.
 */
export function normalizeBookmarkUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS links can be saved.");
  }

  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\\./, "");
  parsed.hash = "";

  const trackingParams = [
    "fbclid", "gclid", "igsh", "igshid", "si", "feature",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "ref", "ref_src",
  ];
  trackingParams.forEach((param) => parsed.searchParams.delete(param));
  [...parsed.searchParams.keys()].forEach((key) => {
    if (key.toLowerCase().startsWith("utm_")) parsed.searchParams.delete(key);
  });

  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\\/+$/, "");
  parsed.searchParams.sort();
  return parsed.toString();
}
