/**
 * Theme Provider
 * 
 * React Context provider for distributing MaterialTheme throughout the app.
 * Enables components to access theme values without prop drilling.
 */

import { createContext, useContext } from "react"

import { MaterialTheme } from "@/lib/theme/materialThemeEngine"

/**
 * Theme context
 * Private - use useMaterialTheme hook to access
 */
const ThemeContext = createContext<MaterialTheme | null>(null)

/**
 * Theme Provider Props
 */
export interface ThemeProviderProps {
  theme: MaterialTheme
  children: React.ReactNode
}

/**
 * ThemeProvider Component
 * 
 * Wraps your app or specific sections to provide theme context.
 * 
 * @example
 * ```tsx
 * <ThemeProvider theme={goldTheme}>
 *   <ThemeVariables />
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * useMaterialTheme Hook
 * 
 * Access the current material theme in any component.
 * Must be used within a ThemeProvider.
 * 
 * @returns Current MaterialTheme
 * @throws Error if used outside ThemeProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const theme = useMaterialTheme()
 *   return <div style={{ color: theme.accent }}>Themed content</div>
 * }
 * ```
 */
export function useMaterialTheme(): MaterialTheme {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error(
      "useMaterialTheme must be used within a ThemeProvider. " +
      "Wrap your component tree with <ThemeProvider theme={theme}>"
    )
  }

  return context
}

/**
 * Optional: Safe version that returns null if outside provider
 * Useful for components that might be used in different contexts
 */
export function useMaterialThemeSafe(): MaterialTheme | null {
  return useContext(ThemeContext)
}
