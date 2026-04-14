import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { validateFlavor } from "../utils/skuGenerator";

const prisma = new PrismaClient();

// Helper function to delete image from Cloudinary
const deleteImageFile = async (publicId: string | null) => {
  if (!publicId) return;
  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

// Create variation for a product
export const createVariation = async (req: Request, res: Response) => {
  try {
    console.log("=== Create Variation Request ===");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("Body type:", typeof req.body);

    const { productId } = req.params;

    // Get data from body (parsed by multer) or from req.body
    // Multer puts non-file fields in req.body
    const name = req.body?.name;
    const isActive = req.body?.isActive;

    // Parse flavors from FormData (it comes as a JSON string)
    let flavors: Array<{ name?: string; quantity?: number }> = [];
    try {
      const rawFlavors = (req.body as any).flavors;
      console.log("Raw flavors from body:", rawFlavors);
      console.log("Raw flavors type:", typeof rawFlavors);

      if (rawFlavors) {
        if (Array.isArray(rawFlavors)) {
          flavors = rawFlavors as any[];
          console.log("Flavors is already an array");
        } else {
          const parsed = JSON.parse(String(rawFlavors));
          flavors = Array.isArray(parsed) ? parsed : [];
          console.log("Parsed flavors from JSON string:", flavors);
        }
      } else {
        console.log("No flavors in request body");
      }
    } catch (parseError) {
      console.error("Error parsing flavors:", parseError);
      flavors = [];
    }

    console.log("Final flavors array:", flavors);

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (!name || !productId) {
      return res
        .status(400)
        .json({ message: "Name and productId are required" });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if variation with same name already exists
    const existingVariation = await prisma.productVariation.findFirst({
      where: {
        productId,
        name: name.trim(),
      },
    });

    if (existingVariation) {
      return res.status(400).json({
        message: "Variation with this name already exists for this product",
      });
    }

    // Generate SKU
    const sku = `VAR-${product.sku || productId.substring(0, 8)}-${name
      .substring(0, 3)
      .toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Validate all flavors BEFORE the transaction to avoid timeout
    const validatedFlavors: Array<{
      flavorId: string;
      quantity: number;
      name: string;
    }> = [];
    if (Array.isArray(flavors) && flavors.length > 0) {
      console.log("Validating flavors before transaction:", flavors);
      for (const f of flavors) {
        const flavorName = String(f?.name || "").trim();
        if (!flavorName) {
          console.log("Skipping flavor with empty name");
          continue;
        }

        console.log(`Looking up flavor: "${flavorName}"`);
        const flavor = await validateFlavor(flavorName);
        if (!flavor) {
          console.log(`Flavor "${flavorName}" not found in database`);
          continue;
        }

        const quantity = Number(f?.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          console.log(
            `Invalid quantity for flavor "${flavorName}": ${quantity}`
          );
          continue;
        }

        validatedFlavors.push({
          flavorId: flavor.id,
          quantity,
          name: flavorName,
        });
      }
      console.log(
        `Validated ${validatedFlavors.length} flavors before transaction`
      );
    }

    // Use longer timeout for transaction (15 seconds instead of default 5)
    const result = await prisma.$transaction(
      async (tx) => {
        // Create variation
        const variation = await tx.productVariation.create({
          data: {
            productId,
            name: name.trim(),
            sku,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
          },
        });

        // Add flavors if provided (already validated)
        if (validatedFlavors.length > 0) {
          console.log(
            "Processing validated flavors in transaction:",
            validatedFlavors
          );
          for (const validatedFlavor of validatedFlavors) {
            console.log(
              `Adding flavor "${validatedFlavor.name}" with quantity ${validatedFlavor.quantity} to variation`
            );
            await tx.productVariationFlavor.create({
              data: {
                variationId: variation.id,
                flavorId: validatedFlavor.flavorId,
                quantity: validatedFlavor.quantity,
              },
            });
          }
        }

        return variation;
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot
        timeout: 15000, // Maximum time the transaction can run (15 seconds)
      }
    );

    // Fetch complete variation with relations
    const completeVariation = await prisma.productVariation.findUnique({
      where: { id: result.id },
      include: {
        images: true,
        flavors: {
          include: {
            flavor: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Variation created successfully",
      variation: completeVariation,
    });
  } catch (err: any) {
    console.error("Create variation error:", err);
    console.error("Error stack:", err?.stack);
    console.error("Request body:", req.body);
    console.error("Request params:", req.params);
    res.status(500).json({
      message: "Error creating variation",
      error: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
};

// Get all variations for a product
export const getProductVariations = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const variations = await prisma.productVariation.findMany({
      where: { productId },
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
    });

    res.json({ variations });
  } catch (err) {
    console.error("Get variations error:", err);
    res.status(500).json({ message: "Error fetching variations" });
  }
};

// Get single variation by ID
export const getVariationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const variation = await prisma.productVariation.findUnique({
      where: { id },
      include: {
        product: true,
        images: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
        flavors: {
          include: {
            flavor: true,
          },
        },
      },
    });

    if (!variation) {
      return res.status(404).json({ message: "Variation not found" });
    }

    res.json(variation);
  } catch (err) {
    console.error("Get variation error:", err);
    res.status(500).json({ message: "Error fetching variation" });
  }
};

// Update variation
export const updateVariation = async (req: Request, res: Response) => {
  try {
    console.log("=== Update Variation Request ===");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("Body type:", typeof req.body);

    const { id } = req.params;
    const name = req.body?.name;
    const isActive = req.body?.isActive;

    // Parse flavors from FormData (it comes as a JSON string)
    let flavors: Array<{ name?: string; quantity?: number }> = [];
    try {
      const rawFlavors = (req.body as any).flavors;
      console.log("Raw flavors from body:", rawFlavors);
      console.log("Raw flavors type:", typeof rawFlavors);

      if (rawFlavors) {
        if (Array.isArray(rawFlavors)) {
          flavors = rawFlavors as any[];
          console.log("Flavors is already an array");
        } else {
          const parsed = JSON.parse(String(rawFlavors));
          flavors = Array.isArray(parsed) ? parsed : [];
          console.log("Parsed flavors from JSON string:", flavors);
        }
      } else {
        console.log("No flavors in request body");
      }
    } catch (parseError) {
      console.error("Error parsing flavors:", parseError);
      flavors = [];
    }

    console.log("Final flavors array:", flavors);

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if variation exists
    const existingVariation = await prisma.productVariation.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!existingVariation) {
      return res.status(404).json({ message: "Variation not found" });
    }

    // Check if name is being changed and conflicts with another variation
    if (name && name.trim() !== existingVariation.name) {
      const conflictingVariation = await prisma.productVariation.findFirst({
        where: {
          productId: existingVariation.productId,
          name: name.trim(),
          id: { not: id },
        },
      });

      if (conflictingVariation) {
        return res.status(400).json({
          message: "Variation with this name already exists for this product",
        });
      }
    }

    // Validate all flavors BEFORE the transaction to avoid timeout
    const validatedFlavors: Array<{
      flavorId: string;
      quantity: number;
      name: string;
    }> = [];
    if (Array.isArray(flavors) && flavors.length > 0) {
      console.log("Validating flavors before transaction:", flavors);
      for (const f of flavors) {
        const flavorName = String(f?.name || "").trim();
        if (!flavorName) {
          console.log("Skipping flavor with empty name");
          continue;
        }

        console.log(`Looking up flavor: "${flavorName}"`);
        const flavor = await validateFlavor(flavorName);
        if (!flavor) {
          console.log(`Flavor "${flavorName}" not found in database`);
          continue;
        }

        const quantity = Number(f?.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          console.log(
            `Invalid quantity for flavor "${flavorName}": ${quantity}`
          );
          continue;
        }

        validatedFlavors.push({
          flavorId: flavor.id,
          quantity,
          name: flavorName,
        });
      }
      console.log(
        `Validated ${validatedFlavors.length} flavors before transaction`
      );
    }

    // Use longer timeout for transaction (15 seconds instead of default 5)
    const result = await prisma.$transaction(
      async (tx) => {
        // Update variation
        const variation = await tx.productVariation.update({
          where: { id },
          data: {
            name: name ? name.trim() : undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          },
        });

        // Update flavors if provided
        if (validatedFlavors.length > 0) {
          console.log(
            "Processing validated flavors in transaction:",
            validatedFlavors
          );
          // Delete existing flavors
          await tx.productVariationFlavor.deleteMany({
            where: { variationId: id },
          });

          // Add new flavors (already validated)
          for (const validatedFlavor of validatedFlavors) {
            console.log(
              `Adding flavor "${validatedFlavor.name}" with quantity ${validatedFlavor.quantity} to variation`
            );
            await tx.productVariationFlavor.create({
              data: {
                variationId: id,
                flavorId: validatedFlavor.flavorId,
                quantity: validatedFlavor.quantity,
              },
            });
          }
        } else if (Array.isArray(flavors) && flavors.length === 0) {
          // If flavors is explicitly an empty array, delete all existing flavors
          console.log("Flavors array is empty, deleting all existing flavors");
          await tx.productVariationFlavor.deleteMany({
            where: { variationId: id },
          });
        }

        return variation;
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot
        timeout: 15000, // Maximum time the transaction can run (15 seconds)
      }
    );

    // Fetch complete variation with relations
    const completeVariation = await prisma.productVariation.findUnique({
      where: { id: result.id },
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
    });

    res.json({
      message: "Variation updated successfully",
      variation: completeVariation,
    });
  } catch (err: any) {
    console.error("Update variation error:", err);
    console.error("Error stack:", err?.stack);
    console.error("Request body:", req.body);
    console.error("Request params:", req.params);
    console.error("Error details:", {
      message: err?.message,
      code: err?.code,
      statusCode: err?.statusCode,
      name: err?.name,
    });
    res.status(500).json({
      message: "Error updating variation",
      error: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
};

// Delete variation
export const deleteVariation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get variation with images to delete from Cloudinary
    const variation = await prisma.productVariation.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!variation) {
      return res.status(404).json({ message: "Variation not found" });
    }

    // Delete variation (cascade will handle related records)
    await prisma.productVariation.delete({
      where: { id },
    });

    // Delete images from Cloudinary
    for (const image of variation.images) {
      if (image.cloudinaryPublicId) {
        await deleteImageFile(image.cloudinaryPublicId);
      }
    }

    res.json({ message: "Variation deleted successfully" });
  } catch (err) {
    console.error("Delete variation error:", err);
    res.status(500).json({ message: "Error deleting variation" });
  }
};

// Add image to variation
export const addVariationImage = async (req: Request, res: Response) => {
  try {
    console.log("=== Add Variation Image Request ===");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("File:", req.file ? "Present" : "Missing");
    console.log("Files:", (req as any).files ? "Present" : "Missing");

    const { id } = req.params;
    const { isDefault, replaceExisting } = req.body;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Handle both single file and files array
    const file =
      req.file ||
      ((req as any).files &&
        (req as any).files.productImage &&
        (req as any).files.productImage[0]);

    if (!file) {
      console.error("No file provided in request");
      return res.status(400).json({ message: "Image file is required" });
    }

    console.log("File details:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Check if variation exists
    const variation = await prisma.productVariation.findUnique({
      where: { id },
      include: {
        images: {
          where: { isDefault: true },
        },
      },
    });

    if (!variation) {
      return res.status(404).json({ message: "Variation not found" });
    }

    // If replacing existing default image, delete old one first
    if (replaceExisting === "true" || replaceExisting === true) {
      const existingDefaultImages = variation.images.filter(
        (img) => img.isDefault
      );
      for (const oldImage of existingDefaultImages) {
        console.log("Deleting old default image:", oldImage.id);
        // Delete from database
        await prisma.productVariationImage.delete({
          where: { id: oldImage.id },
        });
        // Delete from Cloudinary
        if (oldImage.cloudinaryPublicId) {
          await deleteImageFile(oldImage.cloudinaryPublicId);
        }
      }
    }

    // Upload image to Cloudinary
    console.log("Uploading image to Cloudinary...");
    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(file, "variations");
      console.log("Cloudinary upload successful:", {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
      });
    } catch (uploadError: any) {
      console.error("Cloudinary upload error:", uploadError);
      const errorMessage = uploadError?.message || "Unknown error";

      // Provide user-friendly error messages
      if (
        errorMessage.includes("too large") ||
        errorMessage.includes("File size")
      ) {
        return res.status(400).json({
          message:
            "Image file is too large. Maximum size is 10MB. Please compress the image or use a smaller file.",
          error:
            process.env.NODE_ENV === "development" ? errorMessage : undefined,
        });
      }

      return res.status(500).json({
        message: errorMessage.includes("Failed to process")
          ? errorMessage
          : "Error uploading image to Cloudinary",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }

    // If this is set as default, unset other defaults
    if (isDefault === "true" || isDefault === true) {
      await prisma.productVariationImage.updateMany({
        where: {
          variationId: id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create image record
    console.log("Creating image record in database...");
    const image = await prisma.productVariationImage.create({
      data: {
        variationId: id,
        imageUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.public_id,
        isDefault: isDefault === "true" || isDefault === true,
      },
    });

    console.log("Image added successfully:", image.id);

    res.status(201).json({
      message: "Image added successfully",
      image,
    });
  } catch (err: any) {
    console.error("Add variation image error:", err);
    console.error("Error stack:", err?.stack);
    console.error("Error details:", {
      message: err?.message,
      code: err?.code,
      statusCode: err?.statusCode,
    });
    res.status(500).json({
      message: "Error adding image",
      error: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
};

// Delete variation image
export const deleteVariationImage = async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get image to delete from Cloudinary
    const image = await prisma.productVariationImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Delete image record
    await prisma.productVariationImage.delete({
      where: { id: imageId },
    });

    // Delete from Cloudinary
    if (image.cloudinaryPublicId) {
      await deleteImageFile(image.cloudinaryPublicId);
    }

    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("Delete variation image error:", err);
    res.status(500).json({ message: "Error deleting image" });
  }
};

// Set default image for variation
export const setDefaultVariationImage = async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get image to find variation
    const image = await prisma.productVariationImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Unset all defaults for this variation
    await prisma.productVariationImage.updateMany({
      where: {
        variationId: image.variationId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this image as default
    const updatedImage = await prisma.productVariationImage.update({
      where: { id: imageId },
      data: {
        isDefault: true,
      },
    });

    res.json({
      message: "Default image set successfully",
      image: updatedImage,
    });
  } catch (err) {
    console.error("Set default image error:", err);
    res.status(500).json({ message: "Error setting default image" });
  }
};
