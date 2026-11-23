/**
 * Editorial Rail Implementation Guide
 * 
 * Complete guide for using the EditorialRail component system
 */

/*

════════════════════════════════════════════════════════════════════════════
OVERVIEW
════════════════════════════════════════════════════════════════════════════

EditorialRail is a cinematic horizontal scrolling component that displays
mixed-content editorial experiences. It integrates with the Material Theme Engine
to create context-aware, responsive interfaces.

Key Features:
✓ Mixed content types (watches, editorials, collections, stories, auctions, history)
✓ Adaptive sizing based on content type
✓ Cinematic hover states with theme animations
✓ Smooth horizontal momentum scrolling
✓ Editorial rhythm variation (spacing, indicators, transitions)
✓ Material theme integration
✓ Accessibility-first design
✓ Responsive on all breakpoints


════════════════════════════════════════════════════════════════════════════
COMPONENTS
════════════════════════════════════════════════════════════════════════════

1. EditorialCard
   ├─ Individual card for editorial content
   ├─ Adapts appearance based on content type
   ├─ Supports compact and spacious variants
   └─ Includes theme-aware animations

2. EditorialRail
   ├─ Horizontal scrolling container
   ├─ Displays section of editorial items
   ├─ Navigation controls and scroll indicator
   └─ Rhythm variation support

3. EditorialRailGroup
   ├─ Multiple EditorialRail sections
   ├─ Staggered animations between sections
   └─ Cohesive editorial flow


════════════════════════════════════════════════════════════════════════════
CONTENT TYPES
════════════════════════════════════════════════════════════════════════════

"watch"
  Properties: brand, material, year, price, availability, color
  Badge: "Watch"
  Metadata: material or brand
  Size: Standard (w-56)

"editorial" / "story"
  Properties: author, publishedAt, readTime, featured
  Badge: "Editorial" / "Story"
  Metadata: read time
  Size: Large in spacious (w-96)

"collection"
  Properties: itemCount, curator, theme
  Badge: "Collection"
  Metadata: item count
  Size: Large square in spacious (w-80 h-96)

"auction"
  Properties: currentBid, endTime, bidsCount
  Badge: "Auction"
  Metadata: bid count
  Size: Standard (w-56)

"history"
  Properties: date, period, significance
  Badge: "History"
  Metadata: date or period
  Size: Standard (w-56)

"recommendation"
  Properties: reason, matchScore
  Badge: "For You"
  Metadata: match percentage
  Size: Standard (w-56)


════════════════════════════════════════════════════════════════════════════
QUICK START
════════════════════════════════════════════════════════════════════════════

1. IMPORT COMPONENTS
────────────────────

import { EditorialRail } from "@/components/editorial"
import { EditorialContent, EditorialRailSection } from "@/types/editorial"


2. CREATE SECTION DATA
──────────────────────

const section: EditorialRailSection = {
  id: "featured-watches",
  title: "Featured Watches",
  description: "Discover our curated selection",
  layout: "compact",
  items: [
    {
      id: "watch-1",
      type: "watch",
      title: "Submariner Gold",
      brand: "Rolex",
      material: "18K Gold",
      year: 2024,
      price: 35000,
      imageUrl: "https://...",
    },
    // ... more items
  ],
}


3. USE IN COMPONENT
───────────────────

export function FeaturedPage() {
  const handleItemClick = (item: EditorialContent) => {
    console.log("Clicked:", item.title)
    // Navigate to detail page, etc.
  }

  return (
    <div>
      <EditorialRail
        section={section}
        onItemClick={handleItemClick}
        showControls={true}
        showScrollIndicator={true}
      />
    </div>
  )
}


════════════════════════════════════════════════════════════════════════════
ADVANCED USAGE
════════════════════════════════════════════════════════════════════════════

MULTIPLE SECTIONS WITH RHYTHM
──────────────────────────────

import { EditorialRailGroup } from "@/components/editorial"

const sections: EditorialRailSection[] = [
  {
    id: "featured",
    title: "Featured Watches",
    layout: "compact",
    items: [...],
  },
  {
    id: "editorials",
    title: "Latest Stories",
    layout: "spacious",
    items: [...],
  },
  {
    id: "collections",
    title: "Collections",
    layout: "spacious",
    items: [...],
  },
]

export function DiscoveryPage() {
  return (
    <EditorialRailGroup
      sections={sections}
      onItemClick={handleItemClick}
    />
  )
}


DYNAMIC CONTENT LOADING
───────────────────────

import { useEffect, useState } from "react"

export function DynamicEditorialRail() {
  const [items, setItems] = useState<EditorialContent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEditorialContent().then((content) => {
      setItems(content)
      setLoading(false)
    })
  }, [])

  const section: EditorialRailSection = {
    id: "dynamic",
    title: "Trending Now",
    items,
  }

  return (
    <div>
      {loading && <div>Loading...</div>}
      {!loading && <EditorialRail section={section} />}
    </div>
  )
}


RESPONSIVE VARIANTS
───────────────────

// Compact layout for mobile
const mobileSection: EditorialRailSection = {
  ...section,
  layout: "compact",
}

// Spacious layout for desktop
const desktopSection: EditorialRailSection = {
  ...section,
  layout: "spacious",
}

// Use hook to switch
function ResponsiveEditorialRail() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <EditorialRail
      section={isMobile ? mobileSection : desktopSection}
    />
  )
}


════════════════════════════════════════════════════════════════════════════
STYLING & THEMING
════════════════════════════════════════════════════════════════════════════

The EditorialRail system is fully integrated with the Material Theme Engine.
All colors, borders, and glows are automatically applied based on the current theme.

No additional styling required! The component adapts to:
- Theme accent colors
- Theme surface colors
- Theme ambient effects
- Theme gradients
- Theme glow effects

Example with different themes:
- Gold theme: Warm ambient, prestigious accent
- Titanium theme: Cool ambient, technical accent
- Bronze theme: Vintage ambient, heritage accent


════════════════════════════════════════════════════════════════════════════
SCROLL BEHAVIOR
════════════════════════════════════════════════════════════════════════════

NATIVE MOMENTUM SCROLLING
──────────────────────────
- Uses browser's native smooth scrolling
- Supports momentum/inertial scrolling on iOS/macOS
- Smooth animation on desktop

SCROLL CONTROLS
────────────────
- Left/Right navigation buttons appear when scrollable
- Buttons auto-hide at edges
- Click to scroll ~400px in direction

SCROLL INDICATOR
─────────────────
- Visual indicator of scroll position
- Appears below items by default
- Can be hidden with showScrollIndicator={false}

SCROLL GRADIENT OVERLAYS
─────────────────────────
- Gradient fade on left and right edges
- Prevents abrupt content cutoff
- Matches theme surface color


════════════════════════════════════════════════════════════════════════════
ANIMATIONS
════════════════════════════════════════════════════════════════════════════

CARD ENTRANCE
──────────────
- Staggered fade-in from bottom
- 0.6s duration with easing
- Delay multiplied by card index

CARD HOVER
──────────
- Lift effect (translateY -8px)
- Image zoom (scale 1.08)
- Overlay fade in
- Smooth 0.3-0.6s transitions

SECTION ENTRANCE
─────────────────
- Fade + slight slide up
- Triggers on viewport enter
- 0.6s duration

SCROLL CONTROLS
────────────────
- Scale up on hover
- Scale down on click
- Framer Motion spring physics


════════════════════════════════════════════════════════════════════════════
RESPONSIVE BEHAVIOR
════════════════════════════════════════════════════════════════════════════

Mobile (< 640px)
- w-56 cards (full width often)
- Compact layout by default
- Larger touch targets
- No scroll controls (touch scrolling)

Tablet (640px - 1024px)
- w-56 cards (often 2-3 visible)
- Mixed layout options
- Scroll controls appear if needed

Desktop (> 1024px)
- w-56 cards (4-5 visible)
- Spacious layout enabled
- Full scroll controls
- Scroll indicator visible


════════════════════════════════════════════════════════════════════════════
ACCESSIBILITY
════════════════════════════════════════════════════════════════════════════

✓ Semantic HTML structure
✓ Proper heading hierarchy
✓ Keyboard navigation support
✓ Focus indicators via theme
✓ Icon labeling with Lucide
✓ Color contrast checking via theme utils
✓ Alt text on images
✓ ARIA labels where needed


════════════════════════════════════════════════════════════════════════════
CUSTOM STYLING (ADVANCED)
════════════════════════════════════════════════════════════════════════════

To customize specific aspects while keeping theme integration:

// Override section spacing
<div className="space-y-20">
  <EditorialRail section={section1} />
  <EditorialRail section={section2} />
</div>

// Add custom transitions to entire section
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  transition={{ duration: 1 }}
>
  <EditorialRail section={section} />
</motion.div>

// Wrap EditorialCard with custom styling
// (Note: EditorialCard already uses theme, so rarely needed)


════════════════════════════════════════════════════════════════════════════
PERFORMANCE CONSIDERATIONS
════════════════════════════════════════════════════════════════════════════

✓ Image lazy loading (via browser IntersectionObserver)
✓ Staggered animations prevent jank
✓ Smooth scrolling uses GPU acceleration
✓ Theme values cached in context
✓ No unnecessary re-renders with Framer Motion

For large lists (100+ items):
- Consider virtualization (react-window)
- Load items on scroll
- Defer non-visible images


════════════════════════════════════════════════════════════════════════════
COMMON PATTERNS
════════════════════════════════════════════════════════════════════════════

FEATURED + GRID COMBO
──────────────────────

<div>
  <EditorialFeatureCard {...} />
  <EditorialRail section={section} />
</div>


MULTI-CONTENT DISCOVERY
───────────────────────

<EditorialRailGroup
  sections={[
    watchesSection,
    editorialsSection,
    collectionsSection,
    auctionsSection,
  ]}
/>


INFINITE SCROLL RAIL
────────────────────

// With pagination/lazy loading
const [page, setPage] = useState(1)
const [items, setItems] = useState<EditorialContent[]>([])

const handleNearEnd = async () => {
  const newItems = await fetchMore(page + 1)
  setItems([...items, ...newItems])
  setPage(page + 1)
}


════════════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
════════════════════════════════════════════════════════════════════════════

SCROLLBAR VISIBLE
──────────────────
Make sure .scrollbar-hide CSS class is defined:

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}


IMAGES NOT SHOWING
────────────────────
Check imageUrl property and CORS:
- Ensure URL is accessible
- Add to image proxy if needed
- Fallback SVG is generated automatically


SLOW ANIMATIONS
─────────────────
Check for:
- Too many cards visible (150+)
- Heavy images (optimize size)
- Slow device (consider reducing animations)
- Use React DevTools Profiler


════════════════════════════════════════════════════════════════════════════
BEST PRACTICES
════════════════════════════════════════════════════════════════════════════

✓ Use consistent image aspect ratios within a rail
✓ Group similar content types together
✓ Limit items per section to 20-30 for performance
✓ Use showScrollIndicator={true} for discovery
✓ Provide meaningful onItemClick handlers
✓ Test on mobile and tablet
✓ Use spacious layout for hero content
✓ Use compact layout for utility/reference content


════════════════════════════════════════════════════════════════════════════

*/

export default {}
