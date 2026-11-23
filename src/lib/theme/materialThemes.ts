/**
 * Material Theme Definitions
 * 
 * Three foundational material-based themes that establish the
 * luxury aesthetic for different watch collections and materials.
 */

import { MaterialTheme } from "./materialThemeEngine"

/**
 * Gold Theme
 * Warm, rich, prestigious
 * Applied to: gold watches, rose gold, precious metal collections
 */
export const goldTheme: MaterialTheme = {
  id: "gold",

  ambient: "rgba(200,169,107,.14)",
  ambientSecondary: "rgba(120,90,40,.10)",

  accent: "#C8A96B",
  accentSoft: "#E6D2A2",

  border: "rgba(200,169,107,.16)",

  surface: "#111114",
  surfaceElevated: "#18181B",

  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B8",

  glow: "rgba(200,169,107,.22)",

  gradient: `
    linear-gradient(
      135deg,
      rgba(200,169,107,.14),
      rgba(20,20,24,.0)
    )
  `,
}

/**
 * Titanium Theme
 * Clean, cool, precise, modern
 * Applied to: steel watches, titanium sports models, technical collections
 */
export const titaniumTheme: MaterialTheme = {
  id: "titanium",

  ambient: "rgba(160,170,190,.12)",
  ambientSecondary: "rgba(90,100,120,.08)",

  accent: "#B8C1D1",
  accentSoft: "#DCE2EC",

  border: "rgba(180,190,210,.12)",

  surface: "#101114",
  surfaceElevated: "#16171A",

  textPrimary: "#FFFFFF",
  textSecondary: "#B5BAC5",

  glow: "rgba(180,190,210,.18)",

  gradient: `
    linear-gradient(
      135deg,
      rgba(180,190,210,.12),
      rgba(20,20,24,.0)
    )
  `,
}

/**
 * Bronze Theme
 * Warm, vintage, distinguished, heritage
 * Applied to: bronze watches, vintage collections, artisanal pieces
 */
export const bronzeTheme: MaterialTheme = {
  id: "bronze",

  ambient: "rgba(166,104,64,.14)",
  ambientSecondary: "rgba(90,50,30,.08)",

  accent: "#A66840",
  accentSoft: "#D3A181",

  border: "rgba(166,104,64,.16)",

  surface: "#121110",
  surfaceElevated: "#1A1715",

  textPrimary: "#FFFFFF",
  textSecondary: "#B7AAA2",

  glow: "rgba(166,104,64,.20)",

  gradient: `
    linear-gradient(
      135deg,
      rgba(166,104,64,.14),
      rgba(20,20,24,.0)
    )
  `,
}

/**
 * All available themes
 */
export const MATERIAL_THEMES = {
  gold: goldTheme,
  titanium: titaniumTheme,
  bronze: bronzeTheme,
} as const
