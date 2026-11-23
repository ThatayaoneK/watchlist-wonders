/**
 * Editorial Rail Component
 * 
 * Horizontal scrolling cinematic browsing experience with:
 * - Mixed-content cards (watches, editorials, collections, stories, auctions, history)
 * - Adaptive sizing based on content type
 * - Cinematic hover states with theme animations
 * - Horizontal momentum scrolling
 * - Editorial rhythm variation inspired by AnimeX
 */

import { useRef, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useMaterialTheme } from "@/providers/ThemeProvider"
import { EditorialCard } from "./EditorialCard"
import { EditorialContent, EditorialRailSection } from "@/types/editorial"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface EditorialRailProps {
  section: EditorialRailSection
  onItemClick?: (item: EditorialContent) => void
  showControls?: boolean
  showScrollIndicator?: boolean
}

/**
 * Scroll button component
 */
function ScrollButton({
  direction,
  onClick,
  theme,
}: {
  direction: "left" | "right"
  onClick: () => void
  theme: ReturnType<typeof useMaterialTheme>
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2 z-20 p-2 rounded-full backdrop-blur-xl transition-all duration-300"
      style={{
        backgroundColor: theme.ambient,
        border: `1px solid ${theme.border}`,
        [direction === "left" ? "left" : "right"]: "1rem",
      }}
    >
      <Icon
        size={20}
        style={{ color: theme.accent }}
      />
    </motion.button>
  )
}

/**
 * Scroll indicator component
 */
function ScrollIndicator({
  scrollProgress,
  theme,
}: {
  scrollProgress: number
  theme: ReturnType<typeof useMaterialTheme>
}) {
  return (
    <div
      className="h-1 bg-opacity-20 transition-all duration-300"
      style={{
        backgroundColor: theme.ambientSecondary,
      }}
    >
      <motion.div
        className="h-full"
        style={{
          backgroundColor: theme.accent,
          width: `${Math.max(20, scrollProgress * 100)}%`,
        }}
        initial={{ width: "20%" }}
        animate={{ width: `${Math.max(20, scrollProgress * 100)}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </div>
  )
}

/**
 * Editorial Rail Component
 * 
 * @example
 * ```tsx
 * <EditorialRail
 *   section={{
 *     id: "featured",
 *     title: "Featured Watches",
 *     items: [...],
 *   }}
 *   onItemClick={handleItemClick}
 * />
 * ```
 */
export function EditorialRail({
  section,
  onItemClick,
  showControls = true,
  showScrollIndicator = true,
}: EditorialRailProps) {
  const theme = useMaterialTheme()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  // Update scroll state
  const updateScrollState = () => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScroll = scrollWidth - clientWidth

    setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0)
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < maxScroll - 10)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Initial check
    updateScrollState()

    // Listen to scroll events
    container.addEventListener("scroll", updateScrollState)

    // Listen to resize
    window.addEventListener("resize", updateScrollState)

    return () => {
      container.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [])

  // Smooth scroll with momentum
  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = 400
    const targetScroll =
      container.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount)

    container.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    })
  }

  const layout = section.layout || "compact"

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      viewport={{ once: true, margin: "-100px" }}
      className="w-full"
    >
      {/* Header */}
      <div className="px-4 md:px-8 lg:px-14 mb-6">
        <h2
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: theme.textPrimary }}
        >
          {section.title}
        </h2>
        {section.description && (
          <p
            className="text-sm"
            style={{ color: theme.textSecondary }}
          >
            {section.description}
          </p>
        )}
      </div>

      {/* Scroll container wrapper */}
      <div className="relative">
        {/* Left scroll button */}
        {showControls && canScrollLeft && (
          <ScrollButton
            direction="left"
            onClick={() => scroll("left")}
            theme={theme}
          />
        )}

        {/* Right scroll button */}
        {showControls && canScrollRight && (
          <ScrollButton
            direction="right"
            onClick={() => scroll("right")}
            theme={theme}
          />
        )}

        {/* Scroll container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-14"
          style={{
            scrollBehavior: "smooth",
            scrollPaddingRight: "2rem",
          }}
        >
          {/* Content grid */}
          <div
            className={`
              flex gap-4
              pb-4
              min-w-min
            `}
          >
            {section.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
                viewport={{ once: true }}
                className={`
                  flex-shrink-0
                  ${getItemWidth(item.type, layout)}
                `}
              >
                <EditorialCard
                  item={item}
                  onClick={() => onItemClick?.(item)}
                  variant={layout}
                  index={index}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Scroll gradient overlays */}
        <div
          className="absolute top-0 left-0 bottom-0 w-8 pointer-events-none z-10"
          style={{
            background: `linear-gradient(
              to right,
              ${theme.surface},
              transparent
            )`,
          }}
        />

        <div
          className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none z-10"
          style={{
            background: `linear-gradient(
              to left,
              ${theme.surface},
              transparent
            )`,
          }}
        />
      </div>

      {/* Scroll indicator */}
      {showScrollIndicator && (
        <div className="mt-4 px-4 md:px-8 lg:px-14">
          <ScrollIndicator
            scrollProgress={scrollProgress}
            theme={theme}
          />
        </div>
      )}
    </motion.section>
  )
}

/**
 * Get card width based on content type and layout
 */
function getItemWidth(
  type: EditorialContent["type"],
  layout: "compact" | "spacious"
): string {
  if (layout === "spacious") {
    if (type === "story" || type === "editorial") {
      return "w-96"
    }
    if (type === "collection") {
      return "w-80 h-96"
    }
  }

  return "w-56"
}

/**
 * Editorial Rail Section Group
 * Display multiple rail sections with rhythm variation
 */
export function EditorialRailGroup({
  sections,
  onItemClick,
}: {
  sections: EditorialRailSection[]
  onItemClick?: (item: EditorialContent) => void
}) {
  return (
    <div className="space-y-12 md:space-y-16">
      {sections.map((section, index) => (
        <motion.div
          key={section.id}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{
            duration: 0.6,
            delay: index * 0.1,
          }}
          viewport={{ once: true }}
        >
          <EditorialRail
            section={section}
            onItemClick={onItemClick}
            showControls={true}
            showScrollIndicator={index % 2 === 0}
          />
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Hide scrollbar CSS (add to your global CSS or Tailwind config)
 * 
 * .scrollbar-hide {
 *   -ms-overflow-style: none;
 *   scrollbar-width: none;
 * }
 * 
 * .scrollbar-hide::-webkit-scrollbar {
 *   display: none;
 * }
 */
