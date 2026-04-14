import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";
import apiClient from "@/utils/axios";
import { trackEcommerce } from "@/hooks/useTrackdeskEvent";

// No authentication check needed - supports guest checkout

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  sku?: string;
  // Variation fields
  variationId?: string;
  variationName?: string;
  // Pack product fields
  packProductId?: string;
  packProductName?: string;
  packSize?: number; // Pack size for order tracking
  // Custom pack fields
  isCustomPack?: boolean;
  flavorIds?: string[];
  customPackName?: string;
};

type CartState = {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  // Actions
  addItem: (item: Omit<CartItem, "id">) => Promise<void>;
  addPreDefinedPack: (recipeId: string, quantity?: number) => Promise<void>;
  addCustomPack: (flavorIds: string[], quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  loadFromBackend: () => Promise<void>;
  // Computed
  getTotal: () => number;
  getItemCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,

      addItem: async (newItem) => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL;
          const { items } = get();

          console.log("[Cart Store] Adding item:", {
            productId: newItem.productId,
            productName: newItem.productName,
            variationId: newItem.variationId,
            variationName: newItem.variationName,
            packProductId: newItem.packProductId,
            packProductName: newItem.packProductName,
            quantity: newItem.quantity,
            price: newItem.price,
          });

          // For pack products, check for duplicates using productId + variationId + packProductId
          // For regular products, check using productId + variationId
          const existingItem = items.find((item) => {
            if (newItem.packProductId) {
              // Pack product: match by productId, variationId, and packProductId
              return (
                item.productId === newItem.productId &&
                item.variationId === newItem.variationId &&
                item.packProductId === newItem.packProductId
              );
            } else {
              // Regular product: match by productId and variationId
              return (
                item.productId === newItem.productId &&
                item.variationId === newItem.variationId
              );
            }
          });

          if (existingItem) {
            console.log("[Cart Store] Item already exists, updating quantity:", {
              existingQuantity: existingItem.quantity,
              newQuantity: newItem.quantity,
              totalQuantity: existingItem.quantity + newItem.quantity,
            });
            // Update quantity
            const updatedItems = items.map((item) => {
              if (newItem.packProductId) {
                // Pack product match
                if (
                  item.productId === newItem.productId &&
                  item.variationId === newItem.variationId &&
                  item.packProductId === newItem.packProductId
                ) {
                  return { ...item, quantity: item.quantity + newItem.quantity };
                }
              } else {
                // Regular product match
                if (
                  item.productId === newItem.productId &&
                  item.variationId === newItem.variationId
                ) {
                  return { ...item, quantity: item.quantity + newItem.quantity };
                }
              }
              return item;
            });
            set({ items: updatedItems });
          } else {
            // Add new item
            const itemWithId = {
              ...newItem,
              id: `${newItem.productId}-${newItem.variationId || 'no-var'}-${newItem.packProductId || 'no-pack'}-${Date.now()}`,
            };
            console.log("[Cart Store] Adding new item to cart:", {
              id: itemWithId.id,
              productName: itemWithId.productName,
              variationName: itemWithId.variationName,
              quantity: itemWithId.quantity,
            });
            set({ items: [...items, itemWithId] });
          }

          console.log("[Cart Store] Cart items after add:", {
            totalItems: get().items.length,
            items: get().items.map(item => ({
              productName: item.productName,
              variationName: item.variationName,
              quantity: item.quantity,
              packProductId: item.packProductId,
            })),
          });

          // Track add to cart event
          if (typeof window !== "undefined" && window.Trackdesk) {
            trackEcommerce.addToCart({
              id: newItem.productId,
              name: newItem.productName,
              price: newItem.price,
              quantity: newItem.quantity,
              sku: newItem.sku,
            });
          }

          // Regular products are stored locally only (no backend sync)
          // Only 3-pack products sync with backend via addPreDefinedPack/addCustomPack
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to add item to cart";
          set({ error: message });
        } finally {
          set({ loading: false });
        }
      },

      addPreDefinedPack: async (recipeId: string, quantity = 1) => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL;

          // Validate recipeId
          if (!recipeId) {
            throw new Error("Recipe ID is required for pre-defined packs");
          }

          // Pre-defined packs need product_id, recipe_id, and qty
          const requestData = {
            product_id: "3-pack",
            recipe_id: recipeId,
            qty: quantity,
          };

          const response = await apiClient.post(`/3pack/cart/add`, requestData);

          if (response.data && response.data.success) {
            // Success - the backend will handle the cart update

            // Reload cart from backend to get the updated cart with the new pre-defined pack
            await get().loadFromBackend();
          }
        } catch (error: unknown) {
          console.error("Failed to add pre-defined pack to cart:", error);
          const errorMessage =
            (error as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Failed to add pre-defined pack to cart";

          // Provide user-friendly error messages
          if (
            errorMessage?.includes(
              "Missing required fields: product_id and qty are required"
            )
          ) {
            set({
              error: "Please provide all required information for your pack.",
            });
          } else if (
            errorMessage?.includes(
              "Either recipe_id (for preset packs) or flavor_ids (for custom packs) must be provided"
            )
          ) {
            set({ error: "Please select a pack variant." });
          } else if (errorMessage?.includes("Insufficient stock")) {
            set({ error: errorMessage });
          } else {
            set({
              error: errorMessage || "Failed to add pre-defined pack to cart",
            });
          }
        } finally {
          set({ loading: false });
        }
      },

      addCustomPack: async (flavorIds, quantity = 1) => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL;

          // Add custom pack to backend cart
          // Custom packs only need product_id, flavor_ids, and qty
          // recipe_id is not required for custom packs

          const response = await apiClient.post(`/3pack/cart/add`, {
            product_id: "3-pack",
            flavor_ids: flavorIds,
            qty: quantity,
          });

          // Reload cart from backend to get the updated cart with the new custom pack
          await get().loadFromBackend();
        } catch (error) {
          console.error("Failed to add custom pack to backend cart:", error);

          // Check if it's the specific validation error we're seeing
          if (axios.isAxiosError(error) && error.response?.status === 400) {
            const errorMessage = error.response.data?.message;
            if (
              errorMessage?.includes(
                "Missing required fields: product_id and qty are required"
              )
            ) {
              set({
                error:
                  "Please provide all required information for your custom pack.",
              });
            } else if (
              errorMessage?.includes(
                "Either recipe_id (for preset packs) or flavor_ids (for custom packs) must be provided"
              )
            ) {
              set({
                error: "Please select flavors for your custom pack.",
              });
            } else if (
              errorMessage?.includes(
                "flavor_ids must contain exactly 3 unique flavors"
              )
            ) {
              set({
                error:
                  "Please select exactly 3 different flavors for your custom pack.",
              });
            } else if (errorMessage?.includes("Insufficient stock")) {
              set({ error: errorMessage });
            } else {
              set({
                error: errorMessage || "Failed to add custom pack to cart",
              });
            }
          } else {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to add custom pack to cart";
            set({ error: message });
          }
        } finally {
          set({ loading: false });
        }
      },

      updateQuantity: async (itemId, quantity) => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const { items } = get();

          if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            await get().removeItem(itemId);
            return;
          }

          const updatedItems = items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          );
          set({ items: updatedItems });

          // Try to sync with backend - update for both regular and custom pack items
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL;
            const item = items.find((item) => item.id === itemId);
            if (item) {
              // Update quantity on backend (works for both regular and custom packs)
              await apiClient.put(`/3pack/cart/${itemId}`, { qty: quantity });
            }
          } catch (backendError) {
            console.warn(
              "Failed to sync with backend, using localStorage only:",
              backendError
            );
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to update quantity";
          set({ error: message });
        } finally {
          set({ loading: false });
        }
      },

      removeItem: async (itemId) => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const { items } = get();
          const item = items.find((item) => item.id === itemId);
          const updatedItems = items.filter((item) => item.id !== itemId);
          set({ items: updatedItems });

          // Track remove from cart event
          if (item && typeof window !== "undefined" && window.Trackdesk) {
            trackEcommerce.removeFromCart({
              id: item.productId,
              name: item.productName,
              price: item.price,
              quantity: item.quantity,
            });
          }

          // Try to sync with backend - remove for both regular and custom pack items
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL;
            if (item) {
              // Remove from backend cart (works for both regular and custom packs)
              await apiClient.delete(`/3pack/cart/${itemId}`);
            }
          } catch (backendError) {
            console.warn(
              "Failed to sync with backend, using localStorage only:",
              backendError
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to remove item";
          set({ error: message });
        } finally {
          set({ loading: false });
        }
      },

      clearCart: async () => {
        set({ loading: true, error: null });
        try {
          set({ items: [] });

          // Try to clear from backend, but don't fail if it's not available
          try {
            await apiClient.delete(`/3pack/cart`);
          } catch (backendError) {
            console.warn(
              "Cart backend not available for clearing:",
              backendError
            );
            // Cart is already cleared locally, so this is fine
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to clear cart";
          set({ error: message });
        } finally {
          set({ loading: false });
        }
      },

      syncWithBackend: async () => {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL;
          const { items } = get();

          // Sync each item individually using the correct endpoint
          for (const item of items) {
            const cartData = {
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              sku: item.sku, // Include SKU for dynamic backend
            };
            await apiClient.post(`/3pack/cart/add`, cartData);
          }
        } catch (error) {
          console.warn("Cart sync failed - using localStorage only:", error);
          // Cart will work with localStorage only if backend is not available
        }
      },

      loadFromBackend: async () => {
        const { loading } = get();
        if (loading) return; // Prevent multiple simultaneous requests

        set({ loading: true, error: null });
        try {
          const { data } = await apiClient.get(`/3pack/cart`);

          if (data && Array.isArray(data.cart)) {
            const backendItems = data.cart.map((item: unknown) => {
              const typedItem = item as {
                id?: string;
                product_id?: string;
                recipe_title?: string;
                recipe_kind?: string;
                quantity?: number;
                unit_price?: number;
                sku?: string;
                items?: Array<{
                  flavor_id: string;
                  flavor_name: string;
                  quantity: number;
                }>;
              };
              return {
                id: typedItem.id || `${typedItem.product_id}-${Date.now()}`,
                productId: typedItem.product_id || "3-pack",
                productName: typedItem.recipe_title || "Custom 3-Pack",
                quantity: typedItem.quantity || 1,
                price: typedItem.unit_price || 0,
                sku: typedItem.sku,
                isCustomPack: typedItem.recipe_kind === "Custom",
                flavorIds: typedItem.items?.map((item) => item.flavor_id) || [],
                customPackName: typedItem.recipe_title,
              };
            });

            // Merge backend items with existing local items
            const { items: currentItems } = get();
            const localItems = currentItems.filter(
              (item) => item.productId !== "3-pack"
            );
            const mergedItems = [...localItems, ...backendItems];
            set({ items: mergedItems });
          }
        } catch (error) {
          console.warn(
            "Cart backend not available - using localStorage only:",
            error
          );
          // Cart will work with localStorage only if backend is not available
        } finally {
          set({ loading: false });
        }
      },

      getTotal: () => {
        const { items } = get();
        return items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "cart-storage",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
