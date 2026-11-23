/**
 * Material Theme Engine - Quick Reference Card
 * 
 * Copy & paste ready patterns for common use cases
 */

/*

╔════════════════════════════════════════════════════════════════════════════╗
║                     QUICK START - COPY & PASTE                            ║
╚════════════════════════════════════════════════════════════════════════════╝


1. SET UP YOUR APP
──────────────────

// App.tsx or main root component
import { ThemeProvider } from "@/providers/ThemeProvider"
import { ThemeVariables } from "@/components/theme"
import { AmbientBackground } from "@/components/theme"
import { resolveMaterialTheme } from "@/lib/theme"

export function App() {
  // Get material from watch data
  const watch = useWatchContext() // Your context/state
  const theme = useMemo(
    () => resolveMaterialTheme(watch?.material),
    [watch?.material]
  )

  return (
    <ThemeProvider theme={theme}>
      <ThemeVariables />
      <AmbientBackground />
      
      <main className="relative z-10">
        {/* Your routes/pages here */}
      </main>
    </ThemeProvider>
  )
}


2. USE THEME IN A COMPONENT (Hook Method)
───────────────────────────────────────────

import { useMaterialTheme } from "@/providers/ThemeProvider"

export function MyComponent() {
  const theme = useMaterialTheme()
  
  return (
    <div style={{
      backgroundColor: theme.surface,
      color: theme.textPrimary,
      borderColor: theme.border
    }}>
      Content
    </div>
  )
}


3. USE THEME IN A COMPONENT (CSS Variables)
─────────────────────────────────────────────

// Recommended approach - more flexible

export function MyComponent() {
  return (
    <div style={{
      backgroundColor: "var(--surface)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      boxShadow: "0 0 20px var(--glow)",
    }}>
      Content
    </div>
  )
}


4. USE THEME IN A COMPONENT (Tailwind)
────────────────────────────────────────

// First: Add to tailwind.config.ts (see TAILWIND_THEME_CONFIG.md)

<div className="
  bg-theme-surface 
  text-theme-text 
  border border-theme-border 
  shadow-theme-glow
  rounded-lg p-4
">
  Themed content
</div>


5. ANIMATED THEME TRANSITION
─────────────────────────────

import { motion } from "framer-motion"
import { useMaterialTheme } from "@/providers/ThemeProvider"

export function AnimatedComponent() {
  const theme = useMaterialTheme()

  return (
    <motion.div
      animate={{
        backgroundColor: theme.surface,
        color: theme.textPrimary,
        borderColor: theme.border,
      }}
      transition={{
        duration: 0.8,
        ease: "easeInOut",
      }}
    >
      Content
    </motion.div>
  )
}


6. EXTRACT THEME PROPERTIES
────────────────────────────

import { useMaterialTheme } from "@/providers/ThemeProvider"
import { getThemeAccentHex, isWarmTheme } from "@/lib/theme/themeUtils"

export function ThemedCard() {
  const theme = useMaterialTheme()
  
  const accentColor = getThemeAccentHex(theme)
  const isWarm = isWarmTheme(theme)
  
  return (
    <div>
      Accent: {accentColor}
      Warm theme: {isWarm ? "Yes" : "No"}
    </div>
  )
}


╔════════════════════════════════════════════════════════════════════════════╗
║                        AVAILABLE THEME PROPERTIES                         ║
╚════════════════════════════════════════════════════════════════════════════╝

theme.surface                    // Main background color
theme.surfaceElevated            // Elevated/card background
theme.textPrimary                // Main text color
theme.textSecondary              // Secondary text/labels
theme.accent                     // Primary accent color
theme.accentSoft                 // Soft/subtle accent
theme.border                     // Border color
theme.ambient                    // Main glow color
theme.ambientSecondary           // Secondary glow
theme.glow                       // Glow effect color
theme.gradient                   // Full CSS gradient string
theme.id                         // Theme ID: "gold", "titanium", "bronze"


╔════════════════════════════════════════════════════════════════════════════╗
║                        COMMON CSS VARIABLES                               ║
╚════════════════════════════════════════════════════════════════════════════╝

Injected automatically at :root level:

var(--surface)                   // Main background
var(--surface-elevated)          // Card backgrounds
var(--text-primary)              // Main text
var(--text-secondary)            // Secondary text
var(--accent)                    // Primary accent
var(--accent-soft)               // Soft accent
var(--border)                    // Border color
var(--ambient)                   // Main glow
var(--ambient-secondary)         // Secondary glow
var(--glow)                      // Glow effect
var(--gradient)                  // Full gradient


╔════════════════════════════════════════════════════════════════════════════╗
║                        THEME NAMES & COLORS                               ║
╚════════════════════════════════════════════════════════════════════════════╝

