import { Router } from "express";
import {
  subscribeEmail,
  unsubscribeEmail,
  getSubscriptions,
} from "../controller/subscriptionController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = Router();

// Public routes
router.post("/subscribe", subscribeEmail);
router.post("/unsubscribe", unsubscribeEmail);

// Admin routes (protected)
router.get("/subscriptions", protect, adminOnly, getSubscriptions);

export default router;

