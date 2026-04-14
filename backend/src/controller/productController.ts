import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import {
  validateFlavor,
  generateSKU,
  generateCustomSKU,
} from "../utils/skuGenerator";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

const prisma = new PrismaClient();

// Helper function to delete image from Cloudinary
const deleteImageFile = async (
  imageUrl: string | null,
  publicId: string | null
) => {
  if (!publicId) return;

  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

// Helper: resolve a Flavor by provided name (case-insensitive) or alias
const resolveFlavorByNameOrAlias = async (nameLike: string) => {
  return await validateFlavor(nameLike);
};

// Create new product (Admin only)
export const createProduct = async (req: Request, res: Response) => {
  try {
    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({ message: "Request body is required" });
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      supportLevel,
      packSize,
    } = req.body;

    // Handle uploaded image - upload to Cloudinary
    let imageUrl: string | null = null;
    let cloudinaryPublicId: string | null = null;
    const uploadFiles = (req as any).files;
    if (
      uploadFiles &&
      uploadFiles.productImage &&
      uploadFiles.productImage.length > 0
    ) {
      const productImageFile = uploadFiles.productImage[0];
      const uploadResult = await uploadToCloudinary(
        productImageFile,
        "products"
      );
      imageUrl = uploadResult.url;
      cloudinaryPublicId = uploadResult.public_id;
    } else if (req.file) {
      // Fallback for single file upload
      const uploadResult = await uploadToCloudinary(req.file, "products");
      imageUrl = uploadResult.url;
      cloudinaryPublicId = uploadResult.public_id;
    }

    // Handle multiple nutrition facts uploads if provided
    const nutritionFactsFiles: Array<{
      fileUrl: string;
      cloudinaryPublicId: string;
      fileName: string;
      fileType: string;
    }> = [];

    if (
      uploadFiles &&
      uploadFiles.nutritionFacts &&
      uploadFiles.nutritionFacts.length > 0
    ) {
      for (const nutritionFile of uploadFiles.nutritionFacts) {
        const uploadResult = await uploadToCloudinary(
          nutritionFile,
          "nutrition-facts"
        );
        const fileType =
          nutritionFile.mimetype === "application/pdf" ? "pdf" : "image";
        nutritionFactsFiles.push({
          fileUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.public_id,
          fileName: nutritionFile.originalname || "nutrition-fact",
          fileType: fileType,
        });
      }
    }

    // Validate required fields
    if (!name || !price || !stock || !category) {
      return res.status(400).json({
        message:
          "Missing required fields: name, price, stock, category are required",
      });
    }

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Generate a unique SKU if not provided
    const sku = `PROD-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;

    // Parse flavors from multipart or JSON
    let parsedFlavors: Array<{ name?: string; quantity?: number }> = [];
    try {
      const raw = (req.body as any).flavors;
      if (raw) {
        parsedFlavors = Array.isArray(raw)
          ? (raw as any[])
          : JSON.parse(String(raw));
      }
    } catch {
      parsedFlavors = [];
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          description,
          price: parseFloat(price),
          stock: parseInt(stock),
          category,
          imageUrl,
          cloudinaryPublicId,
          sku,
          supportLevel: supportLevel || null,
          packSize: packSize ? parseInt(packSize) : null,
          isPackProduct:
            (req.body as any).isPackProduct === "true" ||
            (req.body as any).isPackProduct === true,
          packType: (req.body as any).packType || null,
          nutritionFacts: {
            create: nutritionFactsFiles.map((nf, index) => ({
              fileUrl: nf.fileUrl,
              cloudinaryPublicId: nf.cloudinaryPublicId,
              fileName: nf.fileName,
              fileType: nf.fileType,
              displayOrder: index,
            })),
          },
        },
        include: {
          nutritionFacts: true,
        },
      });

      // Persist ProductFlavor rows if provided
      if (Array.isArray(parsedFlavors) && parsedFlavors.length > 0) {
        for (const f of parsedFlavors) {
          const qty = Number((f as any)?.quantity ?? 1);
          const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
          const flavorName = String((f as any)?.name || "").trim();
          if (!flavorName) continue;
          const flavor = await resolveFlavorByNameOrAlias(flavorName);
          if (!flavor) continue; // Skip unknown flavors silently
          await tx.productFlavor.upsert({
            where: {
              productId_flavorId: {
                productId: product.id,
                flavorId: flavor.id,
              },
            },
            update: { quantity },
            create: {
              productId: product.id,
              flavorId: flavor.id,
              quantity,
            },
          });
        }
      }

      return product;
    });

    res
      .status(201)
      .json({ message: "Product created successfully", product: result });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Error creating product" });
  }
};

// Get all active products
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        include: {
          productFlavors: {
            include: {
              flavor: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    // Transform products to include flavor information
    const transformedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sku: product.sku,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      supportLevel: product.supportLevel,
      packSize: product.packSize,
      isPackProduct: product.isPackProduct,
      packType: product.packType,
      flavors: product.productFlavors.map((pf) => ({
        id: pf.flavor.id,
        name: pf.flavor.name,
        quantity: pf.quantity,
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    res.json({
      products: transformedProducts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching products" });
  }
};

// Get single product by ID
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        productFlavors: {
          include: {
            flavor: true,
          },
        },
        variations: {
          where: { isActive: true },
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
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Transform product to include flavor information and variations
    const transformedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sku: product.sku,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      supportLevel: product.supportLevel,
      packSize: product.packSize,
      nutritionFactsUrl: product.nutritionFactsUrl,
      nutritionFacts: product.nutritionFacts.map((nf) => ({
        id: nf.id,
        fileUrl: nf.fileUrl,
        fileName: nf.fileName,
        fileType: nf.fileType,
        displayOrder: nf.displayOrder,
      })),
      flavors: product.productFlavors.map((pf) => ({
        id: pf.flavor.id,
        name: pf.flavor.name,
        quantity: pf.quantity,
      })),
      variations: product.variations.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        isActive: v.isActive,
        images: v.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isDefault: img.isDefault,
        })),
        flavors: v.flavors.map((vf) => ({
          id: vf.flavor.id,
          name: vf.flavor.name,
          quantity: vf.quantity,
        })),
      })),
      isPackProduct: product.isPackProduct,
      packType: product.packType,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    res.json(transformedProduct);
  } catch (err) {
    res.status(500).json({ message: "Error fetching product" });
  }
};

// Update product (Admin only)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({ message: "Request body is required" });
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      isActive,
      supportLevel,
      packSize,
      isPackProduct,
      packType,
    } = req.body;

    // Handle uploaded image - upload to Cloudinary
    let imageUrl: string | null = null;
    let cloudinaryPublicId: string | null = null;
    const updateFiles = (req as any).files;
    if (
      updateFiles &&
      updateFiles.productImage &&
      updateFiles.productImage.length > 0
    ) {
      const productImageFile = updateFiles.productImage[0];
      const uploadResult = await uploadToCloudinary(
        productImageFile,
        "products"
      );
      imageUrl = uploadResult.url;
      cloudinaryPublicId = uploadResult.public_id;

      // Delete old image from Cloudinary if exists
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { cloudinaryPublicId: true },
      });
      if (existingProduct?.cloudinaryPublicId) {
        await deleteImageFile(null, existingProduct.cloudinaryPublicId);
      }
    } else if (req.file) {
      // Fallback for single file upload
      const uploadResult = await uploadToCloudinary(req.file, "products");
      imageUrl = uploadResult.url;
      cloudinaryPublicId = uploadResult.public_id;

      // Delete old image from Cloudinary if exists
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { cloudinaryPublicId: true },
      });
      if (existingProduct?.cloudinaryPublicId) {
        await deleteImageFile(null, existingProduct.cloudinaryPublicId);
      }
    } else {
      // Keep existing imageUrl if no new file uploaded
      imageUrl = req.body.imageUrl;
    }

    // Handle multiple nutrition facts uploads if provided
    const newNutritionFactsFiles: Array<{
      fileUrl: string;
      cloudinaryPublicId: string;
      fileName: string;
      fileType: string;
    }> = [];

    if (
      updateFiles &&
      updateFiles.nutritionFacts &&
      updateFiles.nutritionFacts.length > 0
    ) {
      for (const nutritionFile of updateFiles.nutritionFacts) {
        const uploadResult = await uploadToCloudinary(
          nutritionFile,
          "nutrition-facts"
        );
        const fileType =
          nutritionFile.mimetype === "application/pdf" ? "pdf" : "image";
        newNutritionFactsFiles.push({
          fileUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.public_id,
          fileName: nutritionFile.originalname || "nutrition-fact",
          fileType: fileType,
        });
      }
    }

    // Get existing nutrition facts to determine display order
    const existingNutritionFacts = await prisma.productNutritionFact.findMany({
      where: { productId: id },
      orderBy: { displayOrder: "asc" },
    });
    const nextDisplayOrder = existingNutritionFacts.length;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Attempt to capture flavors from multipart or JSON body
    let parsedFlavors: Array<{ name?: string; quantity?: number }> | undefined;
    try {
      const raw = (req.body as any).flavors;
      if (raw !== undefined) {
        parsedFlavors = Array.isArray(raw)
          ? (raw as any[])
          : JSON.parse(String(raw));
      }
    } catch {
      parsedFlavors = undefined;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          name,
          description,
          price: price ? parseFloat(price) : undefined,
          stock: stock ? parseInt(stock) : undefined,
          category,
          imageUrl,
          cloudinaryPublicId,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          supportLevel:
            supportLevel !== undefined ? supportLevel || null : undefined,
          packSize:
            packSize !== undefined
              ? packSize
                ? parseInt(packSize)
                : null
              : undefined,
          isPackProduct:
            isPackProduct !== undefined
              ? isPackProduct === "true" || isPackProduct === true
              : undefined,
          packType: packType !== undefined ? packType || null : undefined,
          // Add new nutrition facts files if any
          ...(newNutritionFactsFiles.length > 0 && {
            nutritionFacts: {
              create: newNutritionFactsFiles.map((nf, index) => ({
                fileUrl: nf.fileUrl,
                cloudinaryPublicId: nf.cloudinaryPublicId,
                fileName: nf.fileName,
                fileType: nf.fileType,
                displayOrder: nextDisplayOrder + index,
              })),
            },
          }),
        },
        include: {
          nutritionFacts: {
            orderBy: { displayOrder: "asc" },
          },
        },
      });

      // If flavors were provided, replace ProductFlavor set accordingly
      if (parsedFlavors) {
        await tx.productFlavor.deleteMany({ where: { productId: id } });
        for (const f of parsedFlavors) {
          const qty = Number((f as any)?.quantity ?? 1);
          const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
          const flavorName = String((f as any)?.name || "").trim();
          if (!flavorName) continue;
          const flavor = await resolveFlavorByNameOrAlias(flavorName);
          if (!flavor) continue; // Skip unknown flavors silently
          await tx.productFlavor.create({
            data: {
              productId: id,
              flavorId: flavor.id,
              quantity,
            },
          });
        }
      }

      return product;
    });

    res.json({ message: "Product updated successfully", product: updated });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ message: "Error updating product" });
  }
};

// Delete product (Admin only)
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        cloudinaryPublicId: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete product with cascading deletes for related records
    await prisma.$transaction(async (tx) => {
      // Delete ProductFlavor records first (though cascade should handle this)
      await tx.productFlavor.deleteMany({
        where: { productId: id },
      });

      // Delete CartItem records that reference this product
      await tx.cartItem.deleteMany({
        where: { productId: id },
      });

      // Delete OrderItem records that reference this product
      await tx.orderItem.deleteMany({
        where: { productId: id },
      });

      // Finally delete the product
      await tx.product.delete({
        where: { id },
      });
    });

    // Delete the product image from Cloudinary if it exists
    if (existingProduct.cloudinaryPublicId) {
      await deleteImageFile(null, existingProduct.cloudinaryPublicId);
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ message: "Error deleting product" });
  }
};

// Get all products for admin (including inactive)
export const getAllProductsForAdmin = async (req: Request, res: Response) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {}; // No isActive filter for admin

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
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
      }),
      prisma.product.count({ where }),
    ]);

    // Transform to include flavors and variations in a UI-friendly shape
    const transformedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sku: product.sku,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      supportLevel: product.supportLevel,
      packSize: product.packSize,
      nutritionFactsUrl: product.nutritionFactsUrl,
      nutritionFacts: product.nutritionFacts.map((nf) => ({
        id: nf.id,
        fileUrl: nf.fileUrl,
        fileName: nf.fileName,
        fileType: nf.fileType,
        displayOrder: nf.displayOrder,
      })),
      flavors: product.productFlavors.map((pf) => ({
        id: pf.flavor.id,
        name: pf.flavor.name,
        quantity: pf.quantity,
      })),
      variations: product.variations.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        isActive: v.isActive,
        images: v.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isDefault: img.isDefault,
        })),
        flavors: v.flavors.map((vf) => ({
          id: vf.flavor.id,
          name: vf.flavor.name,
          quantity: vf.quantity,
        })),
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    res.json({
      products: transformedProducts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    console.error("Get all products for admin error:", err);
    res.status(500).json({
      message: "Error fetching products",
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    });
  }
};

// Get product categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });

    const categoryList = categories.map((cat) => cat.category);
    res.json(categoryList);
  } catch (err) {
    res.status(500).json({ message: "Error fetching categories" });
  }
};

// Get all flavors (public endpoint for product management)
export const getAllFlavors = async (req: Request, res: Response) => {
  try {
    const flavors = await prisma.flavor.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        aliases: true,
        active: true,
      },
    });

    res.json({ flavors });
  } catch (err) {
    res.status(500).json({ message: "Error fetching flavors" });
  }
};

// Get products by packSize (for pack product selection)
export const getProductsByPackSize = async (req: Request, res: Response) => {
  try {
    const { packSize, category } = req.query;

    if (!packSize) {
      return res.status(400).json({
        message: "packSize query parameter is required",
      });
    }

    const packSizeNum = parseInt(packSize as string);
    if (isNaN(packSizeNum)) {
      return res.status(400).json({
        message: "packSize must be a valid number",
      });
    }

    const where: any = {
      isActive: true,
      packSize: packSizeNum,
      isPackProduct: false, // Exclude pack products themselves
    };

    // Optionally filter by category (e.g., "Sweet" or "Sour")
    if (category) {
      where.category = category as string;
    }

    // Debug logging
    console.log("getProductsByPackSize - Query params:", {
      packSize: packSizeNum,
      category: category || "all",
      where,
    });

    // Check total products matching criteria
    const totalMatching = await prisma.product.count({ where });
    console.log(
      "getProductsByPackSize - Total products matching criteria:",
      totalMatching
    );

    // Check products without filters to see what exists
    const allProductsWithPackSize = await prisma.product.findMany({
      where: { packSize: packSizeNum },
      select: {
        id: true,
        name: true,
        packSize: true,
        isPackProduct: true,
        isActive: true,
        category: true,
      },
    });
    console.log(
      "getProductsByPackSize - All products with packSize",
      packSizeNum,
      ":",
      allProductsWithPackSize
    );

    const products = await prisma.product.findMany({
      where,
      include: {
        variations: {
          where: { isActive: true },
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
        productFlavors: {
          include: {
            flavor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform products to match frontend structure
    const transformedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      sku: product.sku,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      supportLevel: product.supportLevel,
      packSize: product.packSize,
      isPackProduct: product.isPackProduct,
      packType: product.packType,
      variations: product.variations.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        isActive: v.isActive,
        images: v.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isDefault: img.isDefault,
        })),
        flavors: v.flavors.map((vf) => ({
          id: vf.flavor.id,
          name: vf.flavor.name,
          quantity: vf.quantity,
        })),
      })),
      flavors: product.productFlavors.map((pf) => ({
        id: pf.flavor.id,
        name: pf.flavor.name,
        quantity: pf.quantity,
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    res.json({ products: transformedProducts });
  } catch (err) {
    console.error("Get products by packSize error:", err);
    res.status(500).json({
      message: "Error fetching products by packSize",
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    });
  }
};

// Delete nutrition fact (Admin only)
export const deleteNutritionFact = async (req: Request, res: Response) => {
  try {
    const { nutritionFactId } = req.params;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Find the nutrition fact
    const nutritionFact = await prisma.productNutritionFact.findUnique({
      where: { id: nutritionFactId },
    });

    if (!nutritionFact) {
      return res.status(404).json({ message: "Nutrition fact not found" });
    }

    // Delete from Cloudinary if public ID exists
    if (nutritionFact.cloudinaryPublicId) {
      await deleteImageFile(null, nutritionFact.cloudinaryPublicId);
    }

    // Delete from database
    await prisma.productNutritionFact.delete({
      where: { id: nutritionFactId },
    });

    res.json({ message: "Nutrition fact deleted successfully" });
  } catch (err) {
    console.error("Delete nutrition fact error:", err);
    res.status(500).json({
      message: "Error deleting nutrition fact",
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    });
  }
};