GOLD THEME
  ID: "gold"
  Accent: #C8A96B
  Materials: gold, yellow gold, rose gold, white gold
  Mood: Prestigious, luxurious

TITANIUM THEME (DEFAULT)
  ID: "titanium"
  Accent: #B8C1D1
  Materials: titanium, steel, stainless steel, platinum
  Mood: Modern, precise, technical

BRONZE THEME
  ID: "bronze"
  Accent: #A66840
  Materials: bronze, copper, vintage, brass
  Mood: Vintage, distinguished, heritage


╔════════════════════════════════════════════════════════════════════════════╗
║                          UTILITY FUNCTIONS                                ║
╚════════════════════════════════════════════════════════════════════════════╝

From @/lib/theme/themeUtils.ts:

parseRgba(rgba)                  // Extract RGBA components
hexToRgb(hex)                    // Convert hex to RGB
getColorBrightness(hex)          // Calculate brightness (0-255)
isLightColor(hex)                // Boolean: is color light?
getContrastColor(bgHex)          // Get white or black for contrast
meetsWCAGContrast(fg, bg)        // Check WCAG AA compliance
adjustThemeOpacity(theme, mult)  // Create variant with adjusted opacity
getThemeAccentHex(theme)         // Get accent color
isWarmTheme(theme)               // Boolean: is theme warm?
checkThemeTextAccessibility()    // Get accessibility report
getThemeMetadata(theme)          // Get theme analytics data


╔════════════════════════════════════════════════════════════════════════════╗
║                      TAILWIND UTILITY CLASSES                             ║
╚════════════════════════════════════════════════════════════════════════════╝

(After configuring tailwind.config.ts - see TAILWIND_THEME_CONFIG.md)

bg-theme-surface                 // Main background
bg-theme-surface-elevated        // Elevated background
text-theme                       // Primary text
text-theme-secondary             // Secondary text
text-theme-accent                // Accent text
border-theme                     // Border color
shadow-theme-glow                // Glow shadow
bg-gradient-to-r from-theme-accent  // Gradient


╔════════════════════════════════════════════════════════════════════════════╗
║                     COMMON MISTAKES TO AVOID                              ║
╚════════════════════════════════════════════════════════════════════════════╝

❌ Using hard-coded colors instead of theme values
  const color = "#FFFFFF" // ❌ Wrong
  const color = theme.textPrimary // ✓ Correct

❌ Forgetting to wrap app in ThemeProvider
  return <App /> // ❌ useMaterialTheme() will fail
  return (
    <ThemeProvider theme={theme}>
      <ThemeVariables />
      <App />
    </ThemeProvider>
  ) // ✓ Correct

❌ Using useMaterialTheme() outside ThemeProvider
  export function Isolated() {
    const theme = useMaterialTheme() // ❌ Will throw error
  }

❌ Not including ThemeVariables
  <ThemeProvider theme={theme}>
    <App /> // ❌ CSS variables not injected
  </ThemeProvider>

  <ThemeProvider theme={theme}>
    <ThemeVariables /> // ✓ Correct
    <App />
  </ThemeProvider>

❌ Recreating theme object unnecessarily
  const theme = resolveMaterialTheme(material) // ❌ Recreated on every render
  
  const theme = useMemo(
    () => resolveMaterialTheme(material),
    [material]
  ) // ✓ Correct

❌ Forgetting AmbientBackground for full effect
  <ThemeProvider theme={theme}>
    <ThemeVariables />
    {/* ❌ No atmospheric layer */}
  </ThemeProvider>

  <ThemeProvider theme={theme}>
    <ThemeVariables />
    <AmbientBackground /> {/* ✓ Complete setup */}
  </ThemeProvider>


╔════════════════════════════════════════════════════════════════════════════╗
║                     FILE IMPORT CHEAT SHEET                               ║
╚════════════════════════════════════════════════════════════════════════════╝

// Core theme utilities
import { 
  MaterialTheme,
  resolveMaterialTheme,
  goldTheme,
  titaniumTheme,
  bronzeTheme,
} from "@/lib/theme"

// React context
import { 
  ThemeProvider,
  useMaterialTheme,
  useMaterialThemeSafe,
} from "@/providers/ThemeProvider"

// Components
import {
  ThemeVariables,
  AmbientBackground,
  ThemedBox,
  ThemedButton,
  ThemedAccentText,
  GlowedElement,
} from "@/components/theme"

// Utilities
import {
  isWarmTheme,
  getThemeAccentHex,
  checkThemeTextAccessibility,
  getColorBrightness,
  meetsWCAGContrast,
} from "@/lib/theme/themeUtils"


*/

export default {}
