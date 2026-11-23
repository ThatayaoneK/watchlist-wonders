/**
 * Tailwind CSS Configuration Integration
 * 
 * Add this to your tailwind.config.ts to enable theme-aware Tailwind classes
 * 
 * This allows you to use utility classes like:
 * - bg-theme-surface
 * - text-theme-accent
 * - border-theme-border
 * - shadow-theme-glow
 * 
 * Instead of hard-coded colors
 */

// In your tailwind.config.ts or tailwind.config.js:

export const tailwindThemeConfig = {
  theme: {
    extend: {
      colors: {
        // Theme surface colors
        "theme-surface": "var(--surface)",
        "theme-surface-elevated": "var(--surface-elevated)",

        // Theme text colors
        "theme-text": "var(--text-primary)",
        "theme-text-secondary": "var(--text-secondary)",

        // Theme accent colors
        "theme-accent": "var(--accent)",
        "theme-accent-soft": "var(--accent-soft)",

        // Theme atmosphere
        "theme-ambient": "var(--ambient)",
        "theme-ambient-secondary": "var(--ambient-secondary)",

        // Theme borders
        "theme-border": "var(--border)",
      },

      backgroundColor: {
        theme: "var(--surface)",
        "theme-elevated": "var(--surface-elevated)",
      },

      textColor: {
        theme: "var(--text-primary)",
        "theme-secondary": "var(--text-secondary)",
        "theme-accent": "var(--accent)",
      },

      borderColor: {
        theme: "var(--border)",
      },

      boxShadow: {
        "theme-glow": "0 0 20px var(--glow)",
        "theme-glow-lg": "0 0 40px var(--glow)",
        "theme-glow-md": "0 0 12px var(--glow)",
      },

      backgroundImage: {
        "theme-gradient": "var(--gradient)",
      },
    },
  },
}

/*
USAGE EXAMPLES:

<div className="bg-theme-surface text-theme-text border border-theme-border">
  Surface with themed border
</div>

<button className="bg-theme-accent text-theme-surface hover:opacity-80">
  Themed button
</button>

<div className="bg-theme-elevated shadow-theme-glow rounded-lg p-4">
  Glowing card
</div>

<h1 className="text-theme-accent font-bold text-2xl">
  Accent heading
</h1>

<p className="text-theme-secondary">
  Secondary text
</p>

<div className="bg-gradient-to-r from-theme-accent to-transparent">
  Gradient background
</div>

RESPONSIVE USAGE:

<div className="md:bg-theme-surface-elevated sm:bg-theme-surface">
  Different background on different screen sizes
</div>

DARK MODE (if using dark mode strategy):

<div className="dark:bg-theme-surface dark:text-theme-text">
  Dark mode aware
</div>

*/

export default {}
