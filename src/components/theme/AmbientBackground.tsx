/**
 * Ambient Background Component
 * 
 * Creates the environmental glow effect that establishes the
 * material-driven atmosphere. This is a foundational layer
 * for the luxury theming system.
 */

import { useMaterialTheme } from "@/providers/ThemeProvider"
import type { CSSProperties } from "react"

export interface AmbientBackgroundProps {
  /**
   * CSS class for additional styling
   */
  className?: string

  /**
   * Optional override for accent color (defaults to theme.ambient)
   */
  accentOverride?: string

  /**
   * Intensity multiplier for the glow effect
   */
  intensity?: number

  style?: CSSProperties
}

/**
 * AmbientBackground Component
 * 
 * Renders a fixed atmospheric layer with theme-driven colors.
 * Typically used as a backdrop behind main content.
 * 
 * @example
 * ```tsx
 * <AmbientBackground />
 * ```
 */
export function AmbientBackground({
  className = "",
  accentOverride,
  intensity = 1,
  style,
}: AmbientBackgroundProps) {
  const theme = useMaterialTheme()

  const ambientColor = accentOverride || theme.ambient

  return (
    <div
      className={`
        fixed inset-0 pointer-events-none
        ${className}
      `}
      style={{
        background: `
          radial-gradient(
            ellipse 1200px 600px at 50% 0%,
            ${ambientColor},
            transparent 80%
          )
        `,
        opacity: intensity,
        willChange: "opacity",
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Animated Ambient Background
 * 
 * For motion-enabled interfaces, this version animates
 * subtle pulsing effects to create living atmosphere.
 */
export function AnimatedAmbientBackground(
  props: AmbientBackgroundProps
) {
  return (
    <AmbientBackground
      {...props}
      className={`
        ${props.className || ""}
        animate-pulse-subtle
      `}
      style={{
        ...props.style,
        animation: "ambient-pulse 6s ease-in-out infinite",
      }}
    />
  )
}

/**
 * CSS Keyframe for ambient pulse
 * Add to your global CSS:
 * 
 * @keyframes ambient-pulse {
 *   0%, 100% { opacity: 1; }
 *   50% { opacity: 0.8; }
 * }
 */
