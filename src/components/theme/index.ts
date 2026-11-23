/**
 * Theme Components Index
 * 
 * Central export point for all theme-related components
 */

export { ThemeVariables, getCSSVariable, THEME_CSS_VARIABLES } from "./ThemeVariables"

export { AmbientBackground, AnimatedAmbientBackground } from "./AmbientBackground"

export {
  ThemedBox,
  ThemedButton,
  ThemedAccentText,
  GlowedElement,
  ThemedGradient,
} from "./ThemeConsumer"

export {
  AppWithTheme_Basic,
  AppWithTheme_Dynamic,
  AppWithTheme_ContextBased,
  AppWithTheme_MultiSection,
} from "./ThemeSetupExamples"
