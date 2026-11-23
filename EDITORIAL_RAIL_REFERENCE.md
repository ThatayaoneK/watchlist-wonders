/**
 * Editorial Rail - Complete Reference
 * 
 * Full API documentation and usage reference for the Editorial Rail system
 */

/*

════════════════════════════════════════════════════════════════════════════
API REFERENCE
════════════════════════════════════════════════════════════════════════════


TYPES & INTERFACES
═══════════════════

EditorialContentType
  Union of content types:
  - "watch"
  - "editorial"
  - "story"
  - "collection"
  - "auction"
  - "history"
  - "recommendation"


EditorialItem (Base)
  interface EditorialItem {
    id: string
    type: EditorialContentType
    title: string
    description?: string
    imageUrl: string
    category?: string
    metadata?: Record<string, string | number>
  }


EditorialWatchItem
  extends EditorialItem {
    type: "watch"
    brand?: string
    material?: string
    year?: number
    price?: number
    availability?: string
    color?: string
  }


EditorialArticleItem
  extends EditorialItem {
    type: "editorial" | "story"
    author?: string
    publishedAt?: string
    readTime?: number
    featured?: boolean
  }


EditorialCollectionItem
  extends EditorialItem {
    type: "collection"
    itemCount?: number
    curator?: string
    theme?: string
  }


EditorialAuctionItem
  extends EditorialItem {
    type: "auction"
    currentBid?: number
    endTime?: string
    bidsCount?: number
  }


EditorialHistoryItem
  extends EditorialItem {
    type: "history"
    date?: string
    period?: string
    significance?: string
  }


EditorialRecommendationItem
  extends EditorialItem {
    type: "recommendation"
    reason?: string
    matchScore?: number
  }


EditorialRailSection
  interface EditorialRailSection {
    id: string                              // Unique section identifier
    title: string                           // Section heading
    description?: string                    // Optional subtitle
    items: EditorialContent[]               // Array of content items
    contentType?: "mixed" | "homogeneous"   // Content grouping (default: "mixed")
    layout?: "compact" | "spacious"         // Card size variant (default: "compact")
  }


════════════════════════════════════════════════════════════════════════════
COMPONENTS
════════════════════════════════════════════════════════════════════════════


EditorialCard
──────────────

Props:
  - item: EditorialContent (required)
    The content item to display

  - onClick?: () => void (optional)
    Callback when card is clicked

  - variant?: "compact" | "spacious" (optional, default: "compact")
    Card size variant

  - index?: number (optional)
    Index for stagger animation


Usage:
  <EditorialCard
    item={watchItem}
    onClick={() => navigate(`/watch/${watchItem.id}`)}
    variant="spacious"
    index={0}
  />


Styling:
  ✓ Theme-integrated colors
  ✓ Automatic dark mode
  ✓ Responsive sizing
  ✓ No additional CSS needed


EditorialRail
──────────────

Props:
  - section: EditorialRailSection (required)
    Section data including items and metadata

  - onItemClick?: (item: EditorialContent) => void (optional)
    Callback when any card is clicked

  - showControls?: boolean (optional, default: true)
    Show left/right scroll buttons

  - showScrollIndicator?: boolean (optional, default: true)
    Show scroll position indicator


Usage:
  <EditorialRail
    section={section}
    onItemClick={handleItemClick}
    showControls={true}
  />


Features:
  ✓ Horizontal smooth scrolling
  ✓ Momentum scrolling support
  ✓ Auto-hiding nav buttons
  ✓ Scroll progress indicator
  ✓ Theme integration
  ✓ Responsive behavior


EditorialRailGroup
────────────────────

Props:
  - sections: EditorialRailSection[] (required)
    Array of sections to display

  - onItemClick?: (item: EditorialContent) => void (optional)
    Global callback for item clicks


Usage:
  <EditorialRailGroup
    sections={discoverySections}
    onItemClick={handleSelection}
  />


Features:
  ✓ Displays multiple rails
  ✓ Staggered animations between sections
  ✓ Editorial rhythm variation
  ✓ Responsive spacing


════════════════════════════════════════════════════════════════════════════
LAYOUT & SIZING
════════════════════════════════════════════════════════════════════════════


Compact Layout (default)
  Base card width: 224px (w-56)
  Aspect ratio: 4:5 (like a standard photo)
  Visible per viewport:
    - Mobile: 1-2 cards
    - Tablet: 2-3 cards
    - Desktop: 4-5 cards

  Best for: Watches, auctions, history, recommendations


Spacious Layout
  Editorial/Story: 384px (w-96), aspect 16:10
  Collection: 320px (w-80), height 384px, square aspect
  
  Best for: Feature stories, collections, hero content


Mobile Behavior
  All cards: Full width or near-full with padding
  Touch-friendly: Larger tap targets
  Scroll: Native momentum scrolling


════════════════════════════════════════════════════════════════════════════
CONTENT TYPE BEHAVIOR
════════════════════════════════════════════════════════════════════════════


"watch"
  Badge: "Watch"
  Metadata: brand or material
  Icon: None (image-focused)
  Special handling: Price display if available
  Best variant: compact


"editorial" / "story"
  Badge: "Editorial" / "Story"
  Metadata: Read time (e.g., "8m read")
  Icon: Clock
  Special handling: Author info in description
  Best variant: spacious


"collection"
  Badge: "Collection"
  Metadata: Item count (e.g., "24 items")
  Icon: Users
  Special handling: Curator name
  Best variant: spacious


"auction"
  Badge: "Auction"
  Metadata: Number of bids
  Icon: TrendingUp
  Special handling: Current bid amount
  Best variant: compact


"history"
  Badge: "History"
  Metadata: Date or period
  Icon: Calendar
  Special handling: Historical significance
  Best variant: compact


"recommendation"
  Badge: "For You"
  Metadata: Match percentage
  Icon: Flame
  Special handling: Recommendation reason
  Best variant: compact


════════════════════════════════════════════════════════════════════════════
ANIMATIONS
════════════════════════════════════════════════════════════════════════════


Card Entrance
  Animation: Fade + slide up (opacity 0→1, y: 20→0)
  Duration: 600ms
  Easing: easeOut
  Trigger: Initial render / viewport intersection
  Stagger: 50ms per card index


Card Hover
  Image: Scale 1→1.08 (600ms)
  Position: No vertical lift yet but available
  Overlay: Fade in (300ms)
  Glow: Fade in (300ms)
  Easing: easeOut


Scroll Controls
  Hover: Scale 1→1.1 (via whileHover)
  Tap: Scale →0.95 (via whileTap)
  Physics: Spring (stiffness: 300, damping: 30)


Section Entrance
  Animation: Fade + stagger (delay × index × 100ms)
  Duration: 600ms
  Trigger: InView (margin: -100px)


════════════════════════════════════════════════════════════════════════════
SCROLL BEHAVIOR
════════════════════════════════════════════════════════════════════════════


Native Smooth Scrolling
  scroll-behavior: smooth
  Supports momentum on iOS/macOS
  Fallback: Instant on older browsers


Navigation Buttons
  Scroll amount: 400px per click
  Behavior: Smooth scroll animation
  Auto-hide: At container edges
  Click repeatable: Yes


Scroll Indicator
  Shows: Scroll position 0-100%
  Minimum width: 20% (always visible)
  Color: Theme accent
  Height: 4px
  Position: Below items


Gradient Overlays
  Left edge: Fade from surface to transparent
  Right edge: Fade from transparent to surface
  Width: 32px
  Purpose: Hide abrupt content edges
  Z-index: 10 (above content, below controls)


════════════════════════════════════════════════════════════════════════════
RESPONSIVE BREAKPOINTS
════════════════════════════════════════════════════════════════════════════


Mobile (< 640px)
  Gap between cards: 16px
  Padding: px-4 (16px)
  Card width: w-56 (224px)
  Controls: Usually off-screen, use touch scroll
  Indicator: Always visible
  Grid layout: Flex row


Tablet (640px - 1024px)
  Gap: 16px
  Padding: px-8 (32px) on sm:, or px-4 if sm: not reached
  Card width: w-56 (224px)
  Controls: Show/hide as needed
  Indicator: Show on important sections
  Grid: Flex row with 2-3 visible


Desktop (> 1024px)
  Gap: 16px
  Padding: px-14 (56px)
  Card width: w-56 (224px)
  Controls: Always visible if scrollable
  Indicator: Always visible
  Grid: Flex row with 4-5 visible


════════════════════════════════════════════════════════════════════════════
THEME INTEGRATION
════════════════════════════════════════════════════════════════════════════


Automatic Theme Application
  ✓ Border colors: theme.border
  ✓ Badge background: theme.ambient
  ✓ Text primary: theme.textPrimary
  ✓ Text secondary: theme.textSecondary
  ✓ Accent color: theme.accent
  ✓ Accent soft: theme.accentSoft
  ✓ Gradient overlay: theme.ambient + theme.surface
  ✓ Glow effect: theme.glow
  ✓ Control backgrounds: theme.ambient

No additional theming configuration needed!


════════════════════════════════════════════════════════════════════════════
PERFORMANCE OPTIMIZATION
════════════════════════════════════════════════════════════════════════════


Rendering
  ✓ Staggered animations prevent jank
  ✓ Framer Motion GPU acceleration
  ✓ Images: Lazy loaded via intersection observer
  ✓ Smooth scrolling uses GPU


Best Practices
  - Keep items per section < 30 (performance)
  - Optimize image sizes (< 200KB per image)
  - Use IntersectionObserver for lazy loading
  - Defer non-visible images
  - Test on mobile devices


For Large Lists
  Consider: react-window virtualization
  Alternative: Pagination + lazy load
  Monitor: React DevTools Profiler


════════════════════════════════════════════════════════════════════════════
ACCESSIBILITY
════════════════════════════════════════════════════════════════════════════


✓ Keyboard Navigation
  Tab: Navigate between cards
  Enter: Select current card
  Arrow keys: Scroll horizontally


✓ Screen Readers
  Semantic: <section>, <article>, <button>
  Labels: Alt text on images
  ARIA: aria-label on controls


✓ Visual
  Focus indicators: Themed colors
  Contrast: WCAG AA compliant
  Color: Not sole information method


✓ Motion
  prefers-reduced-motion support possible via theme
  No auto-play animations


════════════════════════════════════════════════════════════════════════════
COMMON GOTCHAS & SOLUTIONS
════════════════════════════════════════════════════════════════════════════


Scrollbar Visible
  Problem: Horizontal scrollbar appearing
  Solution: Add .scrollbar-hide CSS class
  CSS:
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar { display: none; }


Images Not Loading
  Problem: Image URLs return 404
  Solution: Fallback SVG generated, verify image URLs
  Debug: Check network tab, CORS headers


Slow Animations
  Problem: Jank or stuttering
  Causes: Too many cards (150+), unoptimized images
  Solution: Reduce visible cards, compress images


Layout Breaks on Small Screen
  Problem: Cards too large for mobile
  Solution: Use responsive padding/gap adjustments
  Check: Test on actual mobile device


Scroll Button Stuck
  Problem: Navigation buttons not disappearing
  Solution: Check if scrollWidth > clientWidth
  Debug: console.log({ scrollWidth, clientWidth })


════════════════════════════════════════════════════════════════════════════
INTEGRATION WITH OTHER SYSTEMS
════════════════════════════════════════════════════════════════════════════


Material Theme Engine
  Automatic: No setup needed
  Provider: EditorialRail reads from ThemeProvider
  Benefits: Consistent colors across app


Framer Motion
  Required: Already in use
  Version: ^10.0+ recommended
  Features: useRef, useEffect, motion.div


Lucide React Icons
  Imported: For metadata icons
  Icons used: Clock, TrendingUp, Calendar, Users, Flame, ChevronLeft, ChevronRight


React Context
  Used: ThemeProvider for theme access
  Pattern: useMaterialTheme() hook


════════════════════════════════════════════════════════════════════════════
EXAMPLES & PATTERNS
════════════════════════════════════════════════════════════════════════════

See EditorialRailExamples.tsx for:
  ✓ Basic watch collection
  ✓ Editorial stories
  ✓ Collections browsing
  ✓ Mixed content discovery
  ✓ Personalized recommendations
  ✓ Complete discovery interface


════════════════════════════════════════════════════════════════════════════

*/

export default {}
