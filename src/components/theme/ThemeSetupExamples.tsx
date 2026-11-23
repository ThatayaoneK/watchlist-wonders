/**
 * Theme Setup Example Component
 * 
 * This is a complete example of how to integrate the Material Theme Engine
 * into your app. Use this as a reference for your actual App.tsx or root component.
 */

import { useMemo } from "react"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { ThemeVariables } from "@/components/theme/ThemeVariables"
import { AmbientBackground } from "@/components/theme/AmbientBackground"
import { resolveMaterialTheme } from "@/lib/theme"

/**
 * EXAMPLE 1: Basic Setup
 * Simple theme provider wrapping your app
 */
export function AppWithTheme_Basic() {
  // Assume you have watch data available
  const watchMaterial = "titanium" // or from watch?.material

  const theme = resolveMaterialTheme(watchMaterial)

  return (
    <ThemeProvider theme={theme}>
      <ThemeVariables />
      <AmbientBackground />

      <main className="relative z-10">
        {/* Your app content goes here */}
      </main>
    </ThemeProvider>
  )
}

/**
 * EXAMPLE 2: Dynamic Theme Switching
 * Theme updates based on selected watch
 */
interface Watch {
  id: string
  material?: string
  name: string
}

interface AppWithDynamicThemeProps {
  watches: Watch[]
  selectedWatchId: string
  onWatchSelect: (watchId: string) => void
}

export function AppWithTheme_Dynamic({
  watches,
  selectedWatchId,
  onWatchSelect,
}: AppWithDynamicThemeProps) {
  const selectedWatch = watches.find((w) => w.id === selectedWatchId)
  const theme = useMemo(
    () => resolveMaterialTheme(selectedWatch?.material),
    [selectedWatch?.material]
  )

  return (
    <ThemeProvider theme={theme}>
      <ThemeVariables />
      <AmbientBackground />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header with watch selector */}
        <header className="border-b border-[var(--border)] p-4">
          <select
            value={selectedWatchId}
            onChange={(e) => onWatchSelect(e.target.value)}
          >
            {watches.map((watch) => (
              <option key={watch.id} value={watch.id}>
                {watch.name} ({watch.material})
              </option>
            ))}
          </select>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Your app content */}
        </main>
      </div>
    </ThemeProvider>
  )
}

/**
 * EXAMPLE 3: With Context (Accessing watch data from context/state)
 * More realistic setup for a real app
 */
export function AppWithTheme_ContextBased() {
  // In a real app, you'd get this from your state/context
  // const { selectedWatch } = useWatchContext()
  const selectedWatch = { material: "gold" }

  const theme = useMemo(
    () => resolveMaterialTheme(selectedWatch?.material),
    [selectedWatch?.material]
  )

  return (
    <ThemeProvider theme={theme}>
      <ThemeVariables />
      <AmbientBackground intensity={0.8} />

      <div className="relative z-10">
        {/* Rest of your app */}
      </div>
    </ThemeProvider>
  )
}

/**
 * EXAMPLE 4: Multiple Sections with Different Themes
 * For dashboard-style layouts with multiple themed sections
 */
export function AppWithTheme_MultiSection() {
  const watches = [
    { id: "1", material: "gold", name: "Gold Watch" },
    { id: "2", material: "titanium", name: "Steel Watch" },
  ]

  return (
    <div>
      {watches.map((watch) => {
        const theme = resolveMaterialTheme(watch.material)

        return (
          <ThemeProvider key={watch.id} theme={theme}>
            <ThemeVariables />

            <section className="p-8 border-b border-[var(--border)]">
              <h2 style={{ color: "var(--accent)" }}>{watch.name}</h2>
              {/* Content for this watch's section */}
            </section>
          </ThemeProvider>
        )
      })}
    </div>
  )
}

/**
 * RECOMMENDED: Use this structure in your actual App.tsx
 * 
 * function App() {
 *   const { selectedWatch } = useWatchContext()
 *   
 *   const theme = useMemo(
 *     () => resolveMaterialTheme(selectedWatch?.material),
 *     [selectedWatch?.material]
 *   )
 * 
 *   return (
 *     <ThemeProvider theme={theme}>
 *       <ThemeVariables />
 *       <AmbientBackground />
 *       
 *       <RouterOrPageContent />
 *     </ThemeProvider>
 *   )
 * }
 */
