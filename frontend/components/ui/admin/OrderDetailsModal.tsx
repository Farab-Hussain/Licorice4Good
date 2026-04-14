"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import apiClient from "@/utils/axios";

type Order = {
  id: string;
  userId: string | null;
  guestId?: string | null;
  guestEmail?: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt?: string;
  orderNotes?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null };
  orderItems?: Array<{
    id: string;
    productId: string;
    variationId?: string | null;
    quantity: number;
    price: number;
    flavorIds?: string[];
    customPackName?: string;
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
  }>;
  shippingAddress?: {
    street1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  shipmentId?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippingLabelUrl?: string | null;
  shippingStatus?: string | null;
  shippingCarrier?: string | null;
  shippingService?: string | null;
  shippingCost?: number | null;
  shippingError?: string | null;
};

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [fullOrder, setFullOrder] = useState<Order | null>(order);
  const [loading, setLoading] = useState(false);

  // Fetch full order details when modal opens
  useEffect(() => {
    if (isOpen && order?.id) {
      setLoading(true);
      apiClient
        .get(`/orders/${order.id}`)
        .then((response) => {
          setFullOrder(response.data);
        })
        .catch((error) => {
          console.error("Error fetching order details:", error);
          // Fallback to provided order data
          setFullOrder(order);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setFullOrder(order);
    }
  }, [isOpen, order?.id, order]);

  // Group pack product items together - MUST be called before any conditional returns
  const groupedItems = React.useMemo(() => {
    if (!fullOrder?.orderItems) return [];

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
      }>;
      item?: (typeof fullOrder.orderItems)[0];
    };
    const items = [...fullOrder.orderItems];
    const processed = new Set<number>();
    const grouped: GroupedItem[] = [];

    console.log("🔍 Modal: Grouping order items. Total items:", items.length);
    items.forEach((item, idx) => {
      console.log(
        `   Item ${idx}: product="${item.product?.name}", packSize=${item.product?.packSize}, variationId=${item.variationId}, variationName="${item.variation?.name}"`
      );
    });

    // Group items by quantity first (same approach as backend)
    const itemsByQuantity = new Map<
      number,
      Array<{ item: (typeof items)[0]; index: number }>
    >();
    items.forEach((item, index) => {
      if (!itemsByQuantity.has(item.quantity)) {
        itemsByQuantity.set(item.quantity, []);
      }
      itemsByQuantity.get(item.quantity)!.push({ item, index });
    });

    // Process each quantity group
    itemsByQuantity.forEach((itemsWithIndices, quantity) => {
      // Filter to only pack-size items with variations
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
        // No pack items, add all items individually
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

      // Separate items by pack size
      const threePackItems = packItems.filter(
        ({ item }) =>
          item.product?.packSize === 3 || item.product?.name?.includes("3-Pack")
      );
      const fourPackItems = packItems.filter(
        ({ item }) =>
          item.product?.packSize === 4 || item.product?.name?.includes("4-Pack")
      );

      // Check for Gold pack: has both 3-pack and 4-pack items (can have multiple variations each)
      if (threePackItems.length > 0 && fourPackItems.length > 0) {
        // Gold 7-pack! Group all 3-pack and 4-pack items together
        const allGoldItems = [...threePackItems, ...fourPackItems];
        allGoldItems.forEach(({ index }) => processed.add(index));

        const totalPrice = allGoldItems.reduce(
          (sum, { item }) => sum + (item.price || 0) * (item.quantity || 0),
          0
        );

        const variations = allGoldItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize:
            item.product?.packSize ||
            (item.product?.name?.includes("3-Pack") ? 3 : 4),
          price: item.price || 0,
        }));

        console.log(
          `✅ Modal: Grouped Gold 7-pack (Qty: ${quantity}) with ${allGoldItems.length} variations:`,
          variations
            .map((v) => `${v.packSize}-Pack: ${v.variationName}`)
            .join(", ")
        );

        grouped.push({
          isPackProduct: true,
          packType: "7 Pack Sweet and Sour collection Gold",
          quantity: quantity,
          price: totalPrice / quantity,
          total: totalPrice,
          variations: variations,
        });
        return;
      }

      // Check for Platinum pack: only 3-pack items (can be 2, 4, or more variations)
      if (threePackItems.length > 0 && fourPackItems.length === 0) {
        // Group all 3-pack items together as Platinum pack
        threePackItems.forEach(({ index }) => processed.add(index));

        const totalPrice = threePackItems.reduce(
          (sum, { item }) => sum + (item.price || 0) * (item.quantity || 0),
          0
        );

        const variations = threePackItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize: 3,
          price: item.price || 0,
        }));

        console.log(
          `✅ Modal: Grouped Platinum 12-pack (Qty: ${quantity}) with ${threePackItems.length} variations:`,
          variations
            .map((v) => `${v.packSize}-Pack: ${v.variationName}`)
            .join(", ")
        );

        grouped.push({
          isPackProduct: true,
          packType: "12 Pack Best Seller and Classic Platinum",
          quantity: quantity,
          price: totalPrice / quantity,
          total: totalPrice,
          variations: variations,
        });
        return;
      }

      // If we get here, couldn't group as pack product, add individually
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

    // Add remaining unprocessed items
    items.forEach((item, index) => {
      if (!processed.has(index)) {
        grouped.push({
          isPackProduct: false,
          item: item,
        });
        processed.add(index);
      }
    });

    console.log("✅ Modal: Final grouped items count:", grouped.length);
    return grouped;
  }, [fullOrder?.orderItems]);

  // Early return AFTER all hooks are called
  if (!isOpen || !fullOrder) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-indigo-100 text-indigo-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "paid":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Order Details</h2>
              <p className="text-orange-100 mt-1 font-mono text-sm">
                Order ID: {fullOrder.id.slice(0, 12)}...
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">
                Loading order details...
              </span>
            </div>
          )}
          {!loading && (
            <>
              {/* Order Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Order Status
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        fullOrder.status
                      )}`}
                    >
                      {fullOrder.status}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Payment Status
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(
                        fullOrder.paymentStatus
                      )}`}
                    >
                      {fullOrder.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Total
                  </label>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${fullOrder.total.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Order Date
                  </label>
                  <p className="text-gray-900 mt-1">
                    {fullOrder.createdAt
                      ? new Date(fullOrder.createdAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Customer Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900">
                    <strong>Name:</strong>{" "}
                    {fullOrder.user?.name || fullOrder.guestId
                      ? "Guest Customer"
                      : "N/A"}
                  </p>
                  <p className="text-gray-900 mt-1">
                    <strong>Email:</strong>{" "}
                    {fullOrder.user?.email ||
                      fullOrder.guestEmail ||
                      "No email"}
                  </p>
                  {fullOrder.guestId && (
                    <p className="text-orange-600 mt-1 text-sm">
                      👤 Guest Order
                    </p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Order Items ({groupedItems.length})
                </h3>
                <div className="space-y-4">
                  {groupedItems.map((group, idx) => {
                    if (group.isPackProduct) {
                      // Pack product with multiple variations
                      return (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-4 bg-orange-50"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg text-gray-900">
                                {group.packType}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Quantity: {group.quantity}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                ${(group.price || 0).toFixed(2)} each
                              </p>
                              <p className="text-lg font-bold text-orange-600">
                                Total: ${(group.total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Selected Variations:
                            </p>
                            <div className="space-y-2">
                              {group.variations &&
                                group.variations.map(
                                  (
                                    variation: {
                                      packSize: number;
                                      variationName: string;
                                      productName: string;
                                      price: number;
                                    },
                                    vIdx: number
                                  ) => (
                                    <div
                                      key={vIdx}
                                      className="flex items-center justify-between bg-white rounded p-2 border border-orange-200"
                                    >
                                      <div>
                                        <span className="font-medium text-gray-900">
                                          {variation.packSize}-Pack:
                                        </span>
                                        <span className="ml-2 text-orange-600 font-semibold">
                                          {variation.variationName}
                                        </span>
                                        <span className="ml-2 text-sm text-gray-500">
                                          ({variation.productName})
                                        </span>
                                      </div>
                                      <span className="text-sm text-gray-600">
                                        ${variation.price.toFixed(2)}
                                      </span>
                                    </div>
                                  )
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Regular item
                      const item = group.item;
                      if (!item) return null;
                      const productName =
                        item.customPackName ||
                        item.product?.name ||
                        `Product #${item.productId}`;
                      const variationName = item.variation?.name || null;
                      const imageUrl =
                        item.product?.imageUrl || "/assets/images/slider.png";

                      return (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-4 flex items-start gap-4"
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
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {productName}
                            </h4>
                            {variationName && (
                              <div className="mt-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Variation: {variationName}
                                </span>
                              </div>
                            )}
                            {item.product?.sku && (
                              <p className="text-sm text-gray-500 mt-1">
                                SKU: {item.product.sku}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm text-gray-600">
                                Quantity: {item.quantity}
                              </span>
                              <span className="text-sm text-gray-600">
                                Price: ${item.price.toFixed(2)}
                              </span>
                              <span className="text-lg font-bold text-orange-600">
                                Total: $
                                {(
                                  (item.quantity || 0) * (item.price || 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>

              {/* Shipping Address */}
              {fullOrder.shippingAddress && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Shipping Address
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {typeof fullOrder.shippingAddress === "object" ? (
                      <>
                        <p className="text-gray-900">
                          {fullOrder.shippingAddress.name || "N/A"}
                        </p>
                        <p className="text-gray-900">
                          {fullOrder.shippingAddress.street1 || "N/A"}
                        </p>
                        <p className="text-gray-900">
                          {fullOrder.shippingAddress.city || "N/A"},{" "}
                          {fullOrder.shippingAddress.state || "N/A"}{" "}
                          {fullOrder.shippingAddress.zip || "N/A"}
                        </p>
                        <p className="text-gray-900">
                          {fullOrder.shippingAddress.country || "N/A"}
                        </p>
                        {fullOrder.shippingAddress.email && (
                          <p className="text-gray-600 mt-2">
                            Email: {fullOrder.shippingAddress.email}
                          </p>
                        )}
                        {fullOrder.shippingAddress.phone && (
                          <p className="text-gray-600">
                            Phone: {fullOrder.shippingAddress.phone}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-900">
                        {String(fullOrder.shippingAddress)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping Details */}
              {(fullOrder.trackingNumber ||
                fullOrder.shippingStatus ||
                fullOrder.shippingCarrier) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Shipping Details
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {fullOrder.shippingStatus && (
                      <p className="text-gray-900">
                        <strong>Status:</strong> {fullOrder.shippingStatus}
                      </p>
                    )}
                    {fullOrder.shippingCarrier && (
                      <p className="text-gray-900">
                        <strong>Carrier:</strong> {fullOrder.shippingCarrier}
                      </p>
                    )}
                    {fullOrder.trackingNumber && (
                      <p className="text-gray-900">
                        <strong>Tracking Number:</strong>{" "}
                        <span className="font-mono">
                          {fullOrder.trackingNumber}
                        </span>
                      </p>
                    )}
                    {fullOrder.trackingUrl && (
                      <p className="text-gray-900">
                        <a
                          href={fullOrder.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Track Package →
                        </a>
                      </p>
                    )}
                    {fullOrder.shippingCost !== null &&
                      fullOrder.shippingCost !== undefined && (
                        <p className="text-gray-900">
                          <strong>Shipping Cost:</strong> $
                          {fullOrder.shippingCost.toFixed(2)}
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Order Notes */}
              {fullOrder.orderNotes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Order Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900">{fullOrder.orderNotes}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 p-4 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
