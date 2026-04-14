import { Router } from "express";
import {
  trackEvents,
  trackClick,
  trackOrder,
  getStats,
  getDashboardStats,
  createReferralCode,
  updateReferralCode,
  getReferralCodes,
} from "../controller/trackingController";

const router = Router();

// Track events from frontend
router.post("/events", trackEvents);

// Track referral clicks
router.post("/click", trackClick);

// Track referral orders/conversions
router.post("/order", trackOrder);

// Get tracking statistics
router.get("/stats", getStats);

// Get comprehensive dashboard statistics
router.get("/dashboard", getDashboardStats);

// Referral code management
router.post("/referral-codes", createReferralCode);
router.get("/referral-codes", getReferralCodes);
router.put("/referral-codes/:code", updateReferralCode);

export default router;
