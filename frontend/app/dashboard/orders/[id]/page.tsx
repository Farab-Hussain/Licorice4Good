"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import apiClient from "@/utils/axios";
import { useUser } from "@/hooks/useUser";
import { ExternalLink } from "lucide-react";

type OrderItem = {
  id: string;
  productId: string;
  variationId?: string | null;
  quantity: number;
  price: number;
  total?: number;
  customPackName?: string | null;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    sku?: string | null;
    packSize?: number | null;
  };
  variation?: {
    id: string;
    name: string;
    sku?: string | null;
  };
  packItems?: Array<{
    name: string;
    variation: string;
    packSize: number | null;
  }>;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt?: string;
  orderNotes?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null };
  guestEmail?: string | null;
  guestId?: string | null;
  orderItems?: OrderItem[];
  shippingAddress?: {
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    name?: string;
    phone?: string;
  };
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippingCarrier?: string | null;
  shippingService?: string | null;
  shippingCost?: number | null;
  shipmentId?: string | null;
  shippingLabelUrl?: string | null;
  shippingStatus?: string | null;
};

const AdminOrderDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "admin")) {
      router.replace("/");
      return;
    }

    if (user && user.role === "admin" && orderId) {
      fetchOrder();
    }
  }, [user, userLoading, orderId, router]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get(`/orders/${orderId}`);
      setOrder(data);
    } catch (err: unknown) {
      console.error("Error fetching order:", err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  // Group order items for display (same logic as email)
  const groupedItems = useMemo(() => {
    if (!order?.orderItems) return [];

    type GroupedItem = {
      isPackProduct: boolean;
      packType?: string;
      quantity?: number;
      price?: number;
      total?: number;
      variations?: Array<{
        productName: string;
        variationName: string;
        packSize: number;
        price: number;
        imageUrl?: string | null;
        productId?: string;
        item?: OrderItem;
      }>;
      item?: OrderItem;
      packItems?: Array<{
        name: string;
        variation: string;
        packSize: number | null;
      }>;
      originalItems?: OrderItem[]; // Store all original items for pack products
    };

    const items = [...order.orderItems];
    const processed = new Set<number>();
    const grouped: GroupedItem[] = [];

    // Group items by quantity first
    const itemsByQuantity = new Map<
      number,
      Array<{ item: OrderItem; index: number }>
    >();
    items.forEach((item, index) => {
      if (!itemsByQuantity.has(item.quantity)) {
        itemsByQuantity.set(item.quantity, []);
      }
      itemsByQuantity.get(item.quantity)!.push({ item, index });
    });

    // Process each quantity group
    itemsByQuantity.forEach((itemsWithIndices, quantity) => {
      const packItems = itemsWithIndices.filter(({ item }) => {
        const itemProduct = item.product;
        const hasVariation = item.variation || item.variationId;
        const isPackSizeProduct =
          itemProduct &&
          (itemProduct.packSize === 3 ||
            itemProduct.packSize === 4 ||
            itemProduct.name?.includes("3-Pack") ||
            itemProduct.name?.includes("4-Pack"));
        return isPackSizeProduct && hasVariation;
      });

      if (packItems.length === 0) {
        itemsWithIndices.forEach(({ item, index }) => {
          if (!processed.has(index)) {
            grouped.push({
              isPackProduct: false,
              item: item,
            });
            processed.add(index);
          }
        });
        return;
      }

      const threePackItems = packItems.filter(
        ({ item }) =>
          item.product?.packSize === 3 || item.product?.name?.includes("3-Pack")
      );
      const fourPackItems = packItems.filter(
        ({ item }) =>
          item.product?.packSize === 4 || item.product?.name?.includes("4-Pack")
      );

      if (threePackItems.length > 0 && fourPackItems.length > 0) {
        const allGoldItems = [...threePackItems, ...fourPackItems];
        allGoldItems.forEach(({ index }) => processed.add(index));

        const variations = allGoldItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize: item.product?.packSize || 0,
          price: item.price || 0,
          imageUrl: item.product?.imageUrl || null,
          productId: item.productId,
          item: item,
        }));

        grouped.push({
          isPackProduct: true,
          packType: "7 Pack Sweet and Sour collection Gold",
          quantity: quantity,
          variations: variations,
          price:
            allGoldItems.reduce((sum, { item }) => sum + (item.price || 0), 0) /
            allGoldItems.length,
          originalItems: allGoldItems.map(({ item }) => item),
        });
        return;
      }

      if (threePackItems.length > 0 && fourPackItems.length === 0) {
        threePackItems.forEach(({ index }) => processed.add(index));

        const variations = threePackItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize: 3,
          price: item.price || 0,
          imageUrl: item.product?.imageUrl || null,
          productId: item.productId,
          item: item,
        }));

        grouped.push({
          isPackProduct: true,
          packType: "12 Pack Best Seller and Classic Platinum",
          quantity: quantity,
          variations: variations,
          price:
            threePackItems.reduce(
              (sum, { item }) => sum + (item.price || 0),
              0
            ) / threePackItems.length,
          originalItems: threePackItems.map(({ item }) => item),
        });
        return;
      }

      packItems.forEach(({ item, index }) => {
        if (!processed.has(index)) {
          grouped.push({
            isPackProduct: false,
            item: item,
          });
          processed.add(index);
        }
      });
    });

    items.forEach((item, index) => {
      if (!processed.has(index)) {
        grouped.push({
          isPackProduct: false,
          item: item,
        });
        processed.add(index);
      }
    });

    return grouped;
  }, [order?.orderItems]);

  // Calculate subtotal
  const subtotal = useMemo(() => {
    if (!order?.orderItems) return 0;
    return order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }, [order?.orderItems]);

  // Format date
  const formattedDate = useMemo(() => {
    if (!order?.createdAt) return "";
    const date = new Date(order.createdAt);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [order?.createdAt]);

  const formattedTime = useMemo(() => {
    if (!order?.createdAt) return "";
    const date = new Date(order.createdAt);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [order?.createdAt]);

  // Normalize image URL
  const normalizeImageSrc = useCallback((src?: string | null) => {
    if (!src) return "/assets/images/slider.png";
    if (src.startsWith("/assets")) return src;
    if (src.startsWith("/uploads") || src.startsWith("uploads")) {
      const path = src.startsWith("/uploads") ? src : `/${src}`;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      return apiUrl ? `${apiUrl}${path}` : path;
    }
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return apiUrl
      ? `${apiUrl}/${src.startsWith("/") ? src.slice(1) : src}`
      : src;
  }, []);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Order not found"}</p>
          <button
            onClick={() => router.push("/dashboard/orders")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/orders")}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Orders
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Order {order.id}
              </h1>
              <p className="text-sm text-gray-600">
                Placed on {formattedDate} at {formattedTime}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  order.status === "confirmed"
                    ? "border-2 border-blue-600 text-blue-600 bg-white"
                    : "border-2 border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                }`}
              >
                CONFIRMED
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  order.paymentStatus === "paid" ||
                  order.paymentStatus === "completed"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                COMPLETED
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {groupedItems.length > 0 ? (
                  groupedItems.map((group, idx) => {
                    if (group.isPackProduct) {
                      // Get the first variation's product image as the main image
                      const firstVariation = group.variations?.[0];
                      const mainImage =
                        firstVariation?.imageUrl ||
                        firstVariation?.item?.product?.imageUrl ||
                        group.originalItems?.[0]?.product?.imageUrl ||
                        null;

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
                        >
                          {/* Main Product Image */}
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={normalizeImageSrc(mainImage)}
                              alt={group.packType || "Pack Product"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-base mb-1">
                              {group.packType}
                            </h3>
                            {group.variations &&
                              group.variations.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {group.variations.map((variation, vIdx) => (
                                    <div
                                      key={vIdx}
                                      className="text-sm text-gray-600"
                                    >
                                      • {variation.variationName}
                                    </div>
                                  ))}
                                </div>
                              )}
                            <div className="flex items-center gap-4 mt-3">
                              <span className="text-sm text-gray-600">
                                Quantity: {group.quantity || 1}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                $
                                {(
                                  (group.price || 0) * (group.quantity || 1)
                                ).toFixed(2)}{" "}
                                each
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const item = group.item;
                      if (!item) return null;
                      const productName =
                        item.customPackName ||
                        item.product?.name ||
                        `Product #${item.productId}`;
                      const imageUrl = normalizeImageSrc(
                        item.product?.imageUrl
                      );

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={imageUrl}
                              alt={productName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-base mb-1">
                              {productName}
                            </h3>
                            {item.variation && (
                              <div className="text-sm text-gray-600 mb-2">
                                Variation: {item.variation.name}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-3">
                              <span className="text-sm text-gray-600">
                                Quantity: {item.quantity}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                ${item.price.toFixed(2)} each
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                ) : (
                  <p className="text-gray-500">No items found</p>
                )}
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {order.shippingCost && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-semibold text-gray-900">
                      ${order.shippingCost.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-gray-900">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Shippo Tracking */}
            {(order.trackingNumber ||
              order.shippingCarrier ||
              order.shippingService) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Shippo Tracking
                </h2>
                <div className="space-y-3">
                  {order.shippingCarrier && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Carrier:
                      </span>
                      <span className="text-sm text-gray-900 ml-2">
                        {order.shippingCarrier}
                      </span>
                    </div>
                  )}
                  {order.shippingService && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Service:
                      </span>
                      <span className="text-sm text-gray-900 ml-2">
                        {order.shippingService}
                      </span>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Tracking Number:
                      </span>
                      <span className="text-sm text-gray-900 ml-2 font-mono">
                        {order.trackingNumber}
                      </span>
                    </div>
                  )}
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Track on Shippo
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 1/3 width */}
          <div className="lg:col-span-1 space-y-6">
            {/* Customer */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Customer</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Order Type:
                  </span>
                  <span className="text-sm text-gray-900 ml-2">
                    {order.user ? "Registered User" : "Guest Order"}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Email:
                  </span>
                  <span className="text-sm text-gray-900 ml-2 break-all">
                    {order.user?.email || order.guestEmail || "No email"}
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Shipping Address
                </h2>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>{order.shippingAddress.name || ""}</p>
                  <p>{order.shippingAddress.street1}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    {order.shippingAddress.zip}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                  {order.shippingAddress.phone && (
                    <p className="mt-2">Phone: {order.shippingAddress.phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Status:
                  </span>
                  <span
                    className={`text-sm font-semibold ml-2 ${
                      order.paymentStatus === "paid" ||
                      order.paymentStatus === "completed"
                        ? "text-green-600"
                        : "text-gray-900"
                    }`}
                  >
                    {order.paymentStatus === "paid" ||
                    order.paymentStatus === "completed"
                      ? "COMPLETED"
                      : order.paymentStatus.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Via:
                  </span>
                  <span className="text-sm text-gray-900 ml-2">Stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
