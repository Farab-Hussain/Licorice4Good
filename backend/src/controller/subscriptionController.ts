import { Request, Response } from "express";
import { prisma } from "../config/database";
import {
  sendSubscriptionConfirmationEmail,
  sendAdminSubscriptionNotification,
} from "../utils/mailer";

/**
 * POST /api/subscribe
 * Subscribe email to newsletter
 */
export const subscribeEmail = async (req: Request, res: Response) => {
  try {
    const { email, source } = req.body;

    // Validate email
    if (!email || !email.includes("@")) {
      return res.status(400).json({
        error: "Valid email address is required",
      });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existingSubscription = await prisma.emailSubscription.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingSubscription) {
      // If already subscribed but inactive, reactivate
      if (!existingSubscription.isActive) {
        await prisma.emailSubscription.update({
          where: { email: normalizedEmail },
          data: {
            isActive: true,
            source: source || existingSubscription.source || "footer",
            updatedAt: new Date(),
          },
        });

        // Send confirmation email
        try {
          await sendSubscriptionConfirmationEmail(normalizedEmail);
        } catch (emailError) {
          console.error("Error sending confirmation email:", emailError);
          // Don't fail the subscription if email fails
        }

        // Send admin notification
        try {
          await sendAdminSubscriptionNotification(
            normalizedEmail,
            source || "footer"
          );
        } catch (adminEmailError) {
          console.error("Error sending admin notification:", adminEmailError);
          // Don't fail the subscription if admin email fails
        }

        return res.status(200).json({
          success: true,
          message: "Email subscription reactivated successfully",
          email: normalizedEmail,
        });
      }

      // Already subscribed and active - return success but with info message
      return res.status(200).json({
        success: true,
        message: "Email is already subscribed",
        email: normalizedEmail,
        alreadySubscribed: true,
      });
    }

    // Create new subscription
    const subscription = await prisma.emailSubscription.create({
      data: {
        email: normalizedEmail,
        source: source || "footer",
        isActive: true,
      },
    });

    // Send confirmation email to user
    try {
      await sendSubscriptionConfirmationEmail(normalizedEmail);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Don't fail the subscription if email fails
    }

    // Send admin notification
    try {
      await sendAdminSubscriptionNotification(
        normalizedEmail,
        source || "footer"
      );
    } catch (adminEmailError) {
      console.error("Error sending admin notification:", adminEmailError);
      // Don't fail the subscription if admin email fails
    }

    console.log(`✅ New email subscription: ${normalizedEmail} (source: ${source || "footer"})`);

    res.status(201).json({
      success: true,
      message: "Email subscribed successfully",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Error subscribing email:", error);
    res.status(500).json({
      error: "Failed to subscribe email",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * POST /api/unsubscribe
 * Unsubscribe email from newsletter
 */
export const unsubscribeEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        error: "Valid email address is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const subscription = await prisma.emailSubscription.findUnique({
      where: { email: normalizedEmail },
    });

    if (!subscription) {
      return res.status(404).json({
        error: "Email not found in subscriptions",
      });
    }

    if (!subscription.isActive) {
      return res.status(200).json({
        success: true,
        message: "Email is already unsubscribed",
      });
    }

    await prisma.emailSubscription.update({
      where: { email: normalizedEmail },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Email unsubscribed: ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: "Email unsubscribed successfully",
    });
  } catch (error) {
    console.error("Error unsubscribing email:", error);
    res.status(500).json({
      error: "Failed to unsubscribe email",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/subscriptions
 * Get all active subscriptions (admin only)
 */
export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const { active, page = 1, limit = 50 } = req.query;

    const where: any = {};
    if (active !== undefined) {
      where.isActive = active === "true";
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [subscriptions, total] = await Promise.all([
      prisma.emailSubscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.emailSubscription.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({
      error: "Failed to fetch subscriptions",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

