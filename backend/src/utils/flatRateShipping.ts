/**
 * Flat-rate shipping calculation based on rope count
 * 
 * Shipping rates:
 * - 1-10 ropes: Standard $6.95, Premium $11.95
 * - 11+ ropes: Standard $10.95, Premium $15.95
 */

export interface FlatRateShippingOption {
  objectId: string;
  carrier: string;
  serviceName: string;
  amount: number;
  estimatedDays: number;
  currency: string;
}

/**
 * Calculate total rope count from order items
 * Ropes = flavors in custom packs or packSize for pack products
 */
export function calculateTotalRopes(orderItems: Array<{
  productId?: string | null;
  quantity: number;
  flavorIds?: string[];
  packSize?: number | null;
  packProductId?: string | null;
}>): number {
  let totalRopes = 0;

  for (const item of orderItems) {
    if (!item.productId && item.flavorIds && item.flavorIds.length > 0) {
      // Custom pack - count flavors (ropes)
      totalRopes += item.quantity * item.flavorIds.length;
    } else if (item.productId) {
      // Check if it's a pack product with packSize
      if (item.packSize && item.packSize > 0) {
        // Pack product - use packSize
        totalRopes += item.quantity * item.packSize;
      } else {
        // Regular product - default to counting as 1 rope per item
        // For products without packSize, you may want to fetch from database
        totalRopes += item.quantity;
      }
    }
  }

  return totalRopes;
}

/**
 * Get flat-rate shipping options based on rope count
 */
export function getFlatRateShippingOptions(ropeCount: number): FlatRateShippingOption[] {
  const isHighVolume = ropeCount >= 11;
  
  if (isHighVolume) {
    // 11+ ropes
    return [
      {
        objectId: `flat-rate-standard-${ropeCount}`,
        carrier: 'Standard Shipping',
        serviceName: 'Standard Shipping',
        amount: 10.95,
        estimatedDays: 5,
        currency: 'USD',
      },
      {
        objectId: `flat-rate-premium-${ropeCount}`,
        carrier: 'Premium Shipping',
        serviceName: 'Premium Shipping',
        amount: 15.95,
        estimatedDays: 2,
        currency: 'USD',
      },
    ];
  } else {
    // 1-10 ropes
    return [
      {
        objectId: `flat-rate-standard-${ropeCount}`,
        carrier: 'Standard Shipping',
        serviceName: 'Standard Shipping',
        amount: 6.95,
        estimatedDays: 5,
        currency: 'USD',
      },
      {
        objectId: `flat-rate-premium-${ropeCount}`,
        carrier: 'Premium Shipping',
        serviceName: 'Premium Shipping',
        amount: 11.95,
        estimatedDays: 2,
        currency: 'USD',
      },
    ];
  }
}

