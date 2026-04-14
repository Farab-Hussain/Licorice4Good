"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import apiClient from "@/utils/axios";
import { useUser } from "@/hooks/useUser";
import { Eye } from "lucide-react";

type Order = {
  id: string;
  userId: string | null; // Nullable for guest orders
  guestId?: string | null; // Guest identifier
  guestEmail?: string | null; // Guest email
  status: string;
  paymentStatus: string;
  total: number;
  createdAt?: string;
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
  // Shipping fields
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

type Pagination = { pages: number; total: number };

type BulkAction = "confirm" | "ship" | "deliver" | "cancel";

const AdminOrdersPage = () => {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminPagination, setAdminPagination] = useState<Pagination | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50); // Increased for high volume
  const [debouncedStatus, setDebouncedStatus] = useState("");
  const [debouncedPaymentStatus, setDebouncedPaymentStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateFilter, setDateFilter] = useState("");
  const [totalValueFilter, setTotalValueFilter] = useState({
    min: "",
    max: "",
  });

  // CSV export
  const [exportingCSV, setExportingCSV] = useState<boolean>(false);

  // Auto-refresh for high-traffic monitoring
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds


  // Helper function to group pack product items for display
  const groupOrderItemsForDisplay = useCallback((orderItems: Order['orderItems']) => {
    if (!orderItems || orderItems.length === 0) return [];

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
      item?: typeof orderItems[0];
    };
    const items = [...orderItems];
    const processed = new Set<number>();
    const grouped: GroupedItem[] = [];

    // Group items by quantity first
    const itemsByQuantity = new Map<number, Array<{ item: typeof items[0]; index: number }>>();
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

      // Check for Gold pack: has both 3-pack and 4-pack items
      if (threePackItems.length > 0 && fourPackItems.length > 0) {
        const allGoldItems = [...threePackItems, ...fourPackItems];
        allGoldItems.forEach(({ index }) => processed.add(index));

        const variations = allGoldItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize: item.product?.packSize || (item.product?.name?.includes("3-Pack") ? 3 : 4),
          price: item.price || 0,
        }));

        grouped.push({
          isPackProduct: true,
          packType: "7 Pack Sweet and Sour collection Gold",
          quantity: quantity,
          variations: variations,
        });
        return;
      }

      // Check for Platinum pack: only 3-pack items
      if (threePackItems.length > 0 && fourPackItems.length === 0) {
        threePackItems.forEach(({ index }) => processed.add(index));

        const variations = threePackItems.map(({ item }) => ({
          productName: item.product?.name || "Product",
          variationName: item.variation?.name || "No variation",
          packSize: 3,
          price: item.price || 0,
        }));

        grouped.push({
          isPackProduct: true,
          packType: "12 Pack Best Seller and Classic Platinum",
          quantity: quantity,
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

    return grouped;
  }, []);

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, userLoading, router]);

  // Debounce filters
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStatus(status), 300);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPaymentStatus(paymentStatus), 300);
    return () => clearTimeout(t);
  }, [paymentStatus]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchAdminOrders = useCallback(async () => {
    if (!user || user.role !== "admin") return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (debouncedStatus) params.set("status", debouncedStatus);
      if (debouncedPaymentStatus)
        params.set("paymentStatus", debouncedPaymentStatus);
      if (debouncedSearchTerm) params.set("search", debouncedSearchTerm);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      if (dateFilter) params.set("dateFilter", dateFilter);
      if (totalValueFilter.min) params.set("minTotal", totalValueFilter.min);
      if (totalValueFilter.max) params.set("maxTotal", totalValueFilter.max);

      const { data } = await apiClient.get(
        `/orders/admin/all?${params.toString()}`
      );

      if (Array.isArray(data.orders)) {
        setAdminOrders(data.orders);
        setAdminPagination(data.pagination || null);

        // Check for shipping failures and show toast
        const failedOrders = data.orders.filter(
          (order: Order) =>
            order.status === "shipping_failed" ||
            order.shippingStatus === "failed"
        );

        if (failedOrders.length > 0) {
          const { showWarningToast } = await import(
            "../../../utils/errorHandler"
          );
          showWarningToast(
            `${failedOrders.length} order(s) have shipping issues. Please check the orders page for details.`
          );
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (e) {
      const message =
        (e as { message?: string })?.message || "Failed to fetch orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    page,
    limit,
    debouncedStatus,
    debouncedPaymentStatus,
    debouncedSearchTerm,
    sortBy,
    sortOrder,
    dateFilter,
    totalValueFilter,
  ]);

  // Export to CSV
  const handleExportCSV = async () => {
    if (!user || user.role !== "admin") return;
    setExportingCSV(true);
    try {
      const params = new URLSearchParams();
      if (debouncedStatus) params.set("status", debouncedStatus);
      if (debouncedPaymentStatus) params.set("paymentStatus", debouncedPaymentStatus);
      if (debouncedSearchTerm) params.set("search", debouncedSearchTerm);
      if (dateFilter) params.set("dateFilter", dateFilter);
      if (totalValueFilter.min) params.set("minTotal", totalValueFilter.min);
      if (totalValueFilter.max) params.set("maxTotal", totalValueFilter.max);

      const { getToken } = await import("@/utils/tokenUtils");
      const token = getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const response = await fetch(
        `${API_URL}/orders/admin/export-csv?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `orders-export-${new Date().toISOString().split("T")[0]}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const orderCount = response.headers.get("X-Order-Count");
      if (orderCount) {
        alert(`✅ Exported ${orderCount} orders to CSV successfully.`);
      }
    } catch (e) {
      const message = (e as { message?: string })?.message || "Export failed";
      setError(message);
    } finally {
      setExportingCSV(false);
    }
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAdminOrders, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchAdminOrders]);

  useEffect(() => {
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  // Handle status change for individual orders
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      await axios.put(
        `${API_URL}/orders/${orderId}/status`,
        { status: newStatus },
        { withCredentials: true }
      );

      // Update local state
      setAdminOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (e) {
      const message =
        (e as { message?: string })?.message || "Failed to update order status";
      setError(message);
    }
  };

  // Handle view order details - navigate to detail page
  const handleViewOrder = (order: Order) => {
    router.push(`/dashboard/orders/${order.id}`);
  };

  // Bulk operations
  const handleBulkAction = async (action: BulkAction) => {
    if (selectedOrders.size === 0) {
      setError("Please select orders to perform bulk action");
      return;
    }

    setBulkActionLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const orderIds = Array.from(selectedOrders);

      const updates: { status?: string; paymentStatus?: string } = {};

      switch (action) {
        case "confirm":
          updates.status = "confirmed";
          break;
        case "ship":
          updates.status = "shipped";
          break;
        case "deliver":
          updates.status = "delivered";
          break;
        case "cancel":
          updates.status = "cancelled";
          break;
      }

      await axios.put(
        `${API_URL}/orders/admin/bulk-update`,
        {
          orderIds,
          updates,
        },
        { withCredentials: true }
      );

      // Update local state
      setAdminOrders((prev) =>
        prev.map((order) =>
          selectedOrders.has(order.id) ? { ...order, ...updates } : order
        )
      );

      setSelectedOrders(new Set());
    } catch (e) {
      const message =
        (e as { message?: string })?.message || "Failed to perform bulk action";
      setError(message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedOrders.size === adminOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(adminOrders.map((order) => order.id)));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const totalPages = useMemo(
    () => adminPagination?.pages ?? 1,
    [adminPagination]
  );
  const totalOrders = useMemo(
    () => adminPagination?.total ?? 0,
    [adminPagination]
  );

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
      case "shipping_failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
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

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
          <p className="text-black text-lg">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full layout">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">
            Order Management
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Managing {totalOrders.toLocaleString()} orders • Page {page} of{" "}
            {totalPages}
          </p>
        </div>

        {/* Auto-refresh controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-black">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="hidden sm:inline">Auto-refresh</span>
              <span className="sm:hidden">Auto</span>
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 text-black"
              >
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
            )}
          </div>

          <button
            onClick={fetchAdminOrders}
            disabled={loading}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {/* Export CSV Button */}
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            disabled={exportingCSV || loading}
            title="Export orders to CSV (Shippo-compatible, includes affiliate data)"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm sm:text-base font-medium shadow-sm"
          >
            {exportingCSV ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span className="hidden sm:inline">Exporting...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h3 className="text-lg font-semibold text-black mb-4">
          Filters & Search
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Search */}
          <div className="xl:col-span-2">
            <label
              htmlFor="search-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Search
            </label>
            <input
              id="search-input"
              type="text"
              placeholder="Order ID, user email, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="status-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status-select"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="shipping_failed">Shipping Failed</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label
              htmlFor="payment-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Payment
            </label>
            <select
              id="payment-select"
              value={paymentStatus}
              onChange={(e) => {
                setPage(1);
                setPaymentStatus(e.target.value);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            >
              <option value="">All payments</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label
              htmlFor="date-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date
            </label>
            <select
              id="date-select"
              value={dateFilter}
              onChange={(e) => {
                setPage(1);
                setDateFilter(e.target.value);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            >
              <option value="">All dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>

          {/* Sort Options */}
          <div>
            <label
              htmlFor="sort-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Sort by
            </label>
            <select
              id="sort-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortBy(field);
                setSortOrder(order as "asc" | "desc");
                setPage(1);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="total-desc">Highest value</option>
              <option value="total-asc">Lowest value</option>
              <option value="status-asc">Status A-Z</option>
            </select>
          </div>
        </div>

        {/* Value Range Filter */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="min-value-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Min Value ($)
            </label>
            <input
              id="min-value-input"
              type="number"
              placeholder="0.00"
              value={totalValueFilter.min}
              onChange={(e) =>
                setTotalValueFilter((prev) => ({
                  ...prev,
                  min: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="max-value-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Max Value ($)
            </label>
            <input
              id="max-value-input"
              type="number"
              placeholder="1000.00"
              value={totalValueFilter.max}
              onChange={(e) =>
                setTotalValueFilter((prev) => ({
                  ...prev,
                  max: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="limit-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Items per page
            </label>
            <select
              id="limit-select"
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value));
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black bg-white"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStatus("");
                setPaymentStatus("");
                setSearchTerm("");
                setDateFilter("");
                setTotalValueFilter({ min: "", max: "" });
                setSortBy("createdAt");
                setSortOrder("desc");
                setPage(1);
              }}
              id="clear-filters-button"
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-800 font-medium">
                {selectedOrders.size} orders selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction("confirm")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Confirm All
                </button>
                <button
                  onClick={() => handleBulkAction("ship")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Ship All
                </button>
                <button
                  onClick={() => handleBulkAction("cancel")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Cancel All
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedOrders(new Set())}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* Payment Status Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-blue-800 mb-1">
              Payment Status Management
            </h4>
            <p className="text-sm text-blue-700">
              Payment statuses are automatically managed by Stripe webhooks and
              cannot be changed manually. Only order statuses (pending →
              confirmed → shipped → delivered) can be updated by admins.
            </p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedOrders.size === adminOrders.length &&
                      adminOrders.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  CUSTOMER
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  DATE
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  TOTAL
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  STATUS
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  SHIPPING
                </th>
                <th className="px-4 py-3 text-left text-black font-semibold uppercase text-xs">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5D39] mr-3"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && adminOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No orders found matching your criteria
                  </td>
                </tr>
              )}

              {!loading &&
                adminOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className={`${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100 transition-colors ${
                      selectedOrders.has(order.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    {/* CUSTOMER Column */}
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-black">
                          {order.user?.name || (order.guestId ? "Guest" : "N/A")}
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {order.user?.email || order.guestEmail || "No email"}
                        </div>
                      </div>
                    </td>

                    {/* DATE Column */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-700">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </div>
                    </td>

                    {/* TOTAL Column */}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-black text-sm">
                        ${order.total.toFixed(2)}
                      </div>
                    </td>

                    {/* STATUS Column */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-semibold uppercase w-fit ${
                            order.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : order.status === "shipped"
                              ? "bg-indigo-100 text-indigo-800"
                              : order.status === "delivered"
                              ? "bg-green-100 text-green-800"
                              : order.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status.toUpperCase()}
                        </span>
                        {order.paymentStatus === "paid" && (
                          <div className="text-xs text-green-600 font-medium">
                            ✓ Paid via Stripe
                          </div>
                        )}
                      </div>
                    </td>

                    {/* SHIPPING Column */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        {order.shippingStatus ? (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold w-fit ${
                                order.shippingStatus === "label_created"
                                  ? "bg-green-100 text-green-800"
                                  : order.shippingStatus === "shipped"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.shippingStatus === "delivered"
                                  ? "bg-green-100 text-green-800"
                                  : order.shippingStatus === "in_transit"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : order.shippingStatus === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {order.shippingStatus === "label_created" && (
                                <span>✓</span>
                              )}
                              {order.shippingStatus === "label_created"
                                ? "Label Created"
                                : order.shippingStatus === "failed"
                                ? "Failed"
                                : order.shippingStatus}
                            </span>
                            {order.shippingCarrier && order.shippingService && (
                              <div className="text-xs text-gray-700 flex items-center gap-1">
                                <svg
                                  className="w-4 h-4 text-gray-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                  />
                                </svg>
                                {order.shippingCarrier} • {order.shippingService}
                              </div>
                            )}
                            {order.trackingNumber && (
                              <div className="font-mono text-xs text-gray-700">
                                {order.trackingNumber}
                              </div>
                            )}
                            {order.trackingUrl && (
                              <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors w-fit"
                              >
                                Track Package
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            )}
                            {order.shippingCost && (
                              <div className="text-xs text-gray-600">
                                Shipping: ${order.shippingCost.toFixed(2)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">No shipment</span>
                        )}
                        {order.shippingError && (
                          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            Error: {order.shippingError}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* ACTIONS Column */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="inline-flex items-center gap-2 text-[#FF5D39] hover:text-[#FF6B35] transition-colors font-medium text-sm"
                      >
                        <Eye className="w-5 h-5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden">
          {loading && (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5D39] mr-3"></div>
                Loading orders...
              </div>
            </div>
          )}

          {!loading && adminOrders.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No orders found matching your criteria
            </div>
          )}

          {!loading &&
            adminOrders.map((order) => (
              <div
                key={order.id}
                className="border-b border-gray-200 p-4 last:border-b-0"
              >
                {/* Header with checkbox and order ID */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                      className="rounded border-gray-300"
                    />
                    <div>
                      <div className="font-mono text-sm text-black font-medium">
                        {order.id.slice(0, 12)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-black text-lg">
                      ${order.total.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-3">
                  <div className="text-sm font-medium text-black">
                    {order.user?.name ||
                      (order.guestId ? "Guest Customer" : "N/A")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.user?.email ||
                      order.guestEmail ||
                      (order.userId ? order.userId.slice(0, 8) : "No email")}
                  </div>
                  {order.guestId && (
                    <div className="text-xs text-orange-600 mt-1">
                      👤 Guest Order
                    </div>
                  )}
                </div>

                {/* Status and Payment */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                      order.paymentStatus
                    )}`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                {/* Items and Shipping */}
                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Items</div>
                    <div className="text-black">
                      {order.orderItems?.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      ) || 0}{" "}
                      items
                    </div>
                    {order.orderItems && order.orderItems.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        {order.orderItems.slice(0, 2).map((item, idx) => (
                          <div key={idx}>
                            {item.customPackName ||
                              item.product?.name ||
                              "Product"}
                            {item.variation && (
                              <span className="ml-1 text-orange-600">
                                ({item.variation.name})
                              </span>
                            )}
                          </div>
                        ))}
                        {order.orderItems.length > 2 && (
                          <div className="text-gray-400">
                            +{order.orderItems.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Shipping</div>
                    <div className="text-black">
                      {order.shippingStatus ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            order.shippingStatus === "delivered"
                              ? "bg-green-100 text-green-800"
                              : order.shippingStatus === "shipped"
                              ? "bg-blue-100 text-blue-800"
                              : order.shippingStatus === "in_transit"
                              ? "bg-yellow-100 text-yellow-800"
                              : order.shippingStatus === "failed"
                              ? "bg-red-100 text-red-800"
                              : order.shippingStatus === "label_created"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.shippingStatus === "failed"
                            ? "Failed"
                            : order.shippingStatus === "label_created"
                            ? "Label Created"
                            : order.shippingStatus}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          No shipment
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tracking */}
                {order.trackingNumber && (
                  <div className="mb-3">
                    <div className="text-gray-500 text-xs mb-1">Tracking</div>
                    <div className="font-mono text-xs text-blue-600">
                      {order.trackingNumber.slice(0, 12)}...
                    </div>
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                      >
                        Track Package
                      </a>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleStatusChange(order.id, e.target.value)
                    }
                    className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded text-black bg-white"
                    disabled={bulkActionLoading}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    onClick={() => handleViewOrder(order)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                  >
                    View Details
                  </button>
                </div>

                {/* Error Display */}
                {order.shippingError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    Shipping Error: {order.shippingError}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
          <div className="text-sm text-gray-600 text-center sm:text-left">
            Showing {(page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, totalOrders)} of{" "}
            {totalOrders.toLocaleString()} orders
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              className="px-3 py-2 rounded border border-gray-300 text-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              First
            </button>
            <button
              className="px-3 py-2 rounded border border-gray-300 text-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum =
                Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              if (pageNum <= totalPages) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-2 rounded border cursor-pointer ${
                      pageNum === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 text-black hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              return null;
            })}

            <button
              className="px-3 py-2 rounded border border-gray-300 text-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
            <button
              className="px-3 py-2 rounded border border-gray-300 text-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              Last
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminOrdersPage;
