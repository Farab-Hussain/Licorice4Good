"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { trackEcommerce } from "@/hooks/useTrackdeskEvent";

const ORANGE = "#FF5D39";
const YELLOW = "#F1A900";
const WHITE = "#FFFFFF";
const BLACK = "#000000";

function OrderSuccessContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [seconds, setSeconds] = useState(8);
  const { clearCart } = useCartStore();

  const orderId = search.get("order") || "";
  const sessionId = search.get("session_id") || "";

  // Track purchase completion with referral code
  useEffect(() => {
    if (!orderId && !sessionId) return;

    const trackPurchase = async () => {
      try {
        // Get stored referral code from sessionStorage (FIXED: was using localStorage)
        const getStoredReferralCode = () => {
          try {
            const stored = sessionStorage.getItem("trackdesk_referral_code");
            if (!stored) {
              return null;
            }

            const sessionData = JSON.parse(stored);
            const code = sessionData.code;

            // Verify code exists and is valid
            if (!code || typeof code !== "string") {
              sessionStorage.removeItem("trackdesk_referral_code");
              return null;
            }

            // Check if session is still valid (max 24 hours for same tab)
            const timestamp = new Date(sessionData.timestamp);
            const now = new Date();
            const hoursDiff =
              (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

            if (hoursDiff > 24) {
              // Session expired, clear it
              sessionStorage.removeItem("trackdesk_referral_code");
              console.log("[Trackdesk] ⚠️ Referral code session expired");
              return null;
            }

            return code;
          } catch (error) {
            console.error("[Trackdesk] Error reading referral code:", error);
            sessionStorage.removeItem("trackdesk_referral_code");
            return null;
          }
        };

        const referralCode = getStoredReferralCode();
        const apiUrl =
          process.env.NEXT_PUBLIC_TRACKDESK_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "";
        const websiteId = process.env.NEXT_PUBLIC_TRACKDESK_WEBSITE_ID || "";

        if (!apiUrl || !websiteId) {
          console.warn("[Trackdesk] API URL or Website ID not configured");
          return;
        }

        // Try to fetch order details from backend
        let orderValue = 0;
        let orderItems: Array<{
          id: string;
          name: string;
          price: number;
          quantity: number;
        }> = [];

        // Method 1: Try to fetch order by orderId
        if (orderId) {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`,
              { credentials: "include" }
            );

            if (response.ok) {
              const orderData = await response.json();
              const order = orderData.order || orderData;
              orderValue = order.total || 0;
              orderItems = (order.orderItems || []).map(
                (item: {
                  productId?: string;
                  product_id?: string;
                  productName?: string;
                  product_name?: string;
                  price?: number;
                  unit_price?: number;
                  quantity?: number;
                  qty?: number;
                }) => ({
                  id: item.productId || item.product_id || "",
                  name: item.productName || item.product_name || "",
                  price: item.price || item.unit_price || 0,
                  quantity: item.quantity || item.qty || 1,
                })
              );
              console.log("[Trackdesk] ✅ Order fetched from backend:", {
                orderId,
                orderValue,
                itemCount: orderItems.length,
              });
            }
          } catch (error) {
            console.error("[Trackdesk] Failed to fetch order details:", error);
          }
        }

        // Method 2: If orderValue is still 0, try to fetch from Stripe session
        if (orderValue === 0 && sessionId) {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/payments/session/${sessionId}`,
              { credentials: "include" }
            );

            if (response.ok) {
              const sessionData = await response.json();
              const session = sessionData.session || sessionData;

              // Stripe amounts are in cents, convert to dollars
              if (session.amount_total) {
                orderValue = session.amount_total / 100;
                console.log("[Trackdesk] ✅ Order value from Stripe session:", {
                  sessionId,
                  orderValue,
                  amountTotal: session.amount_total,
                });
              }

              // Try to get orderId from session metadata if not already set
              if (!orderId && session.metadata?.orderId) {
                const metadataOrderId = session.metadata.orderId;
                console.log(
                  "[Trackdesk] Found orderId in session metadata:",
                  metadataOrderId
                );
                // Optionally fetch order details with this orderId
              }
            }
          } catch (error) {
            console.error("[Trackdesk] Failed to fetch Stripe session:", error);
          }
        }

        // Method 3: Calculate from orderItems if we have them but no total
        if (orderValue === 0 && orderItems.length > 0) {
          orderValue = orderItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          console.log(
            "[Trackdesk] ✅ Calculated order value from items:",
            orderValue
          );
        }

        // Log final order value for debugging
        console.log("[Trackdesk] Final order value for tracking:", {
          orderId: orderId || sessionId,
          orderValue,
          itemCount: orderItems.length,
          hasReferralCode: !!referralCode,
        });

        // Track conversion via Trackdesk (for analytics)
        if (typeof window !== "undefined" && window.Trackdesk) {
          trackEcommerce.purchase({
            orderId: orderId || sessionId,
            value: orderValue,
            currency: "USD",
            items: orderItems,
          });
        }

        // Track order/conversion via API endpoint (for referral tracking)
        if (referralCode) {
          // Only track if we have a valid order value
          if (orderValue > 0) {
            const orderPayload = {
              referralCode: referralCode,
              websiteId: websiteId,
              storeId: websiteId,
              orderId: orderId || sessionId,
              orderValue: orderValue,
              value: orderValue,
              currency: "USD",
            };

            console.log("[Trackdesk] Sending order tracking request:", {
              referralCode,
              orderId: orderId || sessionId,
              orderValue,
            });

            const response = await fetch(`${apiUrl}/tracking/order`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(orderPayload),
            });

            if (response.ok) {
              const data = await response.json();
              console.log("[Trackdesk] ✅ Order tracked successfully:", data);
              console.log("[Trackdesk] Commission calculated:", {
                orderValue,
                commission: data.commission,
                commissionRate: data.commissionRate || "N/A",
              });
            } else {
              const errorText = await response.text();
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch {
                errorData = { message: errorText };
              }
              console.error(
                "[Trackdesk] ❌ Failed to track order:",
                response.status,
                errorData
              );
            }
          } else {
            console.warn(
              "[Trackdesk] ⚠️ Cannot track order: orderValue is 0 or invalid",
              {
                orderId: orderId || sessionId,
                orderValue,
                hasOrderId: !!orderId,
                hasSessionId: !!sessionId,
              }
            );
          }
        } else {
          console.log(
            "[Trackdesk] ℹ️ No referral code found - order not attributed to affiliate"
          );
        }
      } catch (error) {
        console.error("[Trackdesk] Error tracking purchase:", error);
      }
    };

    trackPurchase();
  }, [orderId, sessionId]);

  // Clear cart immediately on successful checkout
  useEffect(() => {
    const clearCartOnSuccess = async () => {
      try {
        console.log("🛒 Clearing cart after successful checkout");
        await clearCart();
        console.log("✅ Cart cleared successfully on success page");
      } catch (error) {
        console.error("⚠️ Failed to clear cart on success page:", error);
      }
    };

    clearCartOnSuccess();
  }, [clearCart]);

  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    const redirect = setTimeout(() => router.replace("/shop"), 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" />
      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl border p-6 text-center"
        style={{ background: WHITE, borderColor: "#F3F3F3" }}
      >
        <div
          className="mx-auto w-14 h-14 rounded-full mb-4 flex items-center justify-center"
          style={{ background: `${ORANGE}10` }}
        >
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ORANGE}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M12 22a10 10 0 110-20 10 10 0 010 20z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: BLACK }}>
          Payment Successful
        </h1>
        <p className="text-sm mb-4" style={{ color: BLACK, opacity: 0.8 }}>
          Thank you! Your order has been placed successfully.
        </p>
        <div className="text-xs mb-6" style={{ color: BLACK, opacity: 0.7 }}>
          {orderId && (
            <div>
              Order:{" "}
              <span className="font-semibold" style={{ color: BLACK }}>
                {orderId.slice(0, 8)}
              </span>
            </div>
          )}
          {sessionId && (
            <div>
              Session:{" "}
              <span className="font-mono" style={{ color: BLACK }}>
                {sessionId.slice(0, 10)}...
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.replace("/shop")}
            className="w-full sm:flex-1 font-semibold py-3 rounded-xl"
            style={{
              background: `linear-gradient(90deg, ${ORANGE}, ${YELLOW})`,
              color: WHITE,
              border: "none",
            }}
          >
            Continue Shopping
          </button>
          <button
            onClick={() => router.replace("/")}
            className="w-full sm:flex-1 font-semibold py-3 rounded-xl"
            style={{
              border: `2px solid ${ORANGE}`,
              color: ORANGE,
              background: WHITE,
            }}
          >
            Back to Home
          </button>
        </div>
        <p className="text-xs mt-4" style={{ color: BLACK, opacity: 0.6 }}>
          Redirecting to shop in {seconds}s…
        </p>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
              style={{ borderColor: ORANGE }}
            ></div>
            <p style={{ color: BLACK, opacity: 0.7 }}>Loading...</p>
          </div>
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
