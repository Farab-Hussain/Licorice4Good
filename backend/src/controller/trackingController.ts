import { Request, Response } from "express";
import { prisma } from "../config/database";
import { logger } from "../utils/logger";

// Helper to generate unique referral code
function generateReferralCode(prefix: string = "AFF"): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${random}`;
}

/**
 * POST /api/tracking/events
 * Track events from frontend
 */
export const trackEvents = async (req: Request, res: Response) => {
  try {
    const { events, websiteId, sessionId } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "Events array is required" });
    }

    if (!websiteId) {
      return res.status(400).json({ error: "websiteId is required" });
    }

    // Ensure website exists (create if doesn't exist)
    let website = await prisma.website.findFirst({
      where: { id: websiteId },
    });

    if (!website) {
      // Try to find by domain or create new
      const domain = req.headers.origin || req.headers.referer;
      website = await prisma.website.create({
        data: {
          id: websiteId,
          name: websiteId,
          domain: domain || undefined,
        },
      });
    }

    // Save all events
    const savedEvents = await Promise.all(
      events.map((event: any) =>
        prisma.trackingEvent.create({
          data: {
            websiteId: website.id,
            sessionId: sessionId || event.sessionId,
            userId: event.userId,
            event: event.event || "unknown",
            data: event.data || {},
            page: event.page || {},
            device: event.device || {},
            browser: event.browser || {},
            timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
          },
        })
      )
    );

    logger.info(
      `Tracked ${savedEvents.length} events for website ${websiteId}`
    );

    res.status(200).json({
      success: true,
      message: `Tracked ${savedEvents.length} events`,
      count: savedEvents.length,
    });
  } catch (error) {
    logger.error("Error tracking events:", error);
    res.status(500).json({
      error: "Failed to track events",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * POST /api/tracking/click
 * Track referral clicks
 */
export const trackClick = async (req: Request, res: Response) => {
  try {
    const { referralCode, storeId, websiteId, url, referrer, userAgent } =
      req.body;

    if (!referralCode) {
      return res.status(400).json({ error: "referralCode is required" });
    }

    const siteId = websiteId || storeId;
    if (!siteId) {
      return res.status(400).json({
        error: "websiteId or storeId is required",
      });
    }

    // Ensure website exists
    let website = await prisma.website.findFirst({
      where: { id: siteId },
    });

    if (!website) {
      const domain = url ? new URL(url).hostname : undefined;
      website = await prisma.website.create({
        data: {
          id: siteId,
          name: siteId,
          domain: domain,
        },
      });
    }

    // Ensure referral code exists (create if doesn't exist)
    let referral = await prisma.referralCode.findUnique({
      where: { code: referralCode },
    });

    if (!referral) {
      referral = await prisma.referralCode.create({
        data: {
          code: referralCode,
          isActive: true,
        },
      });
    }

    // Track the click
    const click = await prisma.referralClick.create({
      data: {
        referralCode: referral.code,
        websiteId: website.id,
        url: url || undefined,
        referrer: referrer || undefined,
        userAgent: userAgent || req.headers["user-agent"] || undefined,
        ipAddress:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.ip ||
          undefined,
      },
    });

    logger.info(
      `Tracked click for referral code ${referralCode} on website ${siteId}`
    );

    res.status(200).json({
      success: true,
      message: "Click tracked successfully",
      clickId: click.id,
    });
  } catch (error) {
    logger.error("Error tracking click:", error);
    res.status(500).json({
      error: "Failed to track click",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * POST /api/tracking/order
 * Track referral orders/conversions
 */
export const trackOrder = async (req: Request, res: Response) => {
  try {
    const {
      referralCode,
      storeId,
      websiteId,
      orderId,
      orderValue,
      value,
      currency = "USD",
    } = req.body;

    if (!referralCode) {
      return res.status(400).json({ error: "referralCode is required" });
    }

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const orderAmount = orderValue || value || 0;
    const siteId = websiteId || storeId;

    // Log incoming request for debugging
    logger.info(`Tracking order request:`, {
      referralCode,
      orderId,
      orderValue,
      value,
      orderAmount,
      websiteId: siteId,
    });

    if (!orderAmount || orderAmount <= 0) {
      logger.error(`Invalid order amount: ${orderAmount}`, {
        referralCode,
        orderId,
        orderValue,
        value,
      });
      return res.status(400).json({
        error: "orderValue is required and must be greater than 0",
        received: { orderValue, value, calculated: orderAmount },
      });
    }

    if (!siteId) {
      return res.status(400).json({
        error: "websiteId or storeId is required",
      });
    }

    // Ensure website exists
    let website = await prisma.website.findFirst({
      where: { id: siteId },
    });

    if (!website) {
      website = await prisma.website.create({
        data: {
          id: siteId,
          name: siteId,
        },
      });
    }

    // Ensure referral code exists
    let referral = await prisma.referralCode.findUnique({
      where: { code: referralCode },
    });

    if (!referral) {
      referral = await prisma.referralCode.create({
        data: {
          code: referralCode,
          isActive: true,
        },
      });
    }

    // Check if order already tracked
    const existingOrder = await prisma.referralOrder.findFirst({
      where: {
        orderId: orderId,
        referralCode: referral.code,
      },
    });

    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: "Order already tracked",
        orderId: existingOrder.id,
      });
    }

    // Get commission rate from referral code (default 10% if not set)
    const commissionRate = referral.commissionRate || 0.1;
    const commission = orderAmount * commissionRate;

    // Log commission calculation for debugging
    logger.info(`Commission calculation:`, {
      referralCode: referral.code,
      orderAmount,
      commissionRate,
      commission,
      commissionPercentage: `${(commissionRate * 100).toFixed(2)}%`,
    });

    // Track the order
    const referralOrder = await prisma.referralOrder.create({
      data: {
        referralCode: referral.code,
        websiteId: website.id,
        orderId: orderId,
        orderValue: orderAmount,
        currency: currency,
        commission: commission,
        status: "pending",
      },
    });

    logger.info(
      `Tracked order ${orderId} for referral code ${referralCode} with value ${orderAmount}`
    );

    res.status(200).json({
      success: true,
      message: "Order tracked successfully",
      orderId: referralOrder.id,
      commission: commission,
    });
  } catch (error) {
    logger.error("Error tracking order:", error);
    res.status(500).json({
      error: "Failed to track order",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/tracking/stats
 * Get tracking statistics (for dashboard)
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const { websiteId, referralCode, startDate, endDate } = req.query;

    const where: any = {};

    if (websiteId) {
      where.websiteId = websiteId as string;
    }

    if (referralCode) {
      where.referralCode = referralCode as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get clicks count
    const clicksCount = await prisma.referralClick.count({ where });

    // Get orders count
    const ordersCount = await prisma.referralOrder.count({ where });

    // Get total order value
    const orders = await prisma.referralOrder.findMany({ where });
    const totalOrderValue = orders.reduce(
      (sum, order) => sum + order.orderValue,
      0
    );

    // Get total commission
    const totalCommission = orders.reduce(
      (sum, order) => sum + (order.commission || 0),
      0
    );

    res.status(200).json({
      success: true,
      stats: {
        clicks: clicksCount,
        orders: ordersCount,
        totalOrderValue,
        totalCommission,
        conversionRate: clicksCount > 0 ? (ordersCount / clicksCount) * 100 : 0,
      },
    });
  } catch (error) {
    logger.error("Error getting stats:", error);
    res.status(500).json({
      error: "Failed to get stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/tracking/dashboard
 * Get comprehensive dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) {
        dateFilter.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.timestamp.lte = new Date(endDate as string);
      }
    }

    // Get all referral codes (optionally filtered by userId)
    const referralCodesWhere: any = {};
    if (userId) {
      referralCodesWhere.userId = userId as string;
    }

    const referralCodes = await prisma.referralCode.findMany({
      where: referralCodesWhere,
      include: {
        clicks: {
          where: dateFilter,
        },
        orders: {
          where: dateFilter,
        },
      },
    });

    // Calculate stats per referral code
    const codeStats = referralCodes.map((code) => {
      const clicks = code.clicks.length;
      const orders = code.orders.length;
      const totalOrderValue = code.orders.reduce(
        (sum, order) => sum + order.orderValue,
        0
      );
      const totalCommission = code.orders.reduce(
        (sum, order) => sum + (order.commission || 0),
        0
      );

      return {
        code: code.code,
        commissionRate: code.commissionRate,
        clicks,
        orders,
        totalOrderValue,
        totalCommission,
        conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
        isActive: code.isActive,
        createdAt: code.createdAt,
      };
    });

    // Calculate overall stats
    const totalClicks = referralCodes.reduce(
      (sum, code) => sum + code.clicks.length,
      0
    );
    const totalOrders = referralCodes.reduce(
      (sum, code) => sum + code.orders.length,
      0
    );
    const overallOrderValue = referralCodes.reduce(
      (sum, code) =>
        sum +
        code.orders.reduce((orderSum, order) => orderSum + order.orderValue, 0),
      0
    );
    const overallCommission = referralCodes.reduce(
      (sum, code) =>
        sum +
        code.orders.reduce(
          (orderSum, order) => orderSum + (order.commission || 0),
          0
        ),
      0
    );

    res.status(200).json({
      success: true,
      overall: {
        totalClicks,
        totalOrders,
        totalOrderValue: overallOrderValue,
        totalCommission: overallCommission,
        conversionRate: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
      },
      byCode: codeStats,
    });
  } catch (error) {
    logger.error("Error getting dashboard stats:", error);
    res.status(500).json({
      error: "Failed to get dashboard stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * POST /api/tracking/referral-codes
 * Create a new referral code
 */
export const createReferralCode = async (req: Request, res: Response) => {
  try {
    const { code, userId, commissionRate = 0.1 } = req.body;

    let referralCode = code;
    if (!referralCode) {
      // Generate unique code
      let attempts = 0;
      do {
        referralCode = generateReferralCode();
        const existing = await prisma.referralCode.findUnique({
          where: { code: referralCode },
        });
        if (!existing) break;
        attempts++;
        if (attempts > 10) {
          return res.status(500).json({
            error: "Failed to generate unique referral code",
          });
        }
      } while (true);
    } else {
      // Check if code already exists
      const existing = await prisma.referralCode.findUnique({
        where: { code: referralCode },
      });
      if (existing) {
        return res.status(400).json({
          error: "Referral code already exists",
        });
      }
    }

    const referral = await prisma.referralCode.create({
      data: {
        code: referralCode,
        userId: userId || null,
        commissionRate: commissionRate,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Referral code created successfully",
      referralCode: referral,
    });
  } catch (error) {
    logger.error("Error creating referral code:", error);
    res.status(500).json({
      error: "Failed to create referral code",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/tracking/referral-codes
 * Get all referral codes
 */
export const getReferralCodes = async (req: Request, res: Response) => {
  try {
    const { userId, isActive } = req.query;

    const where: any = {};
    if (userId) {
      where.userId = userId as string;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const referralCodes = await prisma.referralCode.findMany({
      where,
      include: {
        _count: {
          select: {
            clicks: true,
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      referralCodes,
    });
  } catch (error) {
    logger.error("Error getting referral codes:", error);
    res.status(500).json({
      error: "Failed to get referral codes",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * PUT /api/tracking/referral-codes/:code
 * Update referral code (commission rate, active status)
 */
export const updateReferralCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { commissionRate, isActive } = req.body;

    const updateData: any = {};
    if (commissionRate !== undefined) {
      if (commissionRate < 0 || commissionRate > 1) {
        return res.status(400).json({
          error: "Commission rate must be between 0 and 1",
        });
      }
      updateData.commissionRate = commissionRate;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const referral = await prisma.referralCode.update({
      where: { code },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: "Referral code updated successfully",
      referralCode: referral,
    });
  } catch (error) {
    logger.error("Error updating referral code:", error);
    if ((error as any).code === "P2025") {
      return res.status(404).json({
        error: "Referral code not found",
      });
    }
    res.status(500).json({
      error: "Failed to update referral code",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
