/**
 * Rope pricing tiers
 * 
 * Pricing:
 * - 6-10 ropes: $6.49 each
 * - 11+ ropes: $5.99 each
 */

/**
 * Calculate price per rope based on quantity tier
 */
export function getPricePerRope(ropeCount: number): number {
  if (ropeCount >= 11) {
    return 5.99; // 11+ ropes
  } else if (ropeCount >= 6) {
    return 6.49; // 6-10 ropes
  } else {
    // Default pricing for 1-5 ropes (you may want to adjust this)
    return 6.49; // Default to 6.49 for smaller quantities
  }
}

/**
 * Calculate total price for ropes
 */
export function calculateRopePrice(ropeCount: number): number {
  return ropeCount * getPricePerRope(ropeCount);
}

