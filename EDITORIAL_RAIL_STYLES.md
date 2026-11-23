/**
 * Editorial Rail CSS Utilities
 * 
 * Add these styles to your global CSS or Tailwind configuration
 */

/*
════════════════════════════════════════════════════════════════════════════
SCROLLBAR HIDING
════════════════════════════════════════════════════════════════════════════

Hide scrollbars while maintaining scroll functionality.
Applied to the scroll container in EditorialRail.
*/

.scrollbar-hide {
  /* Firefox */
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  /* Chrome, Safari, Edge */
  display: none;
}


/*
════════════════════════════════════════════════════════════════════════════
SMOOTH SCROLLING
════════════════════════════════════════════════════════════════════════════

Already applied inline, but can be set globally:
*/

html {
  scroll-behavior: smooth;
}


/*
════════════════════════════════════════════════════════════════════════════
AMBIENT PULSE ANIMATION
════════════════════════════════════════════════════════════════════════════

For animated ambient backgrounds (optional):
*/

@keyframes ambient-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-pulse-subtle {
  animation: ambient-pulse 6s ease-in-out infinite;
}


/*
════════════════════════════════════════════════════════════════════════════
TAILWIND CONFIGURATION
════════════════════════════════════════════════════════════════════════════

Add to your tailwind.config.ts or tailwind.config.js:

const config = {
  theme: {
    extend: {
      // Optional: if using these classes
      animation: {
        'pulse-subtle': 'ambient-pulse 6s ease-in-out infinite',
      },
    },
  },
}

export default config


════════════════════════════════════════════════════════════════════════════
GLOBAL CSS IMPORT
════════════════════════════════════════════════════════════════════════════

Add to your main.tsx or App.tsx:

import './styles/editorial.css'

Or include directly in your index.css:

@import './editorial.css';


════════════════════════════════════════════════════════════════════════════
INTEGRATION CHECKLIST
════════════════════════════════════════════════════════════════════════════

□ Add .scrollbar-hide CSS to global styles
□ Import EditorialRail, EditorialCard components
□ Import EditorialRailSection type
□ Wrap app with ThemeProvider
□ Include ThemeVariables component
□ Create section data with EditorialContent items
□ Add onItemClick handler
□ Test on mobile, tablet, desktop
□ Verify smooth scrolling
□ Check theme colors apply correctly


════════════════════════════════════════════════════════════════════════════
OPTIONAL: CUSTOMIZATIONS
════════════════════════════════════════════════════════════════════════════

Custom scroll progress bar height:
---

<div className="h-2 bg-opacity-20 transition-all duration-300">
  {/* Increases from h-1 to h-2 */}
</div>


Custom card gap:
---

Modify the gap-4 in EditorialRail (currently 16px)
To increase: gap-6 (24px), gap-8 (32px)
To decrease: gap-3 (12px), gap-2 (8px)


Custom section spacing:
---

Use CSS:
  .editorial-section { margin-bottom: 4rem; }

Or Tailwind:
  <div className="space-y-16">
    <EditorialRail ... />
    <EditorialRail ... />
  </div>


════════════════════════════════════════════════════════════════════════════

*/

export default {}
