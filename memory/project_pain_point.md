# Project Pain Point

## Canonical User Problem
"I see things I want to watch in the moment, but I lose them, forget them, or cannot quickly get back to them when I actually want to watch."

When intent becomes immediate:
"I do not want to search again or scroll endlessly. I want instant access to what I already liked."

## Real User Flow
1. Discovery (external apps): TikTok, Instagram, YouTube, X, Netflix, etc.
2. Storage (current broken behavior): platform-specific saves and collections.
3. Intent moment (critical): user opens WatchMarks because they want to watch now.
4. Failure mode to prevent: user still cannot find quickly, abandons, and restarts search elsewhere.

## Product Definition
WatchMarks is not a recommender-first product.
WatchMarks is a capture -> recall -> act system for high-intent items the user already validated.

## Non-Negotiable UX Principles
1. Saved-first retrieval: always show matches from user-saved items before anything else.
2. No mixed-source ambiguity: saved items and recommendations must be visually separated.
3. Capture speed over form depth: share-to-save should minimize manual fields.
4. Intent-first entry: opening the app should quickly answer "What do you feel like?"
5. Action completion: every surfaced item must have a clear next action (watch, schedule, or save).

## Retrieval Hierarchy
1. Exact matches from saved items
2. Partial and fuzzy matches from saved items
3. Fallback recommendations only if saved matches are weak or empty

## Positioning
WatchMarks = "The place where everything you wanted to watch actually lives."
