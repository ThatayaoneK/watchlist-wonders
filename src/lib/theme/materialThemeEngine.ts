/**
 * Material Theme Engine
 * 
 * Core type definition for adaptive luxury theming system.
 * Transforms Watch Wonders into a material-reactive cinematic platform
 * where watch materials, photography tones, and editorial mood
 * subtly influence the entire interface.
 */

export type MaterialTheme = {
  /**
   * Unique identifier for the theme
   */
  id: string

  /**
   * Primary ambient glow color
   * Creates environmental atmospheric effect
   */
  ambient: string

  /**
   * Secondary ambient for depth layering
   */
  ambientSecondary: string

  /**
   * Primary accent color derived from material
   * Used for emphasis and interactive elements
   */
  accent: string

  /**
   * Soft variant of accent
   * Used for subtle highlights and hover states
   */
  accentSoft: string

  /**
   * Border color for cards and elevated surfaces
   */
  border: string

  /**
   * Base surface color for main backgrounds
   */
  surface: string

  /**
   * Elevated surface for cards and modals
   */
  surfaceElevated: string

  /**
   * Primary text color
   */
  textPrimary: string

  /**
   * Secondary text for labels and metadata
   */
  textSecondary: string

  /**
   * Glow effect color for ambient lighting
   */
  glow: string

  /**
   * Gradient string for hero and atmospheric effects
   */
  gradient: string
}

/**
 * Default fallback theme
 * Used when material cannot be determined
 */
export const DEFAULT_THEME_ID = "titanium"
