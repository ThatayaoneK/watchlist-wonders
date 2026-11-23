/**
 * Editorial Content Types
 * 
 * Defines the structure of editorial content that flows through the EditorialRail
 */

export type EditorialContentType =
  | "watch"
  | "editorial"
  | "collection"
  | "story"
  | "auction"
  | "history"
  | "recommendation"

/**
 * Base editorial item interface
 */
export interface EditorialItem {
  id: string
  type: EditorialContentType
  title: string
  description?: string
  imageUrl: string
  category?: string
  metadata?: Record<string, string | number>
}

/**
 * Watch item in editorial context
 */
export interface EditorialWatchItem extends EditorialItem {
  type: "watch"
  brand?: string
  material?: string
  year?: number
  price?: number
  availability?: string
  color?: string
}

/**
 * Editorial article/story
 */
export interface EditorialArticleItem extends EditorialItem {
  type: "editorial" | "story"
  author?: string
  publishedAt?: string
  readTime?: number
  featured?: boolean
}

/**
 * Collection item
 */
export interface EditorialCollectionItem extends EditorialItem {
  type: "collection"
  itemCount?: number
  curator?: string
  theme?: string
}

/**
 * Auction/marketplace item
 */
export interface EditorialAuctionItem extends EditorialItem {
  type: "auction"
  currentBid?: number
  endTime?: string
  bidsCount?: number
}

/**
 * Historical item
 */
export interface EditorialHistoryItem extends EditorialItem {
  type: "history"
  date?: string
  period?: string
  significance?: string
}

/**
 * Recommendation item
 */
export interface EditorialRecommendationItem extends EditorialItem {
  type: "recommendation"
  reason?: string
  matchScore?: number
}

/**
 * Union type of all editorial items
 */
export type EditorialContent =
  | EditorialWatchItem
  | EditorialArticleItem
  | EditorialCollectionItem
  | EditorialAuctionItem
  | EditorialHistoryItem
  | EditorialRecommendationItem

/**
 * Editorial Rail section
 */
export interface EditorialRailSection {
  id: string
  title: string
  description?: string
  items: EditorialContent[]
  contentType?: "mixed" | "homogeneous"
  layout?: "compact" | "spacious"
}
