/**
 * Editorial Rail Examples & Demo
 * 
 * Complete working examples of EditorialRail implementations
 */

import { EditorialRail, EditorialRailGroup } from "@/components/editorial"
import {
  EditorialContent,
  EditorialRailSection,
  EditorialWatchItem,
  EditorialArticleItem,
  EditorialCollectionItem,
  EditorialAuctionItem,
  EditorialHistoryItem,
} from "@/types/editorial"

/**
 * EXAMPLE 1: Watch Collection Rail
 */
export function WatchCollectionRailExample() {
  const watchItems: EditorialWatchItem[] = [
    {
      id: "rolex-1",
      type: "watch",
      title: "Submariner Hulk",
      brand: "Rolex",
      material: "Stainless Steel",
      year: 2022,
      price: 18500,
      availability: "In Stock",
      color: "Green",
      imageUrl: "https://example.com/watch-1.jpg",
      description: "Iconic dive watch with green dial",
    },
    {
      id: "omega-1",
      type: "watch",
      title: "Seamaster Planet Ocean",
      brand: "Omega",
      material: "18K Gold",
      year: 2023,
      price: 28000,
      availability: "Pre-order",
      color: "Blue",
      imageUrl: "https://example.com/watch-2.jpg",
      description: "Professional grade diving chronometer",
    },
    {
      id: "patek-1",
      type: "watch",
      title: "Nautilus",
      brand: "Patek Philippe",
      material: "Rose Gold",
      year: 2024,
      price: 65000,
      availability: "Rare",
      color: "Silver",
      imageUrl: "https://example.com/watch-3.jpg",
      description: "Legendary design, timeless elegance",
    },
  ]

  const section: EditorialRailSection = {
    id: "featured-watches",
    title: "Featured Watches",
    description: "Curated selection of luxury timepieces",
    layout: "compact",
    items: watchItems,
  }

  return (
    <EditorialRail
      section={section}
      onItemClick={(item) => {
        console.log("Selected watch:", item.title)
        // Navigate to watch detail page
      }}
    />
  )
}

/**
 * EXAMPLE 2: Editorial Stories Rail
 */
export function EditorialStoriesRailExample() {
  const stories: EditorialArticleItem[] = [
    {
      id: "story-1",
      type: "editorial",
      title: "The History of Chronographs",
      author: "Sarah Chen",
      publishedAt: "2024-05-10",
      readTime: 8,
      featured: true,
      imageUrl: "https://example.com/story-1.jpg",
      description:
        "Explore the evolution of timing precision in watchmaking",
    },
    {
      id: "story-2",
      type: "story",
      title: "Collecting Vintage Sports Watches",
      author: "Marcus Sterling",
      publishedAt: "2024-05-08",
      readTime: 12,
      featured: false,
      imageUrl: "https://example.com/story-2.jpg",
      description:
        "A guide to finding authentic vintage pieces in the secondary market",
    },
    {
      id: "story-3",
      type: "editorial",
      title: "Inside the Workshop",
      author: "Elena Rossi",
      publishedAt: "2024-05-05",
      readTime: 6,
      featured: true,
      imageUrl: "https://example.com/story-3.jpg",
      description:
        "Behind-the-scenes look at how artisans craft luxury watches",
    },
  ]

  const section: EditorialRailSection = {
    id: "editorial-stories",
    title: "Latest Stories",
    description: "Timeless tales from the watch world",
    layout: "spacious",
    items: stories,
  }

  return (
    <EditorialRail
      section={section}
      onItemClick={(item) => {
        console.log("Read story:", item.title)
      }}
      showScrollIndicator={true}
    />
  )
}

/**
 * EXAMPLE 3: Collections Rail
 */
