/**
 * Theme Utilities
 * 
 * Helper functions for advanced theme operations:
 * - Color manipulation
 * - Theme comparison
 * - Dynamic color generation
 * - Accessibility checking
 */

import { MaterialTheme } from "@/lib/theme/materialThemeEngine"

/**
 * Parse an rgba color string to get individual components
 * 
 * @param rgba - Color string like "rgba(200,169,107,.14)"
 * @returns Object with r, g, b, a values
 */
export function parseRgba(rgba: string) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([^)]*)\)/)

  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 }
  }

  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
    a: parseFloat(match[4] || "1"),
  }
}

/**
 * Convert hex color to rgb
 * @param hex - Hex color like "#C8A96B"
 */
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate perceived brightness of a color (0-255)
 * Uses luminance formula from WCAG
 */
export function getColorBrightness(hex: string): number {
  const rgb = hexToRgb(hex)

  if (!rgb) return 128

  // Calculate perceived brightness
  return Math.sqrt(
    rgb.r * rgb.r * 0.241 + rgb.g * rgb.g * 0.691 + rgb.b * rgb.b * 0.068
  )
}

/**
 * Check if a color is light or dark
 */
export function isLightColor(hex: string): boolean {
  return getColorBrightness(hex) > 128
}

/**
 * Get contrast text color (white or black) for given background
 */
export function getContrastColor(bgHex: string): string {
  return isLightColor(bgHex) ? "#000000" : "#FFFFFF"
}

/**
 * Check if two colors meet WCAG AA contrast ratio requirements (4.5:1)
 */
export function meetsWCAGContrast(
  foregroundHex: string,
  backgroundHex: string
): boolean {
  const getLuminance = (hex: string) => {
    const rgb = hexToRgb(hex)
    if (!rgb) return 0

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(foregroundHex)
  const l2 = getLuminance(backgroundHex)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  const contrastRatio = (lighter + 0.05) / (darker + 0.05)

  return contrastRatio >= 4.5
}

/**
 * Generate a theme variant with adjusted opacity
 * Useful for creating hover/active states
 */
export function adjustThemeOpacity(
  theme: MaterialTheme,
  opacityMultiplier: number
): Partial<MaterialTheme> {
  const adjustRgba = (rgba: string) => {
    const parsed = parseRgba(rgba)
    const newAlpha = Math.min(parsed.a * opacityMultiplier, 1)
    return `rgba(${parsed.r},${parsed.g},${parsed.b},${newAlpha})`
  }

  return {
    ambient: adjustRgba(theme.ambient),
    ambientSecondary: adjustRgba(theme.ambientSecondary),
    glow: adjustRgba(theme.glow),
  }
}

/**
 * Get theme's primary accent hex color
 */
export function getThemeAccentHex(theme: MaterialTheme): string {
  return theme.accent
}

/**
 * Check if theme is "warm" (gold/bronze) or "cool" (titanium)
 */
export function isWarmTheme(theme: MaterialTheme): boolean {
  return theme.id === "gold" || theme.id === "bronze"
}

/**
 * Get complementary theme for a given theme
 * Gold ↔ Titanium, Bronze ↔ Titanium
 */
export function getComplementaryThemeId(currentThemeId: string): string {
  if (currentThemeId === "gold") return "bronze"
  if (currentThemeId === "bronze") return "gold"
  return "titanium"
}

/**
 * Check if a theme is accessible for text rendering
 * Returns { accessible: boolean, contrastRatio: number }
 */
export function checkThemeTextAccessibility(theme: MaterialTheme) {
  const primaryContrast = meetsWCAGContrast(
    theme.textPrimary,
    theme.surface
  )
  const secondaryContrast = meetsWCAGContrast(
    theme.textSecondary,
    theme.surface
  )

  return {
    primaryAccessible: primaryContrast,
    secondaryAccessible: secondaryContrast,
    overallAccessible: primaryContrast && secondaryContrast,
  }
}

/**
 * Generate a CSS filter string to approximate a theme color
 * Useful for icon colorization
 */
export function generateColorFilter(targetHex: string): string {
  // This is a simplified filter generation
  // For precise color matching, use a library like ntc.js
  const brightness = getColorBrightness(targetHex)
  const isDark = brightness < 128

  if (isDark) {
    return "brightness(0.8) saturate(1.2)"
  }

  return "brightness(1.2) saturate(1.2)"
}

/**
 * Get theme metadata for analytics/logging
 */
export function getThemeMetadata(theme: MaterialTheme) {
  return {
    id: theme.id,
    isWarm: isWarmTheme(theme),
    accentColor: theme.accent,
    brightness: getColorBrightness(theme.accent),
    textAccessibility: checkThemeTextAccessibility(theme),
  }
}
