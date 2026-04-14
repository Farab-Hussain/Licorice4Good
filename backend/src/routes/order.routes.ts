import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  bulkUpdateOrders,
  bulkDeleteOrders,
  exportOrdersCSV,
} from "../controller/orderController";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = express.Router();

// Create order supports guest checkout
router.post("/", optionalAuth, createOrder);

// Get user's orders (requires authentication)
router.get("/", protect, getUserOrders);

// Admin routes (admin role required) - must come before /:id to avoid conflicts
router.get("/admin/all", protect, adminOnly, getAllOrders);
router.get("/admin/export-csv", protect, adminOnly, exportOrdersCSV);
router.put("/admin/bulk-update", protect, adminOnly, bulkUpdateOrders);
router.delete("/admin/bulk-delete", protect, adminOnly, bulkDeleteOrders);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);

// Track order by ID (public - no authentication required)
router.get("/:id", getOrderById);

export default router;
