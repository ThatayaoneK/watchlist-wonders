/**
 * Motion tokens - single source of truth for animation timing.
 *
 * Rules:
 * - No animation > 300ms
 * - No bounce or spring
 * - Only animate opacity and transform (no layout properties)
 * - Hover is asymmetric: open is slower, close is faster.
 */

export const motionDuration = {
  fast: 150,    // micro-interactions, fades
  normal: 200,  // standard transitions
  slow: 300,    // max - page-level reveals
  card: 250,    // card hover expand (between normal and slow)
} as const;

/** Material Design standard easing. */
export const motionEasing = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Hover intent delays prevent accidental triggers during cursor travel.
 * Close delay < open delay so reveals feel intentional but dismissal is snappy.
 */
export const hoverOpenDelayMs = 120;
export const hoverCloseDelayMs = 140;
