const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function checkPackProducts() {
  try {
    console.log('🔍 Checking Pack Products Setup...\n');

    // Check all products
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        variations: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            isActive: true,
            images: {
              select: {
                id: true,
                imageUrl: true,
                isDefault: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📦 Total Active Products: ${allProducts.length}\n`);

    // Check products by packSize
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PRODUCTS BY PACK SIZE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3-pack products
    const threePackProducts = allProducts.filter(
      (p) => p.packSize === 3 && !p.isPackProduct
    );
    console.log(`✅ 3-Pack Products (isPackProduct=false): ${threePackProducts.length}`);
    if (threePackProducts.length > 0) {
      threePackProducts.forEach((product) => {
        const variationCount = product.variations?.length || 0;
        const status = variationCount > 0 ? '✅' : '❌';
        console.log(
          `   ${status} ${product.name} (ID: ${product.id})`
        );
        console.log(`      Category: ${product.category || 'N/A'}`);
        console.log(`      Variations: ${variationCount}`);
        console.log(`      Is Active: ${product.isActive}`);
        console.log(`      Is Pack Product: ${product.isPackProduct}`);
        if (variationCount > 0) {
          product.variations.forEach((v) => {
            console.log(`        - ${v.name} (${v.images?.length || 0} images)`);
          });
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No 3-pack products found!');
      console.log('   💡 You need to create products with packSize=3 and isPackProduct=false\n');
    }

    // 4-pack products
    const fourPackProducts = allProducts.filter(
      (p) => p.packSize === 4 && !p.isPackProduct
    );
    console.log(`\n✅ 4-Pack Products (isPackProduct=false): ${fourPackProducts.length}`);
    if (fourPackProducts.length > 0) {
      fourPackProducts.forEach((product) => {
        const variationCount = product.variations?.length || 0;
        const status = variationCount > 0 ? '✅' : '❌';
        console.log(
          `   ${status} ${product.name} (ID: ${product.id})`
        );
        console.log(`      Category: ${product.category || 'N/A'}`);
        console.log(`      Variations: ${variationCount}`);
        console.log(`      Is Active: ${product.isActive}`);
        console.log(`      Is Pack Product: ${product.isPackProduct}`);
        if (variationCount > 0) {
          product.variations.forEach((v) => {
            console.log(`        - ${v.name} (${v.images?.length || 0} images)`);
          });
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No 4-pack products found!');
      console.log('   💡 You need to create products with packSize=4 and isPackProduct=false\n');
    }

    // Check Gold and Platinum pack products
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 GOLD & PLATINUM PACK PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const goldPack = allProducts.find(
      (p) => p.isPackProduct && p.packType === 'gold'
    );
    const platinumPack = allProducts.find(
      (p) => p.isPackProduct && p.packType === 'platinum'
    );

    if (goldPack) {
      console.log(`✅ Gold Pack Product: ${goldPack.name} (ID: ${goldPack.id})`);
      console.log(`   Pack Size: ${goldPack.packSize}`);
      console.log(`   Is Active: ${goldPack.isActive}\n`);
    } else {
      console.log('❌ Gold Pack Product not found!\n');
    }

    if (platinumPack) {
      console.log(`✅ Platinum Pack Product: ${platinumPack.name} (ID: ${platinumPack.id})`);
      console.log(`   Pack Size: ${platinumPack.packSize}`);
      console.log(`   Is Active: ${platinumPack.isActive}\n`);
    } else {
      console.log('❌ Platinum Pack Product not found!\n');
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const threePackWithVariations = threePackProducts.filter(
      (p) => (p.variations?.length || 0) > 0
    );
    const fourPackWithVariations = fourPackProducts.filter(
      (p) => (p.variations?.length || 0) > 0
    );

    console.log(`3-Pack Products: ${threePackProducts.length} (${threePackWithVariations.length} with variations)`);
    console.log(`4-Pack Products: ${fourPackProducts.length} (${fourPackWithVariations.length} with variations)`);

    // Category breakdown for 3-packs
    const sweetThreePacks = threePackProducts.filter(
      (p) => p.category?.toLowerCase() === 'sweet'
    );
    const sourThreePacks = threePackProducts.filter(
      (p) => p.category?.toLowerCase() === 'sour'
    );

    console.log(`\n3-Pack by Category:`);
    console.log(`  Sweet: ${sweetThreePacks.length} (${sweetThreePacks.filter(p => (p.variations?.length || 0) > 0).length} with variations)`);
    console.log(`  Sour: ${sourThreePacks.length} (${sourThreePacks.filter(p => (p.variations?.length || 0) > 0).length} with variations)`);

    // Recommendations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (threePackProducts.length === 0) {
      console.log('❌ Create 3-pack products:');
      console.log('   - Go to Admin Dashboard → Products');
      console.log('   - Create products with packSize=3, isPackProduct=false');
      console.log('   - Set category to "Sweet" or "Sour"');
      console.log('   - Add variations to each product\n');
    }

    if (fourPackProducts.length === 0) {
      console.log('❌ Create 4-pack products:');
      console.log('   - Go to Admin Dashboard → Products');
      console.log('   - Create products with packSize=4, isPackProduct=false');
      console.log('   - Add variations to each product\n');
    }

    if (threePackProducts.length > 0 && threePackWithVariations.length < threePackProducts.length) {
      console.log('⚠️  Some 3-pack products are missing variations:');
      threePackProducts
        .filter((p) => (p.variations?.length || 0) === 0)
        .forEach((p) => {
          console.log(`   - ${p.name} (ID: ${p.id})`);
        });
      console.log('');
    }

    if (fourPackProducts.length > 0 && fourPackWithVariations.length < fourPackProducts.length) {
      console.log('⚠️  Some 4-pack products are missing variations:');
      fourPackProducts
        .filter((p) => (p.variations?.length || 0) === 0)
        .forEach((p) => {
          console.log(`   - ${p.name} (ID: ${p.id})`);
        });
      console.log('');
    }

    if (platinumPack && (sweetThreePacks.length === 0 || sourThreePacks.length === 0)) {
      console.log('⚠️  For Platinum pack, you need:');
      if (sweetThreePacks.length === 0) {
        console.log('   - At least one Sweet 3-pack product with variations');
      }
      if (sourThreePacks.length === 0) {
        console.log('   - At least one Sour 3-pack product with variations');
      }
      console.log('');
    }

    if (
      goldPack &&
      (threePackWithVariations.length === 0 || fourPackWithVariations.length === 0)
    ) {
      console.log('⚠️  For Gold pack, you need:');
      if (threePackWithVariations.length === 0) {
        console.log('   - At least one 3-pack product with variations');
      }
      if (fourPackWithVariations.length === 0) {
        console.log('   - At least one 4-pack product with variations');
      }
      console.log('');
    }

    // Success message
    const goldReady =
      goldPack &&
      threePackWithVariations.length > 0 &&
      fourPackWithVariations.length > 0;
    const platinumReady =
      platinumPack &&
      sweetThreePacks.filter((p) => (p.variations?.length || 0) > 0).length > 0 &&
      sourThreePacks.filter((p) => (p.variations?.length || 0) > 0).length > 0;

    if (goldReady && platinumReady) {
      console.log('✅ All pack products are properly configured!\n');
    } else {
      console.log('❌ Some configuration is missing. Please follow recommendations above.\n');
    }
  } catch (error) {
    console.error('❌ Error checking pack products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPackProducts();

