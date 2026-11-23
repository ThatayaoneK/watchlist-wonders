/**
 * Editorial Rail - Integration Template
 * 
 * Copy this template to integrate EditorialRail into your pages
 */

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { EditorialRail, EditorialRailGroup } from "@/components/editorial"
import { EditorialContent, EditorialRailSection } from "@/types/editorial"
import { useMaterialTheme } from "@/providers/ThemeProvider"

/**
 * TEMPLATE 1: Single Discovery Page
 */
export function DiscoveryPage() {
  const theme = useMaterialTheme()
  const [selectedItem, setSelectedItem] = useState<EditorialContent | null>(null)

  // Mock data - replace with real data fetching
  const sections: EditorialRailSection[] = [
    {
      id: "featured-watches",
      title: "Featured Watches",
      description: "Handpicked for this season",
      layout: "compact",
      items: [
        {
          id: "1",
          type: "watch",
          title: "Rolex Submariner",
          brand: "Rolex",
          material: "Gold",
          price: 35000,
          imageUrl: "https://...",
        },
        // ... more items
      ],
    },
    {
      id: "latest-stories",
      title: "Latest Stories",
      description: "Expert insights from the community",
      layout: "spacious",
      items: [
        {
          id: "s1",
          type: "editorial",
          title: "The Art of Watch Collecting",
          author: "Sarah Chen",
          readTime: 12,
          imageUrl: "https://...",
        },
        // ... more items
      ],
    },
  ]

  const handleItemClick = (item: EditorialContent) => {
    setSelectedItem(item)
    console.log("Selected:", item)
    // Navigate to detail page
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.surface }}>
      {/* Header */}
      <div className="px-4 md:px-8 lg:px-14 py-12 md:py-20">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bold mb-4"
          style={{ color: theme.textPrimary }}
        >
          Discover
        </motion.h1>
        <p
          className="text-lg"
          style={{ color: theme.textSecondary }}
        >
          Explore watches, stories, and collections
        </p>
      </div>

      {/* Editorial Rails */}
      <EditorialRailGroup
        sections={sections}
        onItemClick={handleItemClick}
      />

      {/* Detail Modal or sidebar could go here */}
      {selectedItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="p-8 rounded-lg max-w-md"
            style={{ backgroundColor: theme.surfaceElevated }}
          >
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: theme.accent }}
            >
              {selectedItem.title}
            </h2>
            <button
              onClick={() => setSelectedItem(null)}
              className="mt-4 px-4 py-2 rounded"
              style={{ backgroundColor: theme.accent, color: theme.surface }}
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

/**
 * TEMPLATE 2: Dashboard with Multiple Rail Sections
 */
export function DashboardWithRails() {
  const theme = useMaterialTheme()

  const sections: EditorialRailSection[] = [
    {
      id: "recommendations",
      title: "Recommended For You",
      description: "Based on your viewing history",
      layout: "compact",
      items: [], // Fetch from API
    },
    {
      id: "trending",
      title: "Trending",
      description: "What's hot right now",
      layout: "compact",
      items: [],
    },
    {
      id: "new-collections",
      title: "New Collections",
      description: "Latest curations from our team",
      layout: "spacious",
      items: [],
    },
  ]

  return (
    <div style={{ backgroundColor: theme.surface }}>
      <div className="px-4 md:px-8 lg:px-14 py-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: theme.textPrimary }}
        >
          Dashboard
        </h1>
      </div>

      <EditorialRailGroup sections={sections} />
    </div>
  )
}

/**
 * TEMPLATE 3: Category Page with Dynamic Content
 */
export function CategoryPage({ category }: { category: string }) {
  const [items, setItems] = useState<EditorialContent[]>([])
  const [loading, setLoading] = useState(true)
  const theme = useMaterialTheme()

  // Fetch category content
  useMemo(() => {
    setLoading(true)
    // Replace with actual API call
    setTimeout(() => {
      setItems([
        {
          id: "1",
          type: "watch",
          title: "Watch 1",
          imageUrl: "https://...",
        },
        // ... fetch based on category
      ] as EditorialContent[])
      setLoading(false)
    }, 500)
  }, [category])

  const section: EditorialRailSection = {
    id: category,
    title: category.charAt(0).toUpperCase() + category.slice(1),
    items,
  }

  return (
    <div style={{ backgroundColor: theme.surface }}>
      {loading ? (
        <div className="p-8 text-center" style={{ color: theme.textSecondary }}>
          Loading...
        </div>
      ) : (
        <EditorialRail section={section} />
      )}
    </div>
  )
}

