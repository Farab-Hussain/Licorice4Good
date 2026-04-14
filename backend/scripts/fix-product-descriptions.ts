/**
 * Script to fix product descriptions and variation names
 * 
 * Issues to fix:
 * 1. Remove "sweet classic" text from 3-pack sweet best sellers descriptions
 * 2. Remove "sweet best seller" text from sweet classic descriptions
 * 3. Clean up sour flavor descriptions (same issue with 4 packs)
 * 4. Change cherry, watermelon, berry delight packs from "Best Sellers" to "Classics" for 3-pack and 7-pack
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting product description and variation name fixes...\n");

  try {
    // 1. Fix product descriptions - remove incorrect text
    console.log("1. Fixing product descriptions...");
    
    // Get all products with packSize 3 or 4
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { packSize: 3 },
          { packSize: 4 },
        ],
        isActive: true,
      },
      include: {
        variations: {
          where: { isActive: true },
        },
      },
    });

    let updatedProducts = 0;
    for (const product of products) {
      let needsUpdate = false;
      let newDescription = product.description;

      if (!newDescription) continue;

      // Check if this product has variations
      const hasSweetBestSellers = product.variations.some(
        (v) => v.name.toLowerCase().includes("sweet") && v.name.toLowerCase().includes("best seller")
      );
      const hasSweetClassics = product.variations.some(
        (v) => v.name.toLowerCase().includes("sweet") && v.name.toLowerCase().includes("classic")
      );
      const hasSourBestSellers = product.variations.some(
        (v) => v.name.toLowerCase().includes("sour") && v.name.toLowerCase().includes("best seller")
      );
      const hasSourClassics = product.variations.some(
        (v) => v.name.toLowerCase().includes("sour") && v.name.toLowerCase().includes("classic")
      );

      const lowerDesc = newDescription.toLowerCase();

      // Remove "sweet classic" text if product has Sweet Best Sellers but NOT Sweet Classics
      if (hasSweetBestSellers && !hasSweetClassics) {
        if (lowerDesc.includes("sweet classic") || lowerDesc.includes("sweet classics")) {
          newDescription = newDescription
            .replace(/sweet classic/gi, "")
            .replace(/sweet classics/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          needsUpdate = true;
        }
      }

      // Remove "sweet best seller" text if product has Sweet Classics but NOT Sweet Best Sellers
      if (hasSweetClassics && !hasSweetBestSellers) {
        if (lowerDesc.includes("sweet best seller") || lowerDesc.includes("sweet best sellers")) {
          newDescription = newDescription
            .replace(/sweet best seller/gi, "")
            .replace(/sweet best sellers/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          needsUpdate = true;
        }
      }

      // Remove "sour best seller" text from sour classic descriptions
      if (hasSourClassics && !hasSourBestSellers) {
        const lowerDesc = newDescription.toLowerCase();
        if (lowerDesc.includes("sour best seller") || lowerDesc.includes("sour best sellers")) {
          newDescription = newDescription
            .replace(/sour best seller/gi, "")
            .replace(/sour best sellers/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          needsUpdate = true;
        }
      }

      // Remove "sour classic" text from sour best sellers descriptions
      if (hasSourBestSellers && !hasSourClassics) {
        const lowerDesc = newDescription.toLowerCase();
        if (lowerDesc.includes("sour classic") || lowerDesc.includes("sour classics")) {
          newDescription = newDescription
            .replace(/sour classic/gi, "")
            .replace(/sour classics/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await prisma.product.update({
          where: { id: product.id },
          data: { description: newDescription },
        });
        console.log(`  ✓ Updated product: ${product.name}`);
        console.log(`    Old: ${product.description}`);
        console.log(`    New: ${newDescription}\n`);
        updatedProducts++;
      }
    }

    console.log(`Updated ${updatedProducts} product descriptions\n`);

    // 2. Fix variation names - change "Best Sellers" to "Classics" for cherry, watermelon, berry delight
    console.log("2. Fixing variation names...");
    
    // Get all variations
    const variations = await prisma.productVariation.findMany({
      where: { isActive: true },
      include: {
        product: true,
        flavors: {
          include: {
            flavor: true,
          },
        },
      },
    });

    let updatedVariations = 0;
    for (const variation of variations) {
      // Check if this variation contains cherry, watermelon, or berry delight flavors
      const flavorNames = variation.flavors.map((vf) => vf.flavor.name.toLowerCase());
      const hasCherry = flavorNames.some((name) => name.includes("cherry"));
      const hasWatermelon = flavorNames.some((name) => name.includes("watermelon"));
      const hasBerryDelight = flavorNames.some((name) => name.includes("berry delight") || name.includes("berrydelight"));

      // Check if product is 3-pack or 7-pack
      const is3Pack = variation.product.packSize === 3;
      const is7Pack = variation.product.packSize === 7;

      // Check if variation name contains "Best Sellers" or "Best Seller"
      const variationNameLower = variation.name.toLowerCase();
      const isBestSellers = variationNameLower.includes("best seller");

      if ((hasCherry || hasWatermelon || hasBerryDelight) && (is3Pack || is7Pack) && isBestSellers) {
        // Change "Best Sellers" to "Classics"
        let newName = variation.name;
        
        // Handle different variations of the name
        if (variationNameLower.includes("sour best sellers")) {
          newName = variation.name.replace(/Best Sellers/gi, "Classics");
        } else if (variationNameLower.includes("sweet best sellers")) {
          newName = variation.name.replace(/Best Sellers/gi, "Classics");
        } else if (variationNameLower.includes("best sellers")) {
          newName = variation.name.replace(/Best Sellers/gi, "Classics");
        } else if (variationNameLower.includes("best seller")) {
          newName = variation.name.replace(/Best Seller/gi, "Classic");
        }

        if (newName !== variation.name) {
          // Check if a variation with this name already exists
          const existingVariation = await prisma.productVariation.findFirst({
            where: {
              productId: variation.productId,
              name: newName,
              id: { not: variation.id },
            },
          });

          if (existingVariation) {
            console.log(`  ⚠ Skipped ${variation.name} -> ${newName} (conflict with existing variation)`);
          } else {
            await prisma.productVariation.update({
              where: { id: variation.id },
              data: { name: newName },
            });
            console.log(`  ✓ Updated variation: ${variation.name} -> ${newName}`);
            console.log(`    Product: ${variation.product.name} (${variation.product.packSize}-pack)`);
            console.log(`    Flavors: ${variation.flavors.map((vf) => vf.flavor.name).join(", ")}\n`);
            updatedVariations++;
          }
        }
      }
    }

    console.log(`Updated ${updatedVariations} variation names\n`);

    console.log("✅ All fixes completed successfully!");
  } catch (error) {
    console.error("❌ Error running fixes:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
