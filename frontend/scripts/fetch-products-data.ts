/**
 * Frontend script to fetch and log all products and variants via API
 * This can be run in the browser console or as a Node script
 * 
 * Usage in browser console:
 * 1. Open admin dashboard
 * 2. Copy and paste this entire script
 * 3. Run: fetchAllProductsData()
 * 
 * Or run as Node script:
 * npx ts-node frontend/scripts/fetch-products-data.ts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  sku?: string;
  isActive?: boolean;
  supportLevel?: string | null;
  packSize?: number | null;
  isPackProduct?: boolean;
  packType?: string | null;
  flavors?: Array<{ id: string; name: string; quantity: number }>;
  variations?: Array<{
    id: string;
    name: string;
    sku?: string;
    isActive?: boolean;
    images: Array<{ id: string; imageUrl: string; isDefault: boolean }>;
    flavors: Array<{ id: string; name: string; quantity: number }>;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

async function fetchAllProductsData() {
  try {
    console.log("=".repeat(80));
    console.log("FETCHING ALL PRODUCTS AND VARIANTS DATA VIA API");
    console.log("=".repeat(80));
    console.log(`API URL: ${API_URL}`);
    console.log();

    // Fetch all products from admin endpoint
    const response = await fetch(`${API_URL}/products/admin/all?limit=1000`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const products: Product[] = Array.isArray(data.products)
      ? data.products
      : Array.isArray(data)
      ? data
      : [];

    console.log(`Total Products Found: ${products.length}`);
    console.log();

    // Categorize products
    const regularProducts = products.filter((p) => !p.isPackProduct);
    const packProducts = products.filter((p) => p.isPackProduct === true);
    const productsWithVariations = products.filter(
      (p) => p.variations && p.variations.length > 0
    );
    const productsWithoutVariations = products.filter(
      (p) => !p.variations || p.variations.length === 0
    );

    console.log("=".repeat(80));
    console.log("PRODUCT CATEGORIZATION");
    console.log("=".repeat(80));
    console.log(`Regular Products: ${regularProducts.length}`);
    console.log(`Pack Products (12-pack/7-pack): ${packProducts.length}`);
    console.log(`Products with Variations: ${productsWithVariations.length}`);
    console.log(`Products without Variations: ${productsWithoutVariations.length}`);
    console.log();

    // Group by pack size
    const packSizeGroups: { [key: string]: Product[] } = {};
    products.forEach((p) => {
      const key = p.packSize ? `${p.packSize}-pack` : "no-pack-size";
      if (!packSizeGroups[key]) {
        packSizeGroups[key] = [];
      }
      packSizeGroups[key].push(p);
    });

    console.log("=".repeat(80));
    console.log("PRODUCTS BY PACK SIZE");
    console.log("=".repeat(80));
    Object.keys(packSizeGroups)
      .sort()
      .forEach((key) => {
        const group = packSizeGroups[key];
        const packProductsInGroup = group.filter((p) => p.isPackProduct);
        const regularInGroup = group.filter((p) => !p.isPackProduct);
        console.log(
          `${key}: ${group.length} total (${regularInGroup.length} regular, ${packProductsInGroup.length} pack products)`
        );
      });
    console.log();

    // Detailed product listing
    console.log("=".repeat(80));
    console.log("DETAILED PRODUCT LISTING");
    console.log("=".repeat(80));
    console.log();

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   SKU: ${product.sku || "N/A"}`);
      console.log(`   Price: $${product.price.toFixed(2)}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Pack Size: ${product.packSize || "N/A"}`);
      console.log(`   Is Pack Product: ${product.isPackProduct}`);
      console.log(`   Pack Type: ${product.packType || "N/A"}`);
      console.log(`   Support Level: ${product.supportLevel || "N/A"}`);
      console.log(`   Is Active: ${product.isActive}`);
      console.log(`   Image: ${product.imageUrl || "N/A"}`);
      console.log(
        `   Flavors: ${product.flavors && product.flavors.length > 0 ? product.flavors.map((f) => `${f.name} (x${f.quantity})`).join(", ") : "None"}`
      );
      console.log(
        `   Variations: ${product.variations ? product.variations.length : 0} variation(s)`
      );

      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((variation, vIndex) => {
          console.log(`      Variation ${vIndex + 1}: ${variation.name}`);
          console.log(`         ID: ${variation.id}`);
          console.log(`         SKU: ${variation.sku || "N/A"}`);
          console.log(`         Is Active: ${variation.isActive}`);
          console.log(
            `         Images: ${variation.images.length} image(s)`
          );
          if (variation.images.length > 0) {
            const defaultImage = variation.images.find((img) => img.isDefault);
            console.log(
              `         Default Image: ${defaultImage?.imageUrl || variation.images[0]?.imageUrl || "N/A"}`
            );
          }
          console.log(
            `         Flavors: ${variation.flavors.length > 0 ? variation.flavors.map((f) => `${f.name} (x${f.quantity})`).join(", ") : "None"}`
          );
        });
      }

      console.log(`   Created: ${product.createdAt || "N/A"}`);
      console.log(`   Updated: ${product.updatedAt || "N/A"}`);
      console.log();
    });

    // Summary statistics
    console.log("=".repeat(80));
    console.log("SUMMARY STATISTICS");
    console.log("=".repeat(80));

    const totalVariations = products.reduce(
      (sum, p) => sum + (p.variations?.length || 0),
      0
    );
    const activeVariations = products.reduce(
      (sum, p) =>
        sum + (p.variations?.filter((v) => v.isActive).length || 0),
      0
    );
    const totalVariationImages = products.reduce(
      (sum, p) =>
        sum +
        (p.variations?.reduce((vSum, v) => vSum + v.images.length, 0) || 0),
      0
    );

    console.log(`Total Products: ${products.length}`);
    console.log(
      `Active Products: ${products.filter((p) => p.isActive).length}`
    );
    console.log(
      `Inactive Products: ${products.filter((p) => !p.isActive).length}`
    );
    console.log(`Total Variations: ${totalVariations}`);
    console.log(`Active Variations: ${activeVariations}`);
    console.log(`Inactive Variations: ${totalVariations - activeVariations}`);
    console.log(`Total Variation Images: ${totalVariationImages}`);
    console.log();

    // Pack products details
    if (packProducts.length > 0) {
      console.log("=".repeat(80));
      console.log("PACK PRODUCTS DETAILS (12-pack & 7-pack)");
      console.log("=".repeat(80));
      packProducts.forEach((product) => {
        console.log(`- ${product.name}`);
        console.log(`  Pack Size: ${product.packSize}`);
        console.log(`  Pack Type: ${product.packType}`);
        console.log(`  Price: $${product.price.toFixed(2)}`);
        console.log(`  Is Active: ${product.isActive}`);
      });
      console.log();
    }

    // Products with variations (3-pack and 4-pack)
    if (productsWithVariations.length > 0) {
      console.log("=".repeat(80));
      console.log("PRODUCTS WITH VARIATIONS (3-pack & 4-pack)");
      console.log("=".repeat(80));
      productsWithVariations.forEach((product) => {
        console.log(`- ${product.name} (${product.packSize}-pack)`);
        console.log(`  Variations: ${product.variations?.length || 0}`);
        product.variations?.forEach((v) => {
          console.log(
            `    • ${v.name} (${v.isActive ? "Active" : "Inactive"})`
          );
        });
      });
      console.log();
    }

    // Export data structure
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: products.length,
        activeProducts: products.filter((p) => p.isActive).length,
        inactiveProducts: products.filter((p) => !p.isActive).length,
        totalVariations: totalVariations,
        activeVariations: activeVariations,
        packProducts: packProducts.length,
        productsWithVariations: productsWithVariations.length,
      },
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        packSize: p.packSize,
        isPackProduct: p.isPackProduct,
        packType: p.packType,
        isActive: p.isActive,
        sku: p.sku,
        imageUrl: p.imageUrl,
        flavors: p.flavors || [],
        variations:
          p.variations?.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            isActive: v.isActive,
            images: v.images,
            flavors: v.flavors,
          })) || [],
      })),
    };

    console.log("=".repeat(80));
    console.log("EXPORT DATA (Copy this JSON)");
    console.log("=".repeat(80));
    console.log(JSON.stringify(exportData, null, 2));
    console.log();

    // Also copy to clipboard if in browser
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(JSON.stringify(exportData, null, 2))
        .then(() => {
          console.log("Data copied to clipboard!");
        })
        .catch((err) => {
          console.log("Could not copy to clipboard:", err);
        });
    }

    console.log("=".repeat(80));
    console.log("FETCH COMPLETE");
    console.log("=".repeat(80));

    return exportData;
  } catch (error) {
    console.error("Error fetching products data:", error);
    throw error;
  }
}

// Export for use in Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { fetchAllProductsData };
}

// Auto-run if executed directly
if (require.main === module) {
  fetchAllProductsData()
    .then(() => {
      console.log("Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

// Make available globally in browser
if (typeof window !== "undefined") {
  (window as any).fetchAllProductsData = fetchAllProductsData;
}
