/**
 * Material Theme Resolution Engine
 * 
 * Maps watch materials to their corresponding luxury themes.
 * This function is the bridge between watch data and visual theming.
 */

import {
  bronzeTheme,
  goldTheme,
  titaniumTheme,
} from "./materialThemes"
import {
  DEFAULT_THEME_ID,
  MaterialTheme,
} from "./materialThemeEngine"

/**
 * Resolves a watch material string to its corresponding MaterialTheme
 * 
 * @param material - Material string from watch data (e.g., "gold", "titanium", "bronze")
 * @returns Resolved MaterialTheme, or titanium theme as fallback
 * 
 * @example
 * const theme = resolveMaterialTheme("rose gold") // Returns goldTheme
 * const theme = resolveMaterialTheme("steel") // Returns titaniumTheme
 */
export function resolveMaterialTheme(
  material?: string
): MaterialTheme {
  if (!material) {
    return titaniumTheme
  }

  const normalized = material.toLowerCase().trim()

  // Gold variants
  if (
    normalized === "gold" ||
    normalized === "yellow gold" ||
    normalized === "rose gold" ||
    normalized === "white gold" ||
    normalized === "precious metal"
  ) {
    return goldTheme
  }

  // Titanium / Steel variants
  if (
    normalized === "titanium" ||
    normalized === "steel" ||
    normalized === "stainless steel" ||
    normalized === "platinum" ||
    normalized === "silver" ||
    normalized === "chrome"
  ) {
    return titaniumTheme
  }

  // Bronze variants
  if (
    normalized === "bronze" ||
    normalized === "copper" ||
    normalized === "vintage" ||
    normalized === "brass"
  ) {
    return bronzeTheme
  }

  // Fallback to default theme
  return titaniumTheme
}

/**
 * Safely resolve a material theme with explicit fallback
 * Useful when you want to ensure a specific theme is returned
 */
export function resolveMaterialThemeOrDefault(
  material?: string,
  _fallbackThemeId: string = DEFAULT_THEME_ID
): MaterialTheme {
  return resolveMaterialTheme(material) || titaniumTheme
}
