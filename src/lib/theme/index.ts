/**
 * Theme System Index
 * 
 * Central export point for all theming utilities.
 * Simplifies imports across the application.
 */

// Core types and engine
export { type MaterialTheme, DEFAULT_THEME_ID } from "./materialThemeEngine"

// Theme definitions
export {
  goldTheme,
  titaniumTheme,
  bronzeTheme,
  MATERIAL_THEMES,
} from "./materialThemes"

// Theme resolution
export {
  resolveMaterialTheme,
  resolveMaterialThemeOrDefault,
} from "./resolveMaterialTheme"
