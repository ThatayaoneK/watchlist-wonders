/**
 * Theme Variables Component
 * 
 * Injects MaterialTheme values as CSS custom properties (variables)
 * into the document root. This enables global theming without
 * component-level style duplication.
 * 
 * Benefits:
 * - Single source of truth for colors
 * - Smooth theme transitions via CSS
 * - Works with Tailwind and raw CSS
 * - Enables runtime theme changes
 */

import { useMaterialTheme } from "@/providers/ThemeProvider"

/**
 * Complete list of CSS variables injected by ThemeVariables
 * These can be referenced in your styles as var(--ambient), etc.
 */
export const THEME_CSS_VARIABLES = [
  "--ambient",
  "--ambient-secondary",
  "--accent",
  "--accent-soft",
  "--border",
  "--surface",
  "--surface-elevated",
  "--text-primary",
  "--text-secondary",
  "--glow",
  "--gradient",
] as const

/**
 * ThemeVariables Component
 * 
 * Reads from ThemeProvider context and injects CSS variables.
 * Place this near the top of your app tree, preferably in a root layout.
 * 
 * @example
 * ```tsx
 * function RootLayout() {
 *   return (
 *     <ThemeProvider theme={theme}>
 *       <ThemeVariables />
 *       <YourApp />
 *     </ThemeProvider>
 *   )
 * }
 * ```
 */
export function ThemeVariables() {
  const theme = useMaterialTheme()

  // Generate CSS variable declarations
  const cssVariables = `
    :root {
      --ambient: ${theme.ambient};
      --ambient-secondary: ${theme.ambientSecondary};
      --accent: ${theme.accent};
      --accent-soft: ${theme.accentSoft};
      --border: ${theme.border};
      --surface: ${theme.surface};
      --surface-elevated: ${theme.surfaceElevated};
      --text-primary: ${theme.textPrimary};
      --text-secondary: ${theme.textSecondary};
      --glow: ${theme.glow};
      --gradient: ${theme.gradient};
    }

    /* Apply theme-aware transitions for smooth changes */
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }
  `

  return <style>{cssVariables}</style>
}

/**
 * Alternative: Static CSS file approach
 * 
 * For better performance in production, you might generate
 * theme CSS files at build time and link them dynamically.
 * This component is fine for most cases but can be optimized further.
 */

/**
 * Helper: Get a theme color value as CSS custom property
 * 
 * @example
 * const color = getCSSVariable("--accent") // "var(--accent)"
 */
export function getCSSVariable(
  variableName: typeof THEME_CSS_VARIABLES[number]
): string {
  return `var(${variableName})`
}
