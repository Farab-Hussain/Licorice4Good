/**
 * Script to fetch and log all products and variants from the database
 * This helps understand the complete current state before making changes
 * 
 * Usage: npx ts-node backend/scripts/fetch-all-products-data.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string | null;
  imageUrl: string | null;
  sku: string | null;
  isActive: boolean;
  supportLevel: string | null;
  packSize: number | null;
  isPackProduct: boolean;
  packType: string | null;
  flavors: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
  variations: Array<{
    id: string;
    name: string;
    sku: string | null;
    isActive: boolean;
    images: Array<{
      id: string;
      imageUrl: string;
      isDefault: boolean;
    }>;
    flavors: Array<{
      id: string;
      name: string;
      quantity: number;
    }>;
  }>;
  nutritionFacts: Array<{
    id: string;
    fileUrl: string;
    fileName: string | null;
    fileType: string | null;
    displayOrder: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

async function fetchAllProductsData() {
  try {
    console.log("=".repeat(80));
    console.log("FETCHING ALL PRODUCTS AND VARIANTS DATA");
    console.log("=".repeat(80));
    console.log();

    // Fetch all products with all relations
    const products = await prisma.product.findMany({
      include: {
        productFlavors: {
          include: {
            flavor: true,
          },
        },
        variations: {
          include: {
            images: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            },
            flavors: {
              include: {
                flavor: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        nutritionFacts: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [
        { packSize: "asc" },
        { createdAt: "desc" },
      ],
    });

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
    const packSizeGroups: { [key: string]: typeof products } = {};
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
        `   Flavors: ${product.productFlavors.length > 0 ? product.productFlavors.map((pf) => `${pf.flavor.name} (x${pf.quantity})`).join(", ") : "None"}`
      );
      console.log(
        `   Variations: ${product.variations.length} variation(s)`
      );

      if (product.variations.length > 0) {
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
            `         Flavors: ${variation.flavors.length > 0 ? variation.flavors.map((vf) => `${vf.flavor.name} (x${vf.quantity})`).join(", ") : "None"}`
          );
        });
      }

      console.log(
        `   Nutrition Facts: ${product.nutritionFacts.length} file(s)`
      );
      console.log(`   Created: ${product.createdAt.toISOString()}`);
      console.log(`   Updated: ${product.updatedAt.toISOString()}`);
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
    console.log(`Active Products: ${products.filter((p) => p.isActive).length}`);
    console.log(`Inactive Products: ${products.filter((p) => !p.isActive).length}`);
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
        console.log(`  Variations: ${product.variations.length}`);
        product.variations.forEach((v) => {
          console.log(`    • ${v.name} (${v.isActive ? "Active" : "Inactive"})`);
        });
      });
      console.log();
    }

    // Export to JSON file for reference
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
        flavors: p.productFlavors.map((pf) => ({
          name: pf.flavor.name,
          quantity: pf.quantity,
        })),
        variations: p.variations.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          isActive: v.isActive,
          images: v.images.map((img) => ({
            imageUrl: img.imageUrl,
            isDefault: img.isDefault,
          })),
          flavors: v.flavors.map((vf) => ({
            name: vf.flavor.name,
            quantity: vf.quantity,
          })),
        })),
      })),
    };

    // Export to JSON file for reference
    try {
      const fs = require("fs");
      const path = require("path");
      const outputPath = path.join(
        process.cwd(),
        "products-data-export.json"
      );
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      console.log(`Data exported to: ${outputPath}`);
      console.log();
    } catch (exportError) {
      console.warn("Could not export to JSON file:", exportError);
      console.log("Data is still available in console output above.");
      console.log();
    }

    console.log("=".repeat(80));
    console.log("FETCH COMPLETE");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error fetching products data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fetchAllProductsData()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
