/**
 * Theme Consumer Components
 * 
 * Example and utility components that demonstrate
 * how to consume MaterialTheme throughout the app.
 */

import { useMaterialTheme } from "@/providers/ThemeProvider"

/**
 * ThemedBox Component
 * 
 * A simple example showing how to apply theme colors to a component.
 * Demonstrates both direct style application and CSS variable usage.
 */
export function ThemedBox({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const theme = useMaterialTheme()

  return (
    <div
      className={`
        rounded-lg border
        transition-colors duration-300
        ${className}
      `}
      style={{
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        color: theme.textPrimary,
      }}
    >
      {children}
    </div>
  )
}

/**
 * ThemedButton Component
 * 
 * Interactive element that responds to theme context
 */
export function ThemedButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const theme = useMaterialTheme()

  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-md font-medium
        transition-all duration-200
        hover:opacity-80
        active:opacity-70
        ${className}
      `}
      style={{
        backgroundColor: theme.accent,
        color: theme.surface,
      }}
    >
      {children}
    </button>
  )
}

/**
 * ThemedAccentText Component
 * 
 * Text with theme-aware accent color
 */
export function ThemedAccentText({
  children,
  soft = false,
  className = "",
}: {
  children: React.ReactNode
  soft?: boolean
  className?: string
}) {
  const theme = useMaterialTheme()

  return (
    <span
      className={className}
      style={{
        color: soft ? theme.accentSoft : theme.accent,
      }}
    >
      {children}
    </span>
  )
}

/**
 * GlowedElement Component
 * 
 * Wraps content with a themed glow effect
 */
export function GlowedElement({
  children,
  intensity = 1,
  className = "",
}: {
  children: React.ReactNode
  intensity?: number
  className?: string
}) {
  const theme = useMaterialTheme()

  return (
    <div
      className={className}
      style={{
        boxShadow: `0 0 20px ${theme.glow}`,
        opacity: intensity,
      }}
    >
      {children}
    </div>
  )
}

/**
 * ThemedGradient Component
 * 
 * Applies the theme gradient to an element
 */
export function ThemedGradient({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const theme = useMaterialTheme()

  return (
    <div
      className={className}
      style={{
        background: theme.gradient,
      }}
    >
      {children}
    </div>
  )
}
