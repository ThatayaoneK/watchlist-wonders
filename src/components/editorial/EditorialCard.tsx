/**
 * Editorial Card Component
 * 
 * Adaptive card that changes appearance based on content type.
 * Integrates with Material Theme Engine for dynamic colors and effects.
 */

import { motion } from "framer-motion"
import { useMaterialTheme } from "@/providers/ThemeProvider"
import { EditorialContent } from "@/types/editorial"
import {
  Clock,
  TrendingUp,
  Calendar,
  Users,
  Flame,
} from "lucide-react"

export interface EditorialCardProps {
  item: EditorialContent
  onClick?: () => void
  variant?: "compact" | "spacious"
  index?: number
}

/**
 * Get size classes based on content type and variant
 */
function getCardSize(type: EditorialContent["type"], variant: "compact" | "spacious") {
  const baseClass = "rounded-xl overflow-hidden border"

  if (variant === "spacious") {
    if (type === "story" || type === "editorial") {
      return `${baseClass} col-span-2 aspect-[16/10]`
    }
    if (type === "collection") {
      return `${baseClass} col-span-2 row-span-2 aspect-square`
    }
  }

  return `${baseClass} aspect-[4/5]`
}

/**
 * Get metadata icon based on content type
 */
function getMetadataIcon(type: EditorialContent["type"]) {
  switch (type) {
    case "watch":
      return null
    case "editorial":
    case "story":
      return <Clock size={14} />
    case "collection":
      return <Users size={14} />
    case "auction":
      return <TrendingUp size={14} />
    case "history":
      return <Calendar size={14} />
    case "recommendation":
      return <Flame size={14} />
    default:
      return null
  }
}

/**
 * Get metadata label based on content type
 */
function getMetadataLabel(item: EditorialContent): string | undefined {
  switch (item.type) {
    case "watch":
      return item.material || item.brand
    case "editorial":
    case "story":
      return item.readTime ? `${item.readTime}m read` : undefined
    case "collection":
      return item.itemCount ? `${item.itemCount} items` : undefined
    case "auction":
      return item.bidsCount ? `${item.bidsCount} bids` : undefined
    case "history":
      return item.date || item.period
    case "recommendation":
      return item.matchScore ? `${Math.round(item.matchScore * 100)}% match` : undefined
    default:
      return undefined
  }
}

/**
 * Get category badge text
 */
function getCategoryLabel(item: EditorialContent): string {
  switch (item.type) {
    case "watch":
      return "Watch"
    case "editorial":
      return "Editorial"
    case "story":
      return "Story"
    case "collection":
      return "Collection"
    case "auction":
      return "Auction"
    case "history":
      return "History"
    case "recommendation":
      return "For You"
    default:
      return (item as { category?: string }).category ?? "Item"
  }
}

/**
 * Editorial Card Component
 */
export function EditorialCard({
  item,
  onClick,
  variant = "compact",
  index = 0,
}: EditorialCardProps) {
  const theme = useMaterialTheme()

  const sizeClass = getCardSize(item.type, variant)
  const metadataIcon = getMetadataIcon(item.type)
  const metadataLabel = getMetadataLabel(item)
  const categoryLabel = getCategoryLabel(item)

  // Stagger animation based on index
  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.05,
        duration: 0.6,
        ease: "easeOut",
      },
    },
    hover: {
      y: -8,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  }

  const imageVariants = {
    initial: { scale: 1 },
    hover: {
      scale: 1.08,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  }

  const overlayVariants = {
    initial: { opacity: 0 },
    hover: {
      opacity: 1,
      transition: {
        duration: 0.3,
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      onClick={onClick}
      className={`${sizeClass} relative group cursor-pointer`}
      style={{
        borderColor: theme.border,
      }}
    >
      {/* Image container */}
      <motion.div
        variants={imageVariants}
        className="absolute inset-0"
      >
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect fill='${theme.surface.slice(1)}' width='400' height='500'/%3E%3C/svg%3E`
          }}
        />

        {/* Theme-aware gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                to top,
                ${theme.surface} 0%,
                transparent 40%
              ),
              linear-gradient(
                135deg,
                ${theme.ambient} 0%,
                transparent 60%
              )
            `,
          }}
        />
      </motion.div>

      {/* Category badge */}
      <motion.div
        variants={overlayVariants}
        className="absolute top-3 left-3 z-10"
        style={{
          color: theme.accentSoft,
        }}
      >
        <div
          className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md"
          style={{
            backgroundColor: `${theme.ambient}`,
            border: `1px solid ${theme.border}`,
          }}
        >
          {categoryLabel}
        </div>
      </motion.div>

      {/* Content overlay (bottom) */}
      <motion.div
        variants={overlayVariants}
        className="absolute inset-0 flex flex-col justify-end p-4 z-20"
      >
        {/* Title */}
        <h3
          className="text-sm font-semibold leading-tight mb-2 line-clamp-2"
          style={{ color: theme.textPrimary }}
        >
          {item.title}
        </h3>

        {/* Description (if available and space) */}
        {item.description && variant === "spacious" && (
          <p
            className="text-xs mb-3 line-clamp-2"
            style={{ color: theme.textSecondary }}
          >
            {item.description}
          </p>
        )}

        {/* Metadata footer */}
        {metadataLabel && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: theme.accentSoft }}
          >
            {metadataIcon && (
              <span className="opacity-70">{metadataIcon}</span>
            )}
            <span>{metadataLabel}</span>
          </div>
        )}

        {/* Price for watches/auctions */}
        {(item.type === "watch" || item.type === "auction") &&
          "price" in item &&
          item.price && (
            <div
              className="mt-2 text-xs font-semibold"
              style={{ color: theme.accent }}
            >
              ${item.price.toLocaleString()}
            </div>
          )}
      </motion.div>

      {/* Hover glow effect */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 z-0"
        style={{
          boxShadow: `inset 0 0 30px ${theme.glow}`,
          pointerEvents: "none",
        }}
      />
    </motion.div>
  )
}

/**
 * Editorial Card Grid variant
 * Used for adaptive layout in EditorialRail
 */
export function EditorialCardGrid({
  items,
  onClick,
  variant = "compact",
}: {
  items: EditorialContent[]
  onClick?: (item: EditorialContent) => void
  variant?: "compact" | "spacious"
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max">
      {items.map((item, index) => (
        <EditorialCard
          key={item.id}
          item={item}
          onClick={() => onClick?.(item)}
          variant={variant}
          index={index}
        />
      ))}
    </div>
  )
}