export function CollectionsRailExample() {
  const collections: EditorialCollectionItem[] = [
    {
      id: "collection-vintage",
      type: "collection",
      title: "Vintage Heritage",
      itemCount: 24,
      curator: "John Smith",
      theme: "Pre-1970s watches",
      imageUrl: "https://example.com/collection-1.jpg",
      description: "Timeless pieces from the golden era",
    },
    {
      id: "collection-sports",
      type: "collection",
      title: "Professional Sports",
      itemCount: 18,
      curator: "Alex Rivera",
      theme: "Dive & field watches",
      imageUrl: "https://example.com/collection-2.jpg",
      description: "Built for performance, designed for duty",
    },
    {
      id: "collection-minimalist",
      type: "collection",
      title: "Minimalist Design",
      itemCount: 12,
      curator: "Design Team",
      theme: "Clean aesthetics",
      imageUrl: "https://example.com/collection-3.jpg",
      description: "Less is more - timeless simplicity",
    },
  ]

  const section: EditorialRailSection = {
    id: "collections",
    title: "Browse Collections",
    description: "Curated selections organized by style",
    layout: "spacious",
    items: collections,
  }

  return (
    <EditorialRail
      section={section}
      onItemClick={(item) => {
        console.log("Viewing collection:", item.title)
      }}
    />
  )
}

/**
 * EXAMPLE 4: Mixed Content Discovery Page
 */
export function MixedContentDiscoveryExample() {
  const watchItems: EditorialWatchItem[] = [
    {
      id: "watch-discovery-1",
      type: "watch",
      title: "Datejust Classic",
      brand: "Rolex",
      material: "Steel",
      year: 2023,
      price: 12000,
      imageUrl: "https://example.com/watch-d1.jpg",
    },
    {
      id: "watch-discovery-2",
      type: "watch",
      title: "GMT Master II",
      brand: "Rolex",
      material: "Gold",
      year: 2024,
      price: 42000,
      imageUrl: "https://example.com/watch-d2.jpg",
    },
  ]

  const auctionItems: EditorialAuctionItem[] = [
    {
      id: "auction-1",
      type: "auction",
      title: "Rare 1960s Omega",
      currentBid: 8500,
      endTime: "2024-05-15T18:00:00Z",
      bidsCount: 42,
      imageUrl: "https://example.com/auction-1.jpg",
    },
    {
      id: "auction-2",
      type: "auction",
      title: "Vintage Seiko Diver",
      currentBid: 3200,
      endTime: "2024-05-12T20:00:00Z",
      bidsCount: 18,
      imageUrl: "https://example.com/auction-2.jpg",
    },
  ]

  const historyItems: EditorialHistoryItem[] = [
    {
      id: "history-1",
      type: "history",
      title: "The Moon Landing Watches",
      date: "July 20, 1969",
      period: "1960s",
      significance: "Watches that went to the moon",
      imageUrl: "https://example.com/history-1.jpg",
    },
    {
      id: "history-2",
      type: "history",
      title: "Chronograph Evolution",
      date: "1950s - 1970s",
      period: "Mid-century",
      significance: "Golden age of mechanical chronographs",
      imageUrl: "https://example.com/history-2.jpg",
    },
  ]

  const sections: EditorialRailSection[] = [
    {
      id: "featured-watches",
      title: "Featured Watches",
      description: "Handpicked for this season",
      layout: "compact",
      items: watchItems,
    },
    {
      id: "live-auctions",
      title: "Live Auctions",
      description: "Bidding now - limited time offers",
      layout: "compact",
      items: auctionItems,
    },
    {
      id: "history",
      title: "Watch History",
      description: "Iconic moments in watchmaking",
      layout: "spacious",
      items: historyItems,
    },
  ]

  return (
    <div className="space-y-16">
      <h1 className="text-4xl font-bold px-8 mb-8">Discover Watches</h1>

      <EditorialRailGroup
        sections={sections}
        onItemClick={(item) => {
          console.log("Selected item:", item)
          // Handle navigation, detail view, etc.
        }}
      />
    </div>
  )
}

/**
 * EXAMPLE 5: Personalized Recommendations Rail
 */
