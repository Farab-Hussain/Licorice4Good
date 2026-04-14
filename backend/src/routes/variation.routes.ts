import express from "express";
import {
  createVariation,
  getProductVariations,
  getVariationById,
  updateVariation,
  deleteVariation,
  addVariationImage,
  deleteVariationImage,
  setDefaultVariationImage,
} from "../controller/variationController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";
import {
  uploadProductImage,
  parseFormData,
  handleUploadError,
} from "../middlewares/upload.middleware";

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(adminOnly);

// Variation CRUD routes
router.post(
  "/product/:productId",
  parseFormData, // Parse multipart/form-data (variations don't include images in creation, images are added separately)
  handleUploadError,
  createVariation
);
router.get("/product/:productId", getProductVariations);
router.get("/:id", getVariationById);
router.put(
  "/:id",
  parseFormData, // Parse multipart/form-data for variation updates
  handleUploadError,
  updateVariation
);
router.delete("/:id", deleteVariation);

// Variation image routes
router.post(
  "/:id/images",
  uploadProductImage,
  handleUploadError,
  addVariationImage
);
router.delete("/images/:imageId", deleteVariationImage);
router.put("/images/:imageId/default", setDefaultVariationImage);

export default router;