/**
 * TEMPLATE 4: With Search and Filtering
 */
export function DiscoveryWithFilters() {
  const theme = useMaterialTheme()
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [sections] = useState<EditorialRailSection[]>([])

  // Update sections based on filter
  useMemo(() => {
    // Fetch filtered content
    console.log("Filtering by:", selectedFilter)
    // Update sections
  }, [selectedFilter])

  return (
    <div style={{ backgroundColor: theme.surface }}>
      {/* Filter bar */}
      <div className="sticky top-0 z-40 border-b px-4 md:px-8 lg:px-14 py-4"
        style={{ borderColor: theme.border }}>
        <div className="flex gap-2 overflow-x-auto">
          {["All", "Watches", "Stories", "Collections"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className="px-4 py-2 rounded-full whitespace-nowrap transition-colors"
              style={{
                backgroundColor:
                  selectedFilter === filter ? theme.accent : theme.ambientSecondary,
                color:
                  selectedFilter === filter
                    ? theme.surface
                    : theme.textSecondary,
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Editorial Rails */}
      {sections.length > 0 && (
        <EditorialRailGroup sections={sections} />
      )}
    </div>
  )
}

/**
 * TEMPLATE 5: Infinite Scroll with Pagination
 */
export function InfiniteScrollRail() {
  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<EditorialContent[]>([])
  const [loading, setLoading] = useState(false)
  const theme = useMaterialTheme()

  const loadMore = async () => {
    setLoading(true)
    // Fetch next page
    const newItems: EditorialContent[] = [] // await fetchPage(page)
    setAllItems([...allItems, ...newItems])
    setPage(page + 1)
    setLoading(false)
  }

  const section: EditorialRailSection = {
    id: "infinite",
    title: "Browse All",
    items: allItems,
  }

  return (
    <div style={{ backgroundColor: theme.surface }}>
      <EditorialRail section={section} />

      {/* Load more button */}
      <div className="text-center py-8">
        <button
          onClick={loadMore}
          disabled={loading}
          className="px-8 py-3 rounded-lg font-medium transition-opacity disabled:opacity-50"
          style={{
            backgroundColor: theme.accent,
            color: theme.surface,
          }}
        >
          {loading ? "Loading..." : "Load More"}
        </button>
      </div>
    </div>
  )
}

/**
 * TEMPLATE 6: Hero + Rail Combo
 */
export function HeroWithRail() {
  const theme = useMaterialTheme()

  const section: EditorialRailSection = {
    id: "featured",
    title: "Featured",
    items: [],
  }

  return (
    <div style={{ backgroundColor: theme.surface }}>
      {/* Hero Section */}
      <div
        className="relative h-96 overflow-hidden rounded-2xl mx-4 md:mx-8 lg:mx-14 mt-8 mb-16"
        style={{
          background: theme.gradient,
          border: `1px solid ${theme.border}`,
        }}
      >
        <img
          src="https://..."
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />

        <div className="relative z-10 h-full flex flex-col justify-center p-8">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: theme.textPrimary }}
          >
            Discover Premium Watches
          </h1>
          <p
            className="text-lg max-w-lg"
            style={{ color: theme.textSecondary }}
          >
            Explore our curated collection of luxury timepieces
          </p>
        </div>
      </div>

      {/* Editorial Rail Below Hero */}
      <EditorialRail section={section} />
    </div>
  )
}

/**
 * EXPORT ALL TEMPLATES
 */
export const DiscoveryTemplates = {
  DiscoveryPage,
  DashboardWithRails,
  CategoryPage,
  DiscoveryWithFilters,
  InfiniteScrollRail,
  HeroWithRail,
}