export function PersonalizedRecommendationsExample() {
  const recommendations: EditorialContent[] = [
    {
      id: "rec-1",
      type: "recommendation",
      title: "Seamaster - Based on your interest in dive watches",
      reason: "You viewed 5 dive watches last week",
      matchScore: 0.92,
      imageUrl: "https://example.com/rec-1.jpg",
    },
    {
      id: "rec-2",
      type: "recommendation",
      title: "Vintage Heuer - Chronograph collection match",
      reason: "Similar to items in your watchlist",
      matchScore: 0.87,
      imageUrl: "https://example.com/rec-2.jpg",
    },
    {
      id: "rec-3",
      type: "recommendation",
      title: "Rose Gold Nautilus - Luxury collection match",
      reason: "Matches your saved preferences",
      matchScore: 0.85,
      imageUrl: "https://example.com/rec-3.jpg",
    },
  ]

  const section: EditorialRailSection = {
    id: "personalized",
    title: "Recommended For You",
    description: "Based on your viewing history and preferences",
    layout: "compact",
    items: recommendations,
  }

  return (
    <EditorialRail
      section={section}
      onItemClick={(item) => {
        console.log("Exploring recommendation:", item.title)
      }}
    />
  )
}

/**
 * EXAMPLE 6: Complete Discovery Interface
 * 
 * A full-featured discovery page combining all content types
 */
export function CompleteDiscoveryInterfaceExample() {
  // Mock data for all sections
  const sections: EditorialRailSection[] = [
    {
      id: "trending",
      title: "Trending Now",
      description: "What collectors are watching",
      layout: "compact",
      items: generateMockItems("watch", 6),
    },
    {
      id: "stories",
      title: "Latest Stories",
      description: "Industry insights and collector diaries",
      layout: "spacious",
      items: generateMockItems("editorial", 4),
    },
    {
      id: "collections",
      title: "Collections",
      description: "Browse curated selections",
      layout: "spacious",
      items: generateMockItems("collection", 4),
    },
    {
      id: "auctions",
      title: "Active Auctions",
      description: "Bid now on rare pieces",
      layout: "compact",
      items: generateMockItems("auction", 8),
    },
    {
      id: "history",
      title: "Watchmaking History",
      description: "Iconic moments that shaped the industry",
      layout: "spacious",
      items: generateMockItems("history", 5),
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="px-4 md:px-8 lg:px-14 py-12 md:py-20">
        <h1 className="text-5xl md:text-6xl font-bold mb-4">Discover</h1>
        <p className="text-xl text-slate-400">
          Explore watches, stories, and collections from the world's finest timepiece community
        </p>
      </div>

      {/* Editorial Rails */}
      <EditorialRailGroup
        sections={sections}
        onItemClick={(item) => {
          console.log("User selected:", item)
          // Handle navigation and analytics
        }}
      />

      {/* Footer call-to-action */}
      <div className="px-4 md:px-8 lg:px-14 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Start Your Collection</h2>
        <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          Browse All Watches
        </button>
      </div>
    </div>
  )
}

/**
 * Helper function to generate mock items
 */
function generateMockItems(
  type: EditorialContent["type"],
  count: number
): EditorialContent[] {
  const mockImages = Array.from({ length: 10 }, (_, i) =>
    `https://placeholder.com/400x500?text=Item+${i + 1}`
  )

  return Array.from({ length: count }, (_, i) => ({
    id: `${type}-${i}`,
    type,
    title: `${type.charAt(0).toUpperCase() + type.slice(1)} Item ${i + 1}`,
    description: `A carefully curated ${type} for your collection`,
    imageUrl: mockImages[i % mockImages.length],
    category: type,
    metadata: {
      index: i + 1,
    },
  })) as EditorialContent[]
}

/**
 * EXPORT ALL EXAMPLES
 */
export const EditorialExamples = {
  WatchCollection: WatchCollectionRailExample,
  EditorialStories: EditorialStoriesRailExample,
  Collections: CollectionsRailExample,
  MixedContent: MixedContentDiscoveryExample,
  PersonalizedRecs: PersonalizedRecommendationsExample,
  CompleteInterface: CompleteDiscoveryInterfaceExample,
}
