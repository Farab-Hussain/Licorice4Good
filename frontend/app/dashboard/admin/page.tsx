"use client";
import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import apiClient from "@/utils/axios";
import { useUser } from "@/hooks/useUser";
import { toast } from "react-toastify";
import SimpleModal from "@/components/ui/SimpleModal";
import EditProductModal from "@/components/ui/EditProductModal";
import EditFlavorModal from "@/components/ui/EditFlavorModal";

type Flavor = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
  inventory?: {
    id: string;
    flavorId: string;
    onHand: number;
    reserved: number;
    safetyStock: number;
    createdAt: string;
    updatedAt: string;
  };
  _count?: {
    productFlavors: number;
    packRecipeItems: number;
  };
};

type InventoryAlert = {
  id: string;
  flavorId: string;
  flavorName: string;
  currentStock: number;
  minThreshold: number;
  onHand: number;
  reserved: number;
  safetyStock: number;
  flavor?: {
    name: string;
    aliases: string[];
  };
};

type SystemConfig = {
  defaultPrice: number;
  minStockThreshold: number;
  maxFlavorsPerProduct: number;
  supportedCategories: string[];
  totalCategories?: number;
  totalFlavors?: number;
  totalProducts?: number;
  defaultPrices?: { [key: string]: number };
  supportedProductTypes?: string[];
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  stock?: number;
  sku?: string;
  flavors?: ProductFlavor[];
  supportLevel?: string | null;
  packSize?: number | null;
  isPackProduct?: boolean;
  packType?: string | null;
  variations?: Array<{
    id: string;
    name: string;
    sku: string;
    isActive?: boolean;
    flavors: Array<{ id: string; name: string; quantity: number }>;
    images: Array<{ id: string; imageUrl: string; isDefault: boolean }>;
  }>;
  nutritionFacts?: Array<{
    id: string;
    fileUrl: string;
    fileName?: string | null;
    fileType?: string | null;
    displayOrder: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type VariationForm = {
  name: string;
  flavors: Array<{ id: string; name: string; quantity: number }>;
  imageFile?: File | null;
  imagePreview?: string | null;
};

type FlavorDTO = {
  id: string;
  name?: string | null;
  quantity?: number | null;
};

type ProductFlavor = {
  id: string;
  name: string;
  quantity: number;
};

const AdminPageContent = () => {
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    "products" | "flavors" | "categories" | "inventory" | "config"
  >("products");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    productId: string | null;
    productName: string;
  }>({
    isOpen: false,
    productId: null,
    productName: "",
  });
  const [deleteFlavorModal, setDeleteFlavorModal] = useState<{
    isOpen: boolean;
    flavorId: string | null;
    flavorName: string;
  }>({
    isOpen: false,
    flavorId: null,
    flavorName: "",
  });
  const [editProductModal, setEditProductModal] = useState<{
    isOpen: boolean;
    product: Product | null;
  }>({
    isOpen: false,
    product: null,
  });
  const [editFlavorModal, setEditFlavorModal] = useState<{
    isOpen: boolean;
    flavor: Flavor | null;
  }>({
    isOpen: false,
    flavor: null,
  });
  const [viewPackVariantsModal, setViewPackVariantsModal] = useState<{
    isOpen: boolean;
    productId: string | null;
    productName: string;
  }>({
    isOpen: false,
    productId: null,
    productName: "",
  });

  // Enhanced image compression function with progressive quality reduction
  const compressImage = (
    file: File,
    targetSizeMB: number = 5
  ): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      const img = new window.Image();

      img.onload = () => {
        // Calculate new dimensions (max 1200px width, maintain aspect ratio)
        const maxWidth = 1200;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress with progressive quality reduction
        ctx?.drawImage(img, 0, 0, width, height);

        const compressWithQuality = (quality: number): Promise<File> => {
          return new Promise((resolveQuality) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const sizeMB = blob.size / (1024 * 1024);
                  if (sizeMB <= targetSizeMB || quality <= 0.3) {
                    // Accept if within target size or quality is already very low
                    const compressedFile = new File([blob], file.name, {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    });
                    resolveQuality(compressedFile);
                  } else {
                    // Try with lower quality
                    compressWithQuality(quality - 0.1).then(resolveQuality);
                  }
                } else {
                  resolveQuality(file);
                }
              },
              "image/jpeg",
              quality
            );
          });
        };

        // Start with 80% quality and reduce if needed
        compressWithQuality(0.8).then(resolve);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // File size validation function
  // Flavors state
  const [flavors, setFlavors] = useState<Flavor[]>([]);

  // Helper function to normalize image src with cache busting
  const normalizeImageSrc = (src?: string | null, updatedAt?: string) => {
    if (!src) return "/assets/images/slider.png";

    // Handle static assets (served from frontend)
    if (src.startsWith("/assets")) {
      const cacheBuster = updatedAt
        ? `?t=${new Date(updatedAt).getTime()}`
        : `?t=${Date.now()}`;
      return `${src}${cacheBuster}`;
    }

    // Handle uploaded images (served from backend)
    if (src.startsWith("/uploads") || src.startsWith("uploads")) {
      const path = src.startsWith("/uploads") ? src : `/${src}`;
      const cacheBuster = updatedAt
        ? `?t=${new Date(updatedAt).getTime()}`
        : `?t=${Date.now()}`;

      // Always use the full API URL for uploaded images
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        toast.error("NEXT_PUBLIC_API_URL is not defined");
        return `${path}${cacheBuster}`;
      }
      return `${apiUrl}${path}${cacheBuster}`;
    }

    // Handle full URLs (already complete)
    if (src.startsWith("http://") || src.startsWith("https://")) {
      const cacheBuster = updatedAt
        ? `?t=${new Date(updatedAt).getTime()}`
        : `?t=${Date.now()}`;
      return `${src}${cacheBuster}`;
    }

    // Default case - assume it needs API URL
    const cacheBuster = updatedAt
      ? `?t=${new Date(updatedAt).getTime()}`
      : `?t=${Date.now()}`;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error("NEXT_PUBLIC_API_URL is not defined");
      return `${src}${cacheBuster}`;
    }

    // Ensure src starts with / for proper path construction
    const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
    return `${apiUrl}${normalizedSrc}${cacheBuster}`;
  };

  // Categories state - removed unused variables

  // Inventory state
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);
  const [updatingInventory, setUpdatingInventory] = useState<{
    [key: string]: boolean;
  }>({});

  // Config state
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  
  // Pack product available variants (dynamically loaded)
  const [packProductVariants, setPackProductVariants] = useState<{
    [productId: string]: Array<{
      productId: string;
      productName: string;
      variationId: string;
      variationName: string;
      packSize: number;
      imageUrl?: string | null;
      category: string;
    }>;
  }>({});
  const [loadingPackVariants, setLoadingPackVariants] = useState<{
    [productId: string]: boolean;
  }>({});
  
  const [page] = useState(1);
  const [limit] = useState(10);
  const [form, setForm] = useState<Partial<Product>>({
    name: "",
    price: 0,
    stock: 0,
    category: "",
    isActive: true,
    sku: "",
    flavors: [],
    supportLevel: "",
    packSize: null,
    isPackProduct: false,
    packType: null,
  });
  const [variations, setVariations] = useState<VariationForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});
  const [deletingFlavor, setDeletingFlavor] = useState<{
    [key: string]: boolean;
  }>({});
  const [deletingFromModal, setDeletingFromModal] = useState(false);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [categoryObjects, setCategoryObjects] = useState<
    Array<{ id: string; name: string; productCount: number }>
  >([]);
  const [categoryFilter] = useState<string>("");
  const [search] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [nutritionFactsFiles, setNutritionFactsFiles] = useState<
    Array<{ file: File; preview: string; id: string }>
  >([]);
  const [existingNutritionFacts, setExistingNutritionFacts] = useState<
    Array<{
      id: string;
      fileUrl: string;
      fileName?: string | null;
      fileType?: string | null;
      displayOrder: number;
    }>
  >([]);

  // Category management state
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [availableFlavors, setAvailableFlavors] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [newFlavor, setNewFlavor] = useState({
    name: "",
    aliases: "",
    active: true,
  });
  const [flavorImageFile, setFlavorImageFile] = useState<File | null>(null);
  const [flavorImagePreview, setFlavorImagePreview] = useState<string | null>(
    null
  );
  const [creatingFlavor, setCreatingFlavor] = useState<boolean>(false);

  // Don't redirect in useEffect - just show access denied message
  // Redirecting causes race conditions with user data loading

  // Handle tab query parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["products", "flavors", "categories", "inventory", "config"].includes(
        tabParam
      )
    ) {
      setActiveTab(
        tabParam as
          | "products"
          | "flavors"
          | "categories"
          | "inventory"
          | "config"
      );
    }
  }, [searchParams]);

  // Helper functions for products
  const getFlavorNameById = (id: string): string => {
    const found = availableFlavors.find((f) => f.id === id);
    return found ? found.name : id;
  };

  // Commented out unused helper functions
  // const formatFlavors = (flavors?: Array<FlavorDTO>): string => {
  //   if (!Array.isArray(flavors) || flavors.length === 0) return "-";
  //   return flavors
  //     .map((f) => {
  //       const name =
  //         f.name && String(f.name).trim() !== ""
  //           ? String(f.name)
  //           : getFlavorNameById(String(f.id));
  //       const qtyRaw =
  //         typeof f.quantity === "number" ? f.quantity : Number(f.quantity || 1);
  //       const quantity =
  //         Number.isFinite(qtyRaw) && qtyRaw > 0 ? Number(qtyRaw) : 1;
  //       return `${name} (${quantity})`;
  //     })
  //     .join(", ");
  // };

  // Extract/normalize flavors from various backend shapes
  // const extractFlavors = (raw: unknown): FlavorDTO[] => {
  //   if (!raw) return [];
  //   if (Array.isArray(raw)) {
  //     // Could be string[] or object[]
  //     if (raw.length === 0) return [];
  //     if (typeof raw[0] === "string") {
  //       return (raw as string[]).map((name, idx) => ({
  //         id: String(idx),
  //         name,
  //         quantity: 1,
  //       }));
  //     }
  //     return (raw as Array<UnknownFlavor>).map((f, idx) => ({
  //       id: String(f?.id ?? idx),
  //       name:
  //         typeof f?.name === "string" && f.name
  //           ? f.name
  //           : typeof f?.flavor === "string"
  //           ? f.flavor
  //           : undefined,
  //       quantity:
  //         typeof f?.quantity === "number" ? f.quantity : Number(f?.qty ?? 1),
  //     }));
  //   }
  //   if (typeof raw === "string") {
  //     const str = raw.trim();
  //     // Try JSON first
  //     try {
  //       const parsed = JSON.parse(str);
  //       return extractFlavors(parsed);
  //     } catch {}
  //     // Fallback: comma-separated names
  //     return str
  //       .split(",")
  //       .map((s, idx) => ({ id: String(idx), name: s.trim(), quantity: 1 }));
  //   }
  //   // Unknown shape
  //   return [];
  // };

  const normalizeFlavorsForSave = (
    flavors?: Array<FlavorDTO | ProductFlavor>
  ): ProductFlavor[] => {
    if (!Array.isArray(flavors)) return [];
    return flavors.map((f) => {
      const id = String((f as FlavorDTO).id);
      const name =
        (f as FlavorDTO).name && String((f as FlavorDTO).name).trim() !== ""
          ? String((f as FlavorDTO).name)
          : getFlavorNameById(id);
      const qtyRaw = (f as FlavorDTO).quantity;
      const quantity =
        typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw || 1);
      return {
        id,
        name,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      };
    });
  };

  const fetchFlavors = async () => {
    try {
      const { data } = await apiClient.get(`/admin/flavors?_t=${Date.now()}`);
      // Handle both array format and object with flavors property
      if (Array.isArray(data)) {
        setFlavors(data);
      } else if (data && Array.isArray(data.flavors)) {
        setFlavors(data.flavors);
      } else {
        toast.error("Flavors API returned unexpected data format");
        setFlavors([]);
      }
    } catch (err) {
      toast.error("Failed to fetch flavors");

      // Check if it's an authentication error
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const errorData = err.response.data;
        if (errorData?.code === "NO_TOKEN") {
          // Show the authentication error message to user
          setError(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          toast.error(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          // Redirect to login page after a short delay to show the message
          setTimeout(() => {
            window.location.href = "/auth/login";
          }, 2000);
          return;
        }
      }

      // If the new admin endpoint doesn't exist yet, try the old one
      try {
        const { data } = await apiClient.get(
          `/3pack/admin/flavors?_t=${Date.now()}`
        );
        if (Array.isArray(data)) {
          setFlavors(data);
        } else if (data && Array.isArray(data.flavors)) {
          setFlavors(data.flavors);
        } else {
          setFlavors([]);
        }
      } catch {
        toast.error("Fallback flavors fetch also failed");
        setFlavors([]);
        setError("Failed to load flavors. Please try again.");
        toast.error("Failed to load flavors. Please try again.");
      }
    }
  };

  const fetchInventoryAlerts = async () => {
    try {
      const { data } = await apiClient.get(
        `/admin/inventory/alerts?_t=${Date.now()}`
      );
      // Handle both array format and object with alerts property
      if (Array.isArray(data)) {
        setInventoryAlerts(data);
      } else if (data && Array.isArray(data.alerts)) {
        setInventoryAlerts(data.alerts);
      } else {
        toast.error("Inventory alerts API returned unexpected data format");
        setInventoryAlerts([]);
      }
    } catch (err) {
      toast.error("Failed to fetch inventory alerts");

      // Check if it's an authentication error
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const errorData = err.response.data;
        if (errorData?.code === "NO_TOKEN") {
          // Show the authentication error message to user
          setError(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          toast.error(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          // Redirect to login page after a short delay to show the message
          setTimeout(() => {
            window.location.href = "/auth/login";
          }, 2000);
          return;
        }
      }

      setInventoryAlerts([]);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      const { data } = await apiClient.get(`/admin/config?_t=${Date.now()}`);
      // Handle both direct config object and wrapped response
      const configData = data.config || data;
      setSystemConfig(configData);
    } catch (err) {
      toast.error("Failed to fetch system config");

      // Check if it's an authentication error
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const errorData = err.response.data;
        if (errorData?.code === "NO_TOKEN") {
          // Show the authentication error message to user
          setError(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          toast.error(
            errorData.message ||
              "Authentication required. Please log in to access this resource."
          );
          // Redirect to login page after a short delay to show the message
          setTimeout(() => {
            window.location.href = "/auth/login";
          }, 2000);
          return;
        }
      }

      setSystemConfig(null);
    }
  };

  // Fetch available variants for pack products (similar to PackProductSelector)
  const fetchPackProductVariants = useCallback(async (packProduct: Product) => {
    if (!packProduct.isPackProduct || !packProduct.packType) {
      console.log("[fetchPackProductVariants] Skipping - not a pack product or no packType:", {
        isPackProduct: packProduct.isPackProduct,
        packType: packProduct.packType,
        productName: packProduct.name,
      });
      return;
    }
    
    console.log("[fetchPackProductVariants] Starting fetch for:", packProduct.name, packProduct.id, packProduct.packType);
    setLoadingPackVariants((prev) => ({ ...prev, [packProduct.id]: true }));
    
    try {
      const packType = packProduct.packType as "gold" | "platinum";
      const variants: Array<{
        productId: string;
        productName: string;
        variationId: string;
        variationName: string;
        packSize: number;
        imageUrl?: string | null;
        category: string;
      }> = [];

      if (packType === "gold") {
        // Gold: Fetch 3-pack and 4-pack products
        console.log("[fetchPackProductVariants] Fetching for Gold pack (7-pack)");
        const [threePackRes, fourPackRes] = await Promise.all([
          apiClient.get<{ products: Product[] }>("/products/by-pack-size", {
            params: { packSize: 3 },
          }),
          apiClient.get<{ products: Product[] }>("/products/by-pack-size", {
            params: { packSize: 4 },
          }),
        ]);
        
        console.log("[fetchPackProductVariants] Gold - 3-pack response:", {
          count: threePackRes.data.products?.length || 0,
          products: threePackRes.data.products?.map(p => ({
            id: p.id,
            name: p.name,
            variations: p.variations?.length || 0,
          })),
        });
        console.log("[fetchPackProductVariants] Gold - 4-pack response:", {
          count: fourPackRes.data.products?.length || 0,
          products: fourPackRes.data.products?.map(p => ({
            id: p.id,
            name: p.name,
            variations: p.variations?.length || 0,
          })),
        });

        const threePacks = threePackRes.data.products || [];
        const fourPacks = fourPackRes.data.products || [];

        // Add 3-pack variations
        threePacks.forEach((product) => {
          if (product.variations && product.variations.length > 0) {
            product.variations.forEach((variation) => {
              if (variation.isActive) {
                variants.push({
                  productId: product.id,
                  productName: product.name,
                  variationId: variation.id,
                  variationName: variation.name,
                  packSize: 3,
                  imageUrl:
                    variation.images.find((img) => img.isDefault)?.imageUrl ||
                    variation.images[0]?.imageUrl ||
                    product.imageUrl ||
                    null,
                  category: product.category,
                });
              }
            });
          }
        });

        // Add 4-pack variations
        fourPacks.forEach((product) => {
          if (product.variations && product.variations.length > 0) {
            product.variations.forEach((variation) => {
              if (variation.isActive) {
                variants.push({
                  productId: product.id,
                  productName: product.name,
                  variationId: variation.id,
                  variationName: variation.name,
                  packSize: 4,
                  imageUrl:
                    variation.images.find((img) => img.isDefault)?.imageUrl ||
                    variation.images[0]?.imageUrl ||
                    product.imageUrl ||
                    null,
                  category: product.category,
                });
              }
            });
          }
        });
      } else if (packType === "platinum") {
        // Platinum: Fetch only 3-pack products, exclude Traditional
        console.log("[fetchPackProductVariants] Fetching for Platinum pack (12-pack)");
        const threePackRes = await apiClient.get<{ products: Product[] }>(
          "/products/by-pack-size",
          {
            params: { packSize: 3 },
          }
        );
        
        console.log("[fetchPackProductVariants] Platinum - 3-pack response:", {
          count: threePackRes.data.products?.length || 0,
          products: threePackRes.data.products?.map(p => ({
            id: p.id,
            name: p.name,
            variations: p.variations?.length || 0,
            variationNames: p.variations?.map(v => v.name),
          })),
        });

        const threePacks = threePackRes.data.products || [];
        const allowedVariationNames = [
          "Sweet Best Sellers",
          "Sweet Classics",
          "Sour Best Sellers",
          "Sour Classics",
        ];

        threePacks.forEach((product) => {
          if (product.variations && product.variations.length > 0) {
            product.variations.forEach((variation) => {
              if (
                variation.isActive &&
                allowedVariationNames.includes(variation.name)
              ) {
                variants.push({
                  productId: product.id,
                  productName: product.name,
                  variationId: variation.id,
                  variationName: variation.name,
                  packSize: 3,
                  imageUrl:
                    variation.images.find((img) => img.isDefault)?.imageUrl ||
                    variation.images[0]?.imageUrl ||
                    product.imageUrl ||
                    null,
                  category: product.category,
                });
              }
            });
          }
        });
      }

      console.log(`[fetchPackProductVariants] Found ${variants.length} variants for ${packProduct.name}:`, 
        variants.map(v => `${v.variationName} (${v.packSize}-pack)`));
      
      setPackProductVariants((prev) => ({
        ...prev,
        [packProduct.id]: variants,
      }));
    } catch (error) {
      console.error(
        `[fetchPackProductVariants] Failed to fetch variants for pack product ${packProduct.id} (${packProduct.name}):`,
        error
      );
      if (axios.isAxiosError(error)) {
        console.error("[fetchPackProductVariants] Error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      }
      setPackProductVariants((prev) => ({
        ...prev,
        [packProduct.id]: [],
      }));
    } finally {
      setLoadingPackVariants((prev) => ({
        ...prev,
        [packProduct.id]: false,
      }));
      console.log(`[fetchPackProductVariants] Completed for ${packProduct.name}`);
    }
  }, []);

  // Fetch pack product variants when products change
  useEffect(() => {
    if (products.length > 0) {
      // Use same logic as fetchProducts to identify pack products
      let packProducts = products.filter((p) => p.isPackProduct === true);
      
      // If no pack products found, use alternative filter
      if (packProducts.length === 0) {
        packProducts = products.filter((p) => {
          const isPackBySize = p.packSize === 7 || p.packSize === 12;
          const isPackByName = p.name && (
            p.name.toLowerCase().includes("12 pack") || 
            p.name.toLowerCase().includes("7 pack")
          );
          return isPackBySize || isPackByName;
        });
        
        // Infer packType for products that don't have it
        packProducts = packProducts.map((p) => {
          if (!p.packType) {
            const nameLower = p.name?.toLowerCase() || "";
            if (nameLower.includes("platinum") || p.packSize === 12) {
              return { ...p, packType: "platinum", isPackProduct: true };
            } else if (nameLower.includes("gold") || p.packSize === 7) {
              return { ...p, packType: "gold", isPackProduct: true };
            }
          }
          return { ...p, isPackProduct: true };
        });
      }
      
      console.log("[useEffect] Products changed, found pack products:", packProducts.length);
      packProducts.forEach((packProduct) => {
        console.log("[useEffect] Fetching variants for:", packProduct.name, packProduct.packType);
        fetchPackProductVariants(packProduct).catch((err) => {
          console.error(`[useEffect] Error fetching variants:`, err);
        });
      });
    }
  }, [products, fetchPackProductVariants]);

  // Product-related functions
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      const q = String(search || "").trim();
      if (q) params.set("search", q);
      const cat = String(categoryFilter || "").trim();
      if (cat) params.set("category", cat);

      const { data } = await apiClient.get<{
        products: Product[];
        pagination?: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/products/admin/all?${params.toString()}`);

      console.log("Fetched products:", data.products);
      // Log variations for debugging
      data.products?.forEach((p, idx) => {
        if (p.variations && p.variations.length > 0) {
          console.log(
            `Product ${idx} (${p.name}) has ${p.variations.length} variations:`,
            p.variations
          );
        }
      });

      const fetchedProducts = Array.isArray(data.products) ? data.products : [];
      
      // Debug: Check for pack products
      console.log("[Admin Dashboard] Checking all products for isPackProduct flag:");
      fetchedProducts.forEach((p, idx) => {
        console.log(`Product ${idx}: ${p.name}`, {
          isPackProduct: p.isPackProduct,
          packType: p.packType,
          packSize: p.packSize,
          id: p.id,
        });
      });
      
      setProducts(fetchedProducts);
      
      // Fetch available variants for pack products (7-pack and 12-pack)
      // First try standard filter
      let packProducts = fetchedProducts.filter((p) => p.isPackProduct === true);
      
      // If no pack products found, use alternative filter based on packSize or name
      if (packProducts.length === 0) {
        packProducts = fetchedProducts.filter((p) => {
          // Check if it's a pack product by packSize (7 or 12) or name
          const isPackBySize = p.packSize === 7 || p.packSize === 12;
          const isPackByName = p.name && (
            p.name.toLowerCase().includes("12 pack") || 
            p.name.toLowerCase().includes("7 pack")
          );
          return isPackBySize || isPackByName;
        });
        
        // Infer packType from name or packSize for products that don't have it
        packProducts = packProducts.map((p) => {
          if (!p.packType) {
            // Infer packType from name
            const nameLower = p.name?.toLowerCase() || "";
            if (nameLower.includes("platinum") || p.packSize === 12) {
              return { ...p, packType: "platinum", isPackProduct: true };
            } else if (nameLower.includes("gold") || p.packSize === 7) {
              return { ...p, packType: "gold", isPackProduct: true };
            }
          }
          return { ...p, isPackProduct: true };
        });
        
        console.log("[Admin Dashboard] Using alternative filter, found pack products:", packProducts.length);
        packProducts.forEach(p => {
          console.log("  -", p.name, { 
            isPackProduct: p.isPackProduct, 
            packType: p.packType,
            packSize: p.packSize 
          });
        });
      } else {
        console.log("[Admin Dashboard] Found pack products:", packProducts.length);
      }
      
      for (const packProduct of packProducts) {
        console.log("[Admin Dashboard] Fetching variants for:", packProduct.name, packProduct.id, packProduct.packType);
        fetchPackProductVariants(packProduct).catch((err) => {
          console.error(`[Admin Dashboard] Error fetching variants for ${packProduct.name}:`, err);
        });
      }
    } catch (e) {
      // Fallback: try alternate mount
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        try {
          const params = new URLSearchParams();
          params.set("page", String(page));
          params.set("limit", String(limit));
          const q = String(search || "").trim();
          if (q) params.set("search", q);
          const cat = String(categoryFilter || "").trim();
          if (cat) params.set("category", cat);
          const { data } = await apiClient.get<{
            products: Product[];
            pagination?: {
              page: number;
              limit: number;
              total: number;
              pages: number;
            };
          }>(`/admin/all?${params.toString()}`);
          const fetchedProducts = Array.isArray(data.products) ? data.products : [];
          setProducts(fetchedProducts);
          setError(null);
          
          // Fetch available variants for pack products
          const packProducts = fetchedProducts.filter((p) => p.isPackProduct === true);
          console.log("[Admin Dashboard] Found pack products (fallback):", packProducts.length);
          for (const packProduct of packProducts) {
            console.log("[Admin Dashboard] Fetching variants for (fallback):", packProduct.name, packProduct.id);
            fetchPackProductVariants(packProduct).catch((err) => {
              console.error(`[Admin Dashboard] Error fetching variants for ${packProduct.name}:`, err);
            });
          }
        } catch (e2) {
          const message =
            (e2 as { message?: string })?.message ||
            "Unable to load products. Please try again.";
          setError(message);
          toast.error(message);
          setProducts([]);
        }
      } else {
        const message =
          (e as { message?: string })?.message ||
          "Unable to load products. Please try again.";
        setError(message);
        toast.error(message);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, categoryFilter, fetchPackProductVariants]);

  const fetchProductCategories = useCallback(async () => {
    try {
      // Try admin endpoint first (returns full objects)
      const { data: adminData } = await apiClient.get<{
        categories: Array<{ id: string; name: string; productCount: number }>;
      }>(`/admin/categories`);
      if (adminData?.categories) {
        setCategoryObjects(adminData.categories);
        setProductCategories(adminData.categories.map((c) => c.name));
        return;
      }
    } catch {
      // Fallback to public endpoint (returns just strings)
      try {
        const { data } = await apiClient.get<string[]>(`/products/categories`);
        if (Array.isArray(data)) {
          setProductCategories(data);
          setCategoryObjects(
            data.map((name) => ({ id: "", name, productCount: 0 }))
          );
        }
      } catch (e2) {
        console.error("Failed to fetch categories:", e2);
      }
    }
  }, []);

  const createCategory = async () => {
    if (!newCategory.trim()) {
      setError("Category name is required");
      toast.error("Category name is required");
      return;
    }

    setCreatingCategory(true);
    setError(null);
    try {
      await apiClient.post(`/admin/categories`, { name: newCategory.trim() });

      // Refresh categories list
      await fetchProductCategories();
      setNewCategory("");
      toast.success("Category created successfully");
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create category";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreatingCategory(false);
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" category?`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/categories/${id}`);

      await fetchProductCategories();
      toast.success("Category deleted successfully");
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete category";
      toast.error(errorMessage);
    }
  };

  const fetchAvailableFlavors = useCallback(async () => {
    try {
      // Try new admin endpoint first
      const { data } = await apiClient.get(`/admin/flavors`);
      // Handle both array format and object with flavors property
      const flavorsArray = Array.isArray(data) ? data : data?.flavors || [];
      // Filter only active flavors and map to the expected format
      const activeFlavors = flavorsArray
        .filter((flavor: { active: boolean }) => flavor.active)
        .map((flavor: { id: string; name: string }) => ({
          id: flavor.id,
          name: flavor.name,
        }));
      setAvailableFlavors(activeFlavors);
    } catch {
      // Fallback to old endpoint
      try {
        const { data } = await apiClient.get(`/3pack/admin/flavors`);
        const flavorsArray = Array.isArray(data) ? data : data?.flavors || [];
        const activeFlavors = flavorsArray
          .filter((flavor: { active: boolean }) => flavor.active)
          .map((flavor: { id: string; name: string }) => ({
            id: flavor.id,
            name: flavor.name,
          }));
        setAvailableFlavors(activeFlavors);
      } catch {
        toast.error("Failed to load flavors");
        setAvailableFlavors([]);
      }
    }
  }, []);

  const createFlavor = async () => {
    if (!newFlavor.name.trim()) {
      setError("Flavor name is required");
      toast.error("Flavor name is required");
      return;
    }

    setCreatingFlavor(true);
    setError(null);
    try {
      const aliasesArray = newFlavor.aliases
        .split(",")
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("name", newFlavor.name.trim());
      formData.append("aliases", JSON.stringify(aliasesArray));
      formData.append("active", "true");

      if (flavorImageFile) {
        formData.append("flavorImage", flavorImageFile);
      }

      await apiClient.post(`/admin/flavors`, formData, {
        // Don't set Content-Type manually - let axios handle it for FormData
      });

      // Refresh the flavors list to ensure we have the complete data
      await fetchFlavors();
      setNewFlavor({ name: "", aliases: "", active: true });
      setFlavorImageFile(null);
      setFlavorImagePreview(null);
      toast.success("Flavor created successfully");
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create flavor";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreatingFlavor(false);
    }
  };

  const deleteFlavor = async (flavorId: string) => {
    setDeletingFlavor((prev) => ({ ...prev, [flavorId]: true }));
    setDeletingFromModal(true);
    setError(null);
    try {
      await apiClient.delete(`/admin/flavors/${flavorId}`);

      // Remove the flavor from the flavors list
      setFlavors((prev) => prev.filter((f) => f.id !== flavorId));

      // Remove the flavor from available flavors
      setAvailableFlavors((prev) => prev.filter((f) => f.id !== flavorId));

      // Refresh the flavors list to ensure consistency
      try {
        await fetchFlavors();
      } catch (refreshError) {
        console.error("Error refreshing flavors after deletion:", refreshError);
        // Don't fail the deletion if refresh fails
      }

      toast.success("Flavor deleted successfully");

      // Close modal after successful deletion
      setDeleteFlavorModal({ isOpen: false, flavorId: null, flavorName: "" });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete flavor";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingFlavor((prev) => ({ ...prev, [flavorId]: false }));
      setDeletingFromModal(false);
    }
  };

  const handleDeleteFlavorClick = (flavor: Flavor) => {
    setDeleteFlavorModal({
      isOpen: true,
      flavorId: flavor.id,
      flavorName: flavor.name,
    });
  };

  const handleConfirmDeleteFlavor = () => {
    if (deleteFlavorModal.flavorId) {
      deleteFlavor(deleteFlavorModal.flavorId);
    }
  };

  const handleCancelDeleteFlavor = () => {
    setDeleteFlavorModal({
      isOpen: false,
      flavorId: null,
      flavorName: "",
    });
  };

  const handleEditProductClick = async (product: Product) => {
    console.log("Edit product clicked:", product);
    console.log("Product variations:", product.variations);

    // If product has ID but no variations in the data, fetch them
    let productWithVariations = {
      ...product,
      description: product.description ?? undefined,
    };

    if (
      product.id &&
      (!product.variations || product.variations.length === 0)
    ) {
      try {
        console.log("Fetching variations for product:", product.id);
        const variationsResponse = await apiClient.get(
          `/variations/product/${product.id}`
        );
        console.log("Fetched variations:", variationsResponse.data);

        if (
          variationsResponse.data?.variations &&
          variationsResponse.data.variations.length > 0
        ) {
          productWithVariations = {
            ...productWithVariations,
            variations: variationsResponse.data.variations,
          };
        }
      } catch (err) {
        console.error("Error fetching variations:", err);
        // Continue with product data even if variations fetch fails
      }
    }

    setEditProductModal({
      isOpen: true,
      product: productWithVariations,
    });
  };

  const handleCloseEditProduct = () => {
    setEditProductModal({
      isOpen: false,
      product: null,
    });
    // Refresh products when modal closes to get updated variations
    fetchProducts();
  };

  const handleSaveProduct = (
    updatedProduct: Product,
    imageFile?: File | null
  ) => {
    // Note: EditProductModal now handles all saving internally
    // This function is kept for compatibility but the modal does the actual saving
    // The modal will close and trigger handleCloseEditProduct which refreshes the list
    // No-op function since modal handles everything
    void updatedProduct;
    void imageFile;
  };

  const handleEditFlavorClick = (flavor: Flavor) => {
    console.log("Edit flavor clicked:", flavor);
    setEditFlavorModal({
      isOpen: true,
      flavor: flavor,
    });
  };

  const handleCloseEditFlavor = () => {
    setEditFlavorModal({
      isOpen: false,
      flavor: null,
    });
  };

  const handleSaveFlavor = async (
    updatedFlavor: Flavor,
    imageFile?: File | null
  ) => {
    setSaving(true);
    try {
      const { id } = updatedFlavor;

      if (!id) {
        throw new Error("Missing flavor ID");
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("name", updatedFlavor.name);
      formData.append("aliases", JSON.stringify(updatedFlavor.aliases));
      formData.append("active", String(updatedFlavor.active));

      if (imageFile) {
        formData.append("flavorImage", imageFile);
      }

      await apiClient.put(`/admin/flavors/${id}`, formData);

      // Refresh the flavors list to ensure consistency
      await fetchFlavors();

      setEditFlavorModal({
        isOpen: false,
        flavor: null,
      });
      toast.success("Flavor updated successfully");
    } catch {
      toast.error("Failed to update flavor");
    } finally {
      setSaving(false);
    }
  };

  // Commented out unused updateFlavorAdmin function
  // const updateFlavorAdmin = async (id: string) => {
  //   const API_URL = process.env.NEXT_PUBLIC_API_URL;
  //   setError(null);
  //   try {
  //     // Validate file size before upload
  //     if (editFlavorImageFile && !validateFileSize(editFlavorImageFile, 50)) {
  //       setError(
  //         "Image file is too large. Please compress the image and try again."
  //       );
  //       toast.error(
  //         "Image file is too large. Please compress the image and try again."
  //       );
  //       return;
  //     }
  //
  //     const aliasesArray = editFlavorData.aliases
  //       .split(",")
  //       .map((alias) => alias.trim())
  //       .filter((alias) => alias.length > 0);
  //
  //     // Create FormData for file upload
  //     const formData = new FormData();
  //     formData.append("name", editFlavorData.name.trim());
  //     formData.append("aliases", JSON.stringify(aliasesArray));
  //     formData.append("active", editFlavorData.active.toString());
  //
  //     if (editFlavorImageFile) {
  //       formData.append("flavorImage", editFlavorImageFile);
  //     }
  //
  //     const { data } = await axios.put(
  //       `${API_URL}/admin/flavors/${id}`,
  //       formData,
  //       {
  //         withCredentials: true,
  //         // Don't set Content-Type manually - let axios handle it for FormData
  //       }
  //     );
  //
  //     // Update the flavor in state with fresh data
  //     const updatedFlavor = data.flavor || data;
  //     setFlavors((prev) =>
  //       prev.map((f) =>
  //         f.id === id
  //           ? { ...updatedFlavor, updatedAt: new Date().toISOString() }
  //           : f
  //       )
  //     );
  //
  //     setEditingFlavor(null);
  //     setEditFlavorImageFile(null);
  //     setEditFlavorImagePreview(null);
  //
  //     // Refresh the flavors list to ensure consistency
  //     await fetchFlavors();
  //   } catch (err: unknown) {
  //     const errorResponse = err as {
  //       response?: {
  //         status?: number;
  //         data?: {
  //           message?: string;
  //           code?: string;
  //           maxSize?: string;
  //         };
  //       };
  //     };
  //
  //     if (errorResponse?.response?.status === 413) {
  //       setError(
  //         "File too large. Please compress your image and try again. Maximum size is 50MB."
  //       );
  //       toast.error(
  //         "File too large. Please compress your image and try again. Maximum size is 50MB."
  //       );
  //     } else {
  //       const errorMessage =
  //         errorResponse?.response?.data?.message || "Failed to update flavor";
  //       setError(errorMessage);
  //       toast.error(errorMessage);
  //     }
  //   }
  // };

  // Product management functions
  const resetForm = () => {
    setForm({
      name: "",
      price: 0,
      category: "",
      description: "",
      imageUrl: "",
      sku: "",
      flavors: [],
      supportLevel: "",
      packSize: null,
      isPackProduct: false,
      packType: null,
    });
    setVariations([]);
    // Clean up nutrition facts
    nutritionFactsFiles.forEach((nf) => {
      if (nf.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(nf.preview);
      }
    });
    setNutritionFactsFiles([]);
    setExistingNutritionFacts([]);
  };

  // Commented out unused flavor management functions
  // const addFlavor = () => {
  //   if (form.flavors && form.flavors.length < 3) {
  //     setForm((prev) => ({
  //       ...prev,
  //       flavors: [...(prev.flavors || []), { id: "", name: "", quantity: 1 }],
  //     }));
  //   }
  // };

  // const removeFlavor = (index: number) => {
  //   setForm((prev) => ({
  //     ...prev,
  //     flavors: prev.flavors?.filter((_, i) => i !== index) || [],
  //   }));
  // };

  // const updateFlavor = (
  //   index: number,
  //   field: keyof ProductFlavor,
  //   value: string | number
  // ) => {
  //   setForm((prev) => {
  //     const nextFlavors = [...(prev.flavors || [])];
  //     const current = nextFlavors[index] || { id: "", name: "", quantity: 1 };
  //     if (field === "id") {
  //       const selected = availableFlavors.find((f) => f.id === value);
  //       nextFlavors[index] = {
  //         ...current,
  //         id: String(value || ""),
  //         name: selected?.name || current.name || "",
  //       };
  //     } else {
  //       nextFlavors[index] = { ...current, [field]: value } as ProductFlavor;
  //     }
  //     return { ...prev, flavors: nextFlavors };
  //   });
  // };

  const createProduct = async () => {
    setSaving(true);
    setError(null);
    try {
      // Log variations before creating product
      console.log("=== Creating Product ===");
      console.log("Variations state:", variations);
      console.log("Variations count:", variations.length);
      if (variations.length > 0) {
        variations.forEach((v, idx) => {
          console.log(`Variation ${idx + 1}:`, {
            name: v.name,
            flavorsCount: v.flavors?.length || 0,
            hasImage: !!v.imageFile,
          });
        });
      }

      const fd = new FormData();
      fd.append("name", String(form.name || ""));
      fd.append("price", String(Number(form.price || 0)));
      fd.append("stock", String(Number(form.stock || 0)));
      fd.append("category", String(form.category || ""));
      if (form.description) fd.append("description", form.description);
      fd.append("isActive", String(!!form.isActive));
      if (form.sku) fd.append("sku", form.sku);
      if (form.supportLevel) fd.append("supportLevel", form.supportLevel);
      if (form.packSize) fd.append("packSize", String(form.packSize));
      if (form.isPackProduct !== undefined)
        fd.append("isPackProduct", String(form.isPackProduct));
      if (form.packType) fd.append("packType", form.packType);
      if (Array.isArray(form.flavors)) {
        fd.append(
          "flavors",
          JSON.stringify(normalizeFlavorsForSave(form.flavors))
        );
      }
      if (imageFile) fd.append("productImage", imageFile);
      if (!imageFile && form.imageUrl) fd.append("imageUrl", form.imageUrl);

      // Add multiple nutrition facts files if provided
      nutritionFactsFiles.forEach((nf) => {
        fd.append("nutritionFacts", nf.file);
      });

      console.log("Creating product...");
      const response = await apiClient.post<{
        message: string;
        product: { id: string };
      }>(`/products/admin/products`, fd);

      console.log("Product creation response:", response.data);

      // API returns { message: "...", product: { id: "..." } }
      const responseData = response.data as {
        product?: { id: string };
        id?: string;
        message?: string;
      };
      const productId = responseData?.product?.id || responseData?.id;
      console.log("Product created with ID:", productId);

      if (!productId) {
        console.error("Product ID is missing from response:", response.data);
        throw new Error("Product created but ID not returned");
      }

      // Create variations if any
      console.log("Checking variations:", {
        variationsLength: variations.length,
        productId: productId,
        willCreate: variations.length > 0 && productId,
      });

      if (variations.length > 0 && productId) {
        console.log(`Starting to create ${variations.length} variations...`);
        let createdCount = 0;
        let skippedCount = 0;
        for (const variation of variations) {
          try {
            // Validate variation before creating
            if (!variation.name || variation.name.trim() === "") {
              console.warn("Skipping variation with empty name:", variation);
              skippedCount++;
              continue;
            }

            console.log(`Creating variation "${variation.name}"...`);

            const variationFd = new FormData();
            variationFd.append("name", variation.name.trim());

            // Handle flavors - filter out empty ones
            if (variation.flavors && variation.flavors.length > 0) {
              const flavorsToSave = variation.flavors
                .filter((f) => f.name && f.name.trim() !== "")
                .map((f) => ({
                  name: f.name,
                  quantity: f.quantity || 1,
                }));
              variationFd.append("flavors", JSON.stringify(flavorsToSave));
            } else {
              variationFd.append("flavors", JSON.stringify([]));
            }

            // Create variation (image will be uploaded separately)
            console.log(`Creating variation: ${variation.name}`, {
              flavors: variation.flavors,
              hasImage: !!variation.imageFile,
            });

            const variationResponse = await apiClient.post(
              `/variations/product/${productId}`,
              variationFd,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );

            // Add image to variation if provided
            console.log("Variation creation response:", variationResponse.data);
            const variationId =
              variationResponse.data?.variation?.id ||
              variationResponse.data?.id;
            console.log("Extracted variation ID:", variationId);

            if (variation.imageFile && variationId) {
              console.log(`Uploading image for variation ${variationId}`);
              const imageFd = new FormData();
              imageFd.append("productImage", variation.imageFile);
              imageFd.append("isDefault", "true");

              await apiClient.post(
                `/variations/${variationId}/images`,
                imageFd,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                  },
                }
              );
              console.log(
                `Image uploaded successfully for variation ${variationId}`
              );
            } else if (variation.imageFile && !variationId) {
              console.error(
                "Variation created but no ID in response:",
                variationResponse.data
              );
              toast.warning(
                `Variation "${variation.name}" created but image upload failed - no variation ID returned`
              );
            }

            console.log(`Variation "${variation.name}" created successfully`);
            createdCount++;
          } catch (variationError: unknown) {
            console.error("Error creating variation:", variationError);
            const error = variationError as {
              response?: { data?: { message?: string }; status?: number };
              message?: string;
            };
            console.error("Error details:", {
              message: error?.message,
              response: error?.response?.data,
              status: error?.response?.status,
            });
            const errorMsg =
              error?.response?.data?.message ||
              error?.message ||
              "Unknown error";
            toast.warning(
              `Product created but failed to create variation "${variation.name}": ${errorMsg}`
            );
          }
        }
        console.log(`=== Variation Creation Summary ===`);
        console.log(`Total variations: ${variations.length}`);
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped: ${skippedCount}`);
        if (createdCount > 0) {
          toast.success(`Product created with ${createdCount} variation(s)`);
        }
      } else {
        console.log("No variations to create or product ID missing");
      }

      // Refresh the products list to ensure we have the complete data
      await fetchProducts();
      resetForm();
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(null);
      setImageFile(null);
      // Clean up nutrition facts preview URLs
      nutritionFactsFiles.forEach((nf) => {
        if (nf.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(nf.preview);
        }
      });
      setNutritionFactsFiles([]);
      toast.success("Product created successfully");
    } catch {
      const message = "Unable to create product. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updateProductByRow = async (
    row: Product,
    overrides: Partial<Product>,
    imageFile?: File | null
  ) => {
    setSaving(true);
    setError(null);
    try {
      const id = row.id;
      if (!id) {
        setError("Missing product id");
        toast.error("Missing product id");
        setSaving(false);
        return;
      }
      // Check if there's a file to upload
      const hasFile = imageFile;

      let dataResp: Product;

      if (hasFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append("name", overrides.name ?? row.name ?? "");
        formData.append(
          "price",
          String(Number(overrides.price ?? row.price ?? 0))
        );
        formData.append(
          "stock",
          String(Number(overrides.stock ?? row.stock ?? 0))
        );
        formData.append("category", overrides.category ?? row.category ?? "");
        formData.append(
          "description",
          overrides.description ?? row.description ?? ""
        );
        formData.append(
          "isActive",
          String(overrides.isActive ?? row.isActive ?? true)
        );
        formData.append("sku", overrides.sku ?? row.sku ?? "");
        if (overrides.supportLevel !== undefined) {
          formData.append(
            "supportLevel",
            overrides.supportLevel ?? row.supportLevel ?? ""
          );
        }
        if (overrides.packSize !== undefined) {
          formData.append(
            "packSize",
            String(overrides.packSize ?? row.packSize ?? "")
          );
        }
        if (overrides.isPackProduct !== undefined) {
          formData.append(
            "isPackProduct",
            String(overrides.isPackProduct ?? row.isPackProduct ?? false)
          );
        }
        if (overrides.packType !== undefined) {
          formData.append("packType", overrides.packType ?? row.packType ?? "");
        }
        formData.append(
          "flavors",
          JSON.stringify(
            normalizeFlavorsForSave(overrides.flavors ?? row.flavors)
          )
        );
        formData.append("productImage", hasFile);

        // Add multiple nutrition facts files if provided
        nutritionFactsFiles.forEach((nf) => {
          formData.append("nutritionFacts", nf.file);
        });

        // Optimistic update
        setProducts((cur) =>
          cur.map((p) => (p.id === id ? { ...p, ...overrides } : p))
        );

        try {
          // Primary route with FormData
          const { data } = await apiClient.put<Product>(
            `/products/admin/${id}`,
            formData
          );
          dataResp = data;
        } catch (e) {
          if (axios.isAxiosError(e) && e.response?.status === 404) {
            // Fallback legacy mount
            const { data } = await apiClient.put<Product>(
              `/products/admin/products/${id}`,
              formData
            );
            dataResp = data;
          } else {
            throw e;
          }
        }
      } else {
        // Use JSON payload for non-file updates
        const payload = {
          name: overrides.name ?? row.name,
          price: Number(overrides.price ?? row.price ?? 0),
          stock: Number(overrides.stock ?? row.stock ?? 0),
          category: overrides.category ?? row.category,
          description: overrides.description ?? row.description,
          imageUrl: overrides.imageUrl ?? row.imageUrl,
          imageBase64:
            (overrides as { imageBase64?: string }).imageBase64 || undefined,
          isActive: overrides.isActive ?? row.isActive ?? true,
          sku: overrides.sku ?? row.sku,
          supportLevel: overrides.supportLevel ?? row.supportLevel ?? null,
          packSize: overrides.packSize ?? row.packSize ?? null,
          isPackProduct: overrides.isPackProduct ?? row.isPackProduct ?? false,
          packType: overrides.packType ?? row.packType ?? null,
          flavors: normalizeFlavorsForSave(overrides.flavors ?? row.flavors),
        };

        // Optimistic update
        setProducts((cur) =>
          cur.map((p) => (p.id === id ? { ...p, ...payload } : p))
        );

        try {
          // Primary route
          const { data } = await apiClient.put<Product>(
            `/products/admin/${id}`,
            payload,
            {
              headers: { "Content-Type": "application/json" },
            }
          );
          dataResp = data;
        } catch (e) {
          if (axios.isAxiosError(e) && e.response?.status === 404) {
            // Fallback legacy mount
            const { data } = await apiClient.put<Product>(
              `/products/admin/products/${id}`,
              payload,
              {
                headers: { "Content-Type": "application/json" },
              }
            );
            dataResp = data;
          } else {
            throw e;
          }
        }
      }
      const updated = dataResp as Product;
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
    } catch (e) {
      const message =
        (e as { message?: string })?.message || "Failed to update product";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    setDeletingFromModal(true);
    setError(null);
    try {
      try {
        // Primary route (mirrors updateProduct primary)
        await apiClient.delete(`/products/admin/${id}`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // Fallback legacy mount
          await apiClient.delete(`/products/admin/products/${id}`);
        } else {
          throw error;
        }
      }

      // Remove product from local state
      setProducts((prev) => prev.filter((p) => p.id !== id));

      // Refresh the products list to ensure consistency
      try {
        await fetchProducts();
      } catch (refreshError) {
        console.error(
          "Error refreshing products after deletion:",
          refreshError
        );
        // Don't fail the deletion if refresh fails
      }

      toast.success("Product deleted successfully");
      // Close modal after successful deletion
      setDeleteModal({ isOpen: false, productId: null, productName: "" });
    } catch (e) {
      const message =
        (e as { message?: string })?.message ||
        "Unable to delete product. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
      setDeletingFromModal(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setDeleteModal({
      isOpen: true,
      productId: product.id,
      productName: product.name,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteModal.productId) {
      deleteProduct(deleteModal.productId);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({
      isOpen: false,
      productId: null,
      productName: "",
    });
  };

  const updateInventory = async (flavorId: string, newStock: number) => {
    setUpdatingInventory((prev) => ({ ...prev, [flavorId]: true }));
    setError(null);
    try {
      await apiClient.put(`/admin/inventory/${flavorId}`, { stock: newStock });

      await fetchInventoryAlerts(); // Refresh alerts
      await fetchFlavors(); // Refresh flavors with updated inventory data
    } catch {
      setError("Failed to update inventory");
      toast.error("Failed to update inventory");
    } finally {
      setUpdatingInventory((prev) => ({ ...prev, [flavorId]: false }));
    }
  };

  // Commented out unused totalPages calculation
  // const totalPages = useMemo(
  //   () => Math.max(1, pagination?.pages || 1),
  //   [pagination?.pages]
  // );

  const fetchData = useCallback(async () => {
    if (!user || user.role !== "admin") {
      return; // Don't fetch data if user is not authenticated as admin
    }

    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case "products":
          await fetchProducts();
          await fetchProductCategories();
          await fetchAvailableFlavors();
          break;
        case "flavors":
          await fetchFlavors();
          break;
        case "categories":
          await fetchProductCategories();
          break;
        case "inventory":
          await fetchInventoryAlerts();
          break;
        case "config":
          await fetchSystemConfig();
          break;
      }
    } catch (fetchError) {
      console.error("Error fetching data:", fetchError);
      setError("Failed to load data");
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    fetchProducts,
    fetchProductCategories,
    fetchAvailableFlavors,
    user,
  ]);

  // Main data fetching effect
  useEffect(() => {
    if (!userLoading && user && user.role === "admin") {
      fetchData();
      if (activeTab === "products") {
        fetchProducts();
        fetchProductCategories();
        fetchAvailableFlavors();
      }
    }
  }, [
    user,
    userLoading,
    activeTab,
    fetchData,
    fetchProducts,
    fetchProductCategories,
    fetchAvailableFlavors,
  ]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
          <p className="text-black text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // GlobalVerificationCheck will handle redirects
  // Just show loading while checking or if not admin
  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
          <p className="text-black text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users (GlobalVerificationCheck should redirect)
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
          <p className="text-black text-lg">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-black mb-4 sm:mb-6">
        Add Product
      </h1>

      {error && (
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg border-l-4 border-red-400 bg-red-50 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-2 sm:ml-3 flex-1">
              <p className="text-xs sm:text-sm text-red-800 font-medium whitespace-pre-line">
                {error}
              </p>
            </div>
            <div className="ml-2 sm:ml-3 flex-shrink-0">
              <button
                onClick={() => setError(null)}
                className="inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:text-red-600 transition ease-in-out duration-150"
              >
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hamburger Menu */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
            Admin Panel
          </h2>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-[#FF5D39] hover:bg-gray-100 focus:outline-none transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {[
              { id: "products", label: "Products", icon: "📦" },
              { id: "flavors", label: "Flavors", icon: "🍭" },
              { id: "categories", label: "Categories", icon: "🏷️" },
              { id: "inventory", label: "Inventory", icon: "📊" },
              { id: "config", label: "Config", icon: "⚙️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(
                    tab.id as
                      | "products"
                      | "flavors"
                      | "categories"
                      | "inventory"
                      | "config"
                  );
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#FF5D39] text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Add new product form */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">
              Add new product
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-medium text-black mb-2">
                  Product details
                </h3>
                <hr className="border-gray-200 mb-3 sm:mb-4" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Product name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Price
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price === 0 ? "" : form.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string, numbers, and decimals
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        const numValue = value === "" ? 0 : parseFloat(value);
                        setForm({
                          ...form,
                          price: isNaN(numValue) ? 0 : numValue,
                        });
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure value is a valid number on blur
                      const value = e.target.value;
                      const numValue = value === "" ? 0 : parseFloat(value);
                      setForm({
                        ...form,
                        price: isNaN(numValue) ? 0 : Math.max(0, numValue),
                      });
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{
                      appearance: "textfield",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Stock
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.stock === 0 ? "" : form.stock}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string and integers only
                      if (value === "" || /^\d+$/.test(value)) {
                        const numValue = value === "" ? 0 : parseInt(value);
                        setForm({
                          ...form,
                          stock: isNaN(numValue) ? 0 : numValue,
                        });
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure value is a valid integer on blur
                      const value = e.target.value;
                      const numValue = value === "" ? 0 : parseInt(value);
                      setForm({
                        ...form,
                        stock: isNaN(numValue) ? 0 : Math.max(0, numValue),
                      });
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{
                      appearance: "textfield",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="e.g., 3P-SWE-WAT-BERRY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Description (Notepad Style - Supports Formatting)
                  </label>
                  <div className="space-y-2">
                    <textarea
                      value={form.description || ""}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Enter product description with formatting...

## Main Heading
### Subheading
- Bullet point 1
- Bullet point 2
- Bullet point 3

Regular paragraph text here..."
                      rows={12}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] focus:border-[#FF5D39] text-sm sm:text-base resize-y font-mono text-gray-900 bg-gray-50"
                      style={{ minHeight: "200px" }}
                    />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                      <p className="font-semibold mb-1">Formatting Guide:</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>
                          <code className="bg-blue-100 px-1 rounded">
                            ## Heading
                          </code>{" "}
                          - Main heading
                        </li>
                        <li>
                          <code className="bg-blue-100 px-1 rounded">
                            ### Subheading
                          </code>{" "}
                          - Subheading
                        </li>
                        <li>
                          <code className="bg-blue-100 px-1 rounded">
                            - Item
                          </code>{" "}
                          or{" "}
                          <code className="bg-blue-100 px-1 rounded">
                            * Item
                          </code>{" "}
                          - Bullet point
                        </li>
                        <li>Empty line - Paragraph break</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  >
                    <option value="">Select category</option>
                    {productCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Support Level and Pack Size */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Support Level
                  </label>
                  <select
                    value={form.supportLevel || ""}
                    onChange={(e) =>
                      setForm({ ...form, supportLevel: e.target.value || null })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  >
                    <option value="">None (Regular Product)</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Pack Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.packSize || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === "" ? null : parseInt(e.target.value);
                      setForm({ ...form, packSize: value });
                    }}
                    placeholder="e.g., 3, 4, 7, 12"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  />
                </div>

                {/* Pack Product Fields */}
                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    <input
                      type="checkbox"
                      checked={form.isPackProduct || false}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          isPackProduct: e.target.checked,
                          packType: e.target.checked ? form.packType : null,
                        })
                      }
                      className="w-4 h-4 text-[#FF5D39] border-gray-300 rounded focus:ring-[#FF5D39]"
                    />
                    <span>Is Pack Product (Gold/Platinum Supporter)</span>
                  </label>
                </div>

                {form.isPackProduct && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Pack Type
                    </label>
                    <select
                      value={form.packType || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          packType: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                    >
                      <option value="">Select Pack Type</option>
                      <option value="gold">Gold Supporter</option>
                      <option value="platinum">Platinum Supporter</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Flavors Selection Section */}
              <div>
                <h3 className="text-sm sm:text-base font-medium text-black mb-2">
                  Product Flavors
                </h3>
                <hr className="border-gray-200 mb-3 sm:mb-4" />
                <p className="text-xs text-gray-600 mb-3">
                  Add up to 3 flavors for this pack product. Each flavor can
                  have a specific quantity.
                </p>

                {/* Info Notifier */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-900 mb-1">
                        Need to add a new flavor?
                      </p>
                      <p className="text-xs text-blue-700 mb-2">
                        You can only select from existing flavors here. To
                        create a new flavor, please go to the Flavors tab.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("flavors")}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                      >
                        → Go to Flavors Tab
                      </button>
                    </div>
                  </div>
                </div>

                {form.flavors && form.flavors.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {form.flavors.map((flavor, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Flavor
                          </label>
                          <select
                            value={flavor.id || ""}
                            onChange={(e) => {
                              const selectedFlavor = availableFlavors.find(
                                (f) => f.id === e.target.value
                              );
                              const newFlavors = [...(form.flavors || [])];
                              newFlavors[index] = {
                                ...newFlavors[index],
                                id: e.target.value,
                                name: selectedFlavor?.name || "",
                              };
                              setForm({ ...form, flavors: newFlavors });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm text-gray-900"
                          >
                            <option value="">Select flavor</option>
                            {availableFlavors.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-24">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={flavor.quantity || 1}
                            onChange={(e) => {
                              const newFlavors = [...(form.flavors || [])];
                              newFlavors[index] = {
                                ...newFlavors[index],
                                quantity: parseInt(e.target.value) || 1,
                              };
                              setForm({ ...form, flavors: newFlavors });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm text-gray-900"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newFlavors =
                                form.flavors?.filter((_, i) => i !== index) ||
                                [];
                              setForm({ ...form, flavors: newFlavors });
                            }}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(!form.flavors || form.flavors.length < 3) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newFlavors = [
                        ...(form.flavors || []),
                        { id: "", name: "", quantity: 1 },
                      ];
                      setForm({ ...form, flavors: newFlavors });
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    + Add Flavor
                  </button>
                )}

                {form.flavors && form.flavors.length >= 3 && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Maximum of 3 flavors reached
                  </p>
                )}
              </div>

              {/* Product Variations Section */}
              <div>
                <h3 className="text-sm sm:text-base font-medium text-black mb-2">
                  Product Variations
                </h3>
                <hr className="border-gray-200 mb-3 sm:mb-4" />
                <p className="text-xs text-gray-600 mb-3">
                  Add variation options for this product. Each variation can
                  have different flavor combinations and its own image.
                </p>

                {variations.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {variations.map((variation, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-sm text-gray-900">
                            Variation {index + 1}: {variation.name || "Unnamed"}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newVariations = variations.filter(
                                (_, i) => i !== index
                              );
                              setVariations(newVariations);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Variation Name
                            </label>
                            <input
                              type="text"
                              value={variation.name || ""}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].name = e.target.value;
                                setVariations(newVariations);
                              }}
                              placeholder="e.g., Sour Best Sellers"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm text-gray-900"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Flavors for this Variation
                            </label>
                            {variation.flavors.map((flavor, flavorIndex) => (
                              <div
                                key={flavorIndex}
                                className="flex gap-2 mb-2"
                              >
                                <select
                                  value={flavor.id || ""}
                                  onChange={(e) => {
                                    const selectedFlavor =
                                      availableFlavors.find(
                                        (f) => f.id === e.target.value
                                      );
                                    const newVariations = [...variations];
                                    newVariations[index].flavors[flavorIndex] =
                                      {
                                        id: e.target.value,
                                        name: selectedFlavor?.name || "",
                                        quantity: flavor.quantity,
                                      };
                                    setVariations(newVariations);
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm text-gray-900"
                                >
                                  <option value="">Select flavor</option>
                                  {availableFlavors.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  value={flavor.quantity || 1}
                                  onChange={(e) => {
                                    const newVariations = [...variations];
                                    newVariations[index].flavors[
                                      flavorIndex
                                    ].quantity = parseInt(e.target.value) || 1;
                                    setVariations(newVariations);
                                  }}
                                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm text-gray-900"
                                  placeholder="Qty"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newVariations = [...variations];
                                    newVariations[index].flavors =
                                      newVariations[index].flavors.filter(
                                        (_, i) => i !== flavorIndex
                                      );
                                    setVariations(newVariations);
                                  }}
                                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newVariations = [...variations];
                                newVariations[index].flavors.push({
                                  id: "",
                                  name: "",
                                  quantity: 1,
                                });
                                setVariations(newVariations);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              + Add Flavor
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Variation Image
                            </label>
                            {variation.imagePreview && (
                              <div className="relative mb-2">
                                <img
                                  src={variation.imagePreview}
                                  alt="Variation preview"
                                  className="w-32 h-32 object-cover rounded-lg border-2 border-[#FF5D39]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newVariations = [...variations];
                                    if (
                                      newVariations[
                                        index
                                      ].imagePreview?.startsWith("blob:")
                                    ) {
                                      URL.revokeObjectURL(
                                        newVariations[index].imagePreview!
                                      );
                                    }
                                    newVariations[index].imagePreview = null;
                                    newVariations[index].imageFile = null;
                                    setVariations(newVariations);
                                  }}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const newVariations = [...variations];
                                  newVariations[index].imageFile = file;
                                  const preview = URL.createObjectURL(file);
                                  newVariations[index].imagePreview = preview;
                                  setVariations(newVariations);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setVariations([
                      ...variations,
                      {
                        name: "",
                        flavors: [],
                        imageFile: null,
                        imagePreview: null,
                      },
                    ]);
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  + Add Variation
                </button>
              </div>

              {/* Image Upload Section - Improved Design */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Product Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#FF5D39] transition-colors">
                  <div className="flex flex-col items-center space-y-3">
                    {/* Image Preview */}
                    {preview && (
                      <div className="relative">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-lg border-2 border-[#FF5D39] shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (preview?.startsWith("blob:"))
                              URL.revokeObjectURL(preview);
                            setPreview(null);
                            setImageFile(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div className="w-full">
                      <label htmlFor="product-image-input" className="block">
                        <div className="cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg p-4 text-center transition-colors">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-semibold text-[#FF5D39]">
                              Click to upload
                            </span>{" "}
                            or drag and drop
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG, GIF up to 500MB
                          </p>
                        </div>
                      </label>
                      <input
                        id="product-image-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            const maxSizeMB = 500;
                            const fileSizeMB = file.size / (1024 * 1024);

                            if (fileSizeMB > maxSizeMB) {
                              setError(
                                `📁 File too large! Your image is ${fileSizeMB.toFixed(
                                  1
                                )}MB, but the maximum allowed size is ${maxSizeMB}MB.`
                              );
                              e.target.value = "";
                              return;
                            }

                            try {
                              let processedFile = file;
                              if (file.size > 2 * 1024 * 1024) {
                                setError("🔄 Compressing your image...");
                                try {
                                  processedFile = await compressImage(file);
                                  setError(null);
                                } catch (compressionError) {
                                  console.error(
                                    "Compression failed:",
                                    compressionError
                                  );
                                  setError(
                                    `⚠️ Auto-compression failed! Please choose a smaller image.`
                                  );
                                  e.target.value = "";
                                  return;
                                }
                              }

                              setImageFile(processedFile);
                              const blobUrl =
                                URL.createObjectURL(processedFile);
                              setPreview(blobUrl);
                              setForm((f) => ({ ...f, imageUrl: "" }));
                              setError(null);
                            } catch (generalError) {
                              console.error(
                                "Image processing error:",
                                generalError
                              );
                              setError("❌ Failed to process your image.");
                              e.target.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrition Facts Upload Section - Multiple Files */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Nutrition Facts (Optional) - Multiple Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#FF5D39] transition-colors">
                  {/* Existing Nutrition Facts */}
                  {existingNutritionFacts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Existing Nutrition Facts:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {existingNutritionFacts.map((nf) => (
                          <div
                            key={nf.id}
                            className="relative border border-gray-200 rounded-lg p-2 bg-gray-50"
                          >
                            {nf.fileType === "pdf" ? (
                              <div className="flex flex-col items-center justify-center min-h-[100px]">
                                <svg
                                  className="w-12 h-12 text-red-500 mb-2"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                                <p className="text-xs text-gray-700 text-center truncate w-full">
                                  {nf.fileName || "PDF"}
                                </p>
                              </div>
                            ) : (
                              <div className="relative">
                                <img
                                  src={normalizeImageSrc(nf.fileUrl)}
                                  alt={nf.fileName || "Nutrition Facts"}
                                  className="w-full h-auto object-contain rounded"
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiClient.delete(
                                    `/products/admin/nutrition-facts/${nf.id}`
                                  );
                                  setExistingNutritionFacts((prev) =>
                                    prev.filter((item) => item.id !== nf.id)
                                  );
                                  toast.success("Nutrition fact deleted");
                                } catch (error) {
                                  toast.error(
                                    "Failed to delete nutrition fact"
                                  );
                                }
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-sm"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New Nutrition Facts Previews */}
                  {nutritionFactsFiles.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        New Files to Upload:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {nutritionFactsFiles.map((nf) => (
                          <div
                            key={nf.id}
                            className="relative border-2 border-[#FF5D39] rounded-lg p-2 bg-white"
                          >
                            {nf.file.type === "application/pdf" ? (
                              <div className="flex flex-col items-center justify-center min-h-[100px]">
                                <svg
                                  className="w-12 h-12 text-red-500 mb-2"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                                <p className="text-xs text-gray-700 text-center truncate w-full">
                                  {nf.file.name}
                                </p>
                              </div>
                            ) : (
                              <div className="relative">
                                <img
                                  src={nf.preview}
                                  alt="Nutrition Facts Preview"
                                  className="w-full h-auto object-contain rounded"
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (nf.preview?.startsWith("blob:")) {
                                  URL.revokeObjectURL(nf.preview);
                                }
                                setNutritionFactsFiles((prev) =>
                                  prev.filter((item) => item.id !== nf.id)
                                );
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-sm"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="w-full">
                    <label htmlFor="nutrition-facts-input" className="block">
                      <div className="cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg p-4 text-center transition-colors">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="font-semibold text-[#FF5D39]">
                            Click to upload
                          </span>{" "}
                          nutrition facts (images or PDFs)
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, PDF up to 500MB each (Max 13 files)
                        </p>
                      </div>
                    </label>
                    <input
                      id="nutrition-facts-input"
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;

                        const maxSizeMB = 500;
                        const maxFiles = 13;
                        const currentCount =
                          nutritionFactsFiles.length +
                          existingNutritionFacts.length;

                        if (currentCount + files.length > maxFiles) {
                          setError(
                            `Maximum ${maxFiles} nutrition fact files allowed. You already have ${currentCount} file(s).`
                          );
                          e.target.value = "";
                          return;
                        }

                        const validFiles: Array<{
                          file: File;
                          preview: string;
                          id: string;
                        }> = [];

                        files.forEach((file) => {
                          const fileSizeMB = file.size / (1024 * 1024);
                          if (fileSizeMB > maxSizeMB) {
                            setError(
                              `File "${
                                file.name
                              }" is too large (${fileSizeMB.toFixed(
                                1
                              )}MB). Maximum size is ${maxSizeMB}MB.`
                            );
                            return;
                          }

                          const id = `nf-${Date.now()}-${Math.random()}`;
                          let preview = "";
                          if (file.type === "application/pdf") {
                            preview = "pdf";
                          } else {
                            preview = URL.createObjectURL(file);
                          }
                          validFiles.push({ file, preview, id });
                        });

                        if (validFiles.length > 0) {
                          setNutritionFactsFiles((prev) => [
                            ...prev,
                            ...validFiles,
                          ]);
                          setError(null);
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={createProduct}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#FF5D39] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 text-sm sm:text-base"
                >
                  {saving ? "Creating..." : "Create Product"}
                </button>
              </div>
            </div>
          </div>

          {/* Existing Products Table */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">
              Existing Products
            </h2>

            {products.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-sm sm:text-base">
                  No products found
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block md:hidden space-y-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex gap-3 mb-3">
                        {product.imageUrl ? (
                          <img
                            src={normalizeImageSrc(product.imageUrl)}
                            alt={product.name}
                            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 text-xs">
                              No image
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                            {product.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-2">
                            {product.category}
                          </span>
                          {product.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-200">
                        <div>
                          <span className="text-xs text-gray-600 block mb-1">
                            Price
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            ${product.price}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-600 block mb-1">
                            Stock
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {product.stock}
                          </span>
                        </div>
                      </div>

                      {/* Variations for mobile view */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <span className="text-xs text-gray-600 block mb-1">
                          Variations
                        </span>
                        {(() => {
                          // Check if this is a pack product (by isPackProduct flag OR packSize)
                          const isPackProduct = product.isPackProduct === true || 
                            product.packSize === 7 || 
                            product.packSize === 12 ||
                            (product.name && (
                              product.name.toLowerCase().includes("12 pack") || 
                              product.name.toLowerCase().includes("7 pack")
                            ));
                          
                          if (isPackProduct) {
                            const isLoading = loadingPackVariants[product.id];
                            const variants = packProductVariants[product.id];
                            
                            if (isLoading) {
                              return <span className="text-xs text-gray-400">Loading...</span>;
                            }
                            
                            if (variants && variants.length > 0) {
                              return (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {variants.length} available
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {variants
                                      .slice(0, 2)
                                      .map((v) => v.variationName)
                                      .join(", ")}
                                    {variants.length > 2 &&
                                      ` +${variants.length - 2} more`}
                                  </div>
                                  <button
                                    onClick={() =>
                                      setViewPackVariantsModal({
                                        isOpen: true,
                                        productId: product.id,
                                        productName: product.name,
                                      })
                                    }
                                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                                  >
                                    View all variants
                                  </button>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-400">
                                  No variants available
                                </span>
                                <button
                                  onClick={() => {
                                    console.log("[Mobile] Refetching variants for:", product.name);
                                    // Ensure packType is set before fetching
                                    const packProduct = {
                                      ...product,
                                      packType: product.packType || 
                                        (product.packSize === 12 || product.name?.toLowerCase().includes("platinum") ? "platinum" : "gold"),
                                      isPackProduct: true,
                                    };
                                    fetchPackProductVariants(packProduct);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  Refresh variants
                                </button>
                              </div>
                            );
                          }
                          
                          // Regular products with stored variations
                          if (product.variations && product.variations.length > 0) {
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {product.variations.length} variation
                                {product.variations.length !== 1 ? "s" : ""}
                              </span>
                            );
                          }
                          
                          return <span className="text-xs text-gray-400">No variations</span>;
                        })()}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProductClick(product)}
                          className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product)}
                          disabled={deleting[product.id]}
                          className="flex-1 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {deleting[product.id] ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Image
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Variations
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {product.imageUrl ? (
                              <img
                                src={normalizeImageSrc(product.imageUrl)}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-400 text-xs">
                                  No image
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.description}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              ${product.price}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">
                              {product.stock}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              // Check if this is a pack product (by isPackProduct flag OR packSize)
                              const isPackProduct = product.isPackProduct === true || 
                                product.packSize === 7 || 
                                product.packSize === 12 ||
                                (product.name && (
                                  product.name.toLowerCase().includes("12 pack") || 
                                  product.name.toLowerCase().includes("7 pack")
                                ));
                              
                              if (isPackProduct) {
                                // For pack products, show dynamically loaded variants
                                const isLoading = loadingPackVariants[product.id];
                                const variants = packProductVariants[product.id];
                                console.log(`[Render] Pack product ${product.name}:`, {
                                  isLoading,
                                  hasVariants: !!variants,
                                  variantCount: variants?.length || 0,
                                  productId: product.id,
                                });
                                
                                if (isLoading) {
                                  return (
                                    <span className="text-xs text-gray-400">
                                      Loading...
                                    </span>
                                  );
                                }
                                
                                if (variants && variants.length > 0) {
                                  return (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {variants.length} available variant
                                        {variants.length !== 1 ? "s" : ""}
                                      </span>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {variants
                                          .slice(0, 3)
                                          .map((v) => v.variationName)
                                          .join(", ")}
                                        {variants.length > 3 &&
                                          ` +${variants.length - 3} more`}
                                      </div>
                                      <button
                                        onClick={() =>
                                          setViewPackVariantsModal({
                                            isOpen: true,
                                            productId: product.id,
                                            productName: product.name,
                                          })
                                        }
                                        className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                                      >
                                        View all variants
                                      </button>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="space-y-1">
                                    <span className="text-xs text-gray-400">
                                      No variants available
                                    </span>
                                    <button
                                      onClick={() => {
                                        console.log("[Manual] Refetching variants for:", product.name);
                                        // Ensure packType is set before fetching
                                        const packProduct = {
                                          ...product,
                                          packType: product.packType || 
                                            (product.packSize === 12 || product.name?.toLowerCase().includes("platinum") ? "platinum" : "gold"),
                                          isPackProduct: true,
                                        };
                                        fetchPackProductVariants(packProduct);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                    >
                                      Refresh variants
                                    </button>
                                  </div>
                                );
                              }
                              
                              // Regular products with stored variations
                              if (product.variations && product.variations.length > 0) {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {product.variations.length} variation
                                    {product.variations.length !== 1 ? "s" : ""}
                                  </span>
                                );
                              }
                              
                              return (
                                <span className="text-xs text-gray-400">
                                  No variations
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditProductClick(product)}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(product)}
                                disabled={deleting[product.id]}
                                className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {deleting[product.id]
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Flavors Tab */}
      {activeTab === "flavors" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Create New Flavor */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">
              Create New Flavor
            </h2>

            {/* Error Message Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* File Upload Info */}
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600">
                Maximum file size: 500MB • Images larger than 2MB will be
                automatically compressed
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-3 sm:space-y-4">
              {/* Flavor Image Upload Section - Improved Design */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Flavor Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#FF5D39] transition-colors">
                  <div className="flex flex-col items-center space-y-3">
                    {/* Image Preview */}
                    {flavorImagePreview && (
                      <div className="relative">
                        <img
                          src={flavorImagePreview}
                          alt="Flavor Preview"
                          className="w-40 h-40 object-cover rounded-lg border-2 border-[#FF5D39] shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (flavorImagePreview?.startsWith("blob:"))
                              URL.revokeObjectURL(flavorImagePreview);
                            setFlavorImagePreview(null);
                            setFlavorImageFile(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div className="w-full">
                      <label htmlFor="flavor-image-input" className="block">
                        <div className="cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg p-4 text-center transition-colors">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-semibold text-[#FF5D39]">
                              Click to upload
                            </span>{" "}
                            or drag and drop
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG, GIF up to 500MB
                          </p>
                        </div>
                      </label>
                      <input
                        id="flavor-image-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            const maxSizeMB = 500;
                            const fileSizeMB = file.size / (1024 * 1024);

                            if (fileSizeMB > maxSizeMB) {
                              setError(
                                `📁 File too large! Your image is ${fileSizeMB.toFixed(
                                  1
                                )}MB, but the maximum allowed size is ${maxSizeMB}MB.`
                              );
                              e.target.value = "";
                              return;
                            }

                            try {
                              let processedFile = file;
                              if (file.size > 2 * 1024 * 1024) {
                                setError("🔄 Compressing your image...");
                                try {
                                  processedFile = await compressImage(file);
                                  setError(null);
                                } catch (compressionError) {
                                  console.error(
                                    "Compression failed:",
                                    compressionError
                                  );
                                  setError(
                                    `⚠️ Auto-compression failed! Please choose a smaller image.`
                                  );
                                  e.target.value = "";
                                  return;
                                }
                              }

                              setFlavorImageFile(processedFile);
                              const blobUrl =
                                URL.createObjectURL(processedFile);
                              setFlavorImagePreview(blobUrl);
                              setError(null);
                            } catch (generalError) {
                              console.error(
                                "Image processing error:",
                                generalError
                              );
                              setError("❌ Failed to process your image.");
                              e.target.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Flavor Name
                  </label>
                  <input
                    type="text"
                    value={newFlavor.name}
                    onChange={(e) =>
                      setNewFlavor({ ...newFlavor, name: e.target.value })
                    }
                    placeholder="Enter flavor name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Aliases (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newFlavor.aliases}
                    onChange={(e) =>
                      setNewFlavor({ ...newFlavor, aliases: e.target.value })
                    }
                    placeholder="e.g., Berry, Blue"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={newFlavor.active}
                  onChange={(e) =>
                    setNewFlavor({ ...newFlavor, active: e.target.checked })
                  }
                  className="w-4 h-4 text-[#FF5D39] border-gray-300 rounded focus:ring-[#FF5D39]"
                />
                <label
                  htmlFor="active"
                  className="text-xs sm:text-sm text-gray-700"
                >
                  Active
                </label>
              </div>

              <button
                onClick={createFlavor}
                disabled={creatingFlavor}
                className="w-full sm:w-auto px-4 py-2 bg-[#FF5D39] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 text-sm sm:text-base"
              >
                {creatingFlavor ? "Creating..." : "Create Flavor"}
              </button>
            </div>
          </div>

          {/* Existing Flavors List */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">
              Existing Flavors
            </h2>

            {flavors.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🍭</div>
                <h3 className="text-lg font-semibold mb-2 text-black">
                  No flavors yet
                </h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Create your first flavor to get started.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block md:hidden space-y-4">
                  {flavors.map((flavor) => (
                    <div
                      key={flavor.id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex gap-3 mb-3">
                        {flavor.imageUrl && (
                          <img
                            src={normalizeImageSrc(
                              flavor.imageUrl,
                              flavor.updatedAt
                            )}
                            alt={flavor.name}
                            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">
                            {flavor.name}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${
                              flavor.active
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {flavor.active ? "Active" : "Inactive"}
                          </span>
                          <p className="text-xs text-gray-500">
                            {flavor.aliases.length > 0
                              ? flavor.aliases.join(", ")
                              : "No aliases"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditFlavorClick(flavor)}
                          className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFlavorClick(flavor)}
                          disabled={deletingFlavor[flavor.id]}
                          className="flex-1 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingFlavor[flavor.id] ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop List View */}
                <div className="hidden md:block space-y-3">
                  {flavors.map((flavor) => (
                    <div
                      key={flavor.id}
                      className="flex items-center justify-between gap-3 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {flavor.imageUrl && (
                          <img
                            src={normalizeImageSrc(
                              flavor.imageUrl,
                              flavor.updatedAt
                            )}
                            alt={flavor.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-black text-base">
                            {flavor.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {flavor.aliases.length > 0
                              ? flavor.aliases.join(", ")
                              : "No aliases"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            flavor.active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {flavor.active ? "Active" : "Inactive"}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditFlavorClick(flavor)}
                            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:opacity-90 transition-opacity"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteFlavorClick(flavor)}
                            disabled={deletingFlavor[flavor.id]}
                            className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingFlavor[flavor.id]
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Create New Category */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">
              Category Management
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm mb-4">
              Add and manage product categories. Categories help organize your
              products.
            </p>

            {/* Add New Category Form */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 sm:p-6 rounded-lg mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">
                Add New Category
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter category name (e.g., Sweet, Sour, Mixed)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !creatingCategory) {
                      createCategory();
                    }
                  }}
                />
                <button
                  onClick={createCategory}
                  disabled={creatingCategory}
                  className="w-full sm:w-auto px-6 py-2 bg-[#FF5D39] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 text-sm sm:text-base font-medium"
                >
                  {creatingCategory ? "Adding..." : "Add Category"}
                </button>
              </div>
            </div>

            {/* Existing Categories Grid */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3">
                Existing Categories
              </h3>

              {productCategories.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="text-4xl mb-4">🏷️</div>
                  <h4 className="text-base font-semibold mb-2 text-black">
                    No categories yet
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Add your first category above to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {categoryObjects.map((category) => (
                    <div
                      key={category.id || category.name}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-[#FF5D39] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#FF5D39] to-[#FF8A39] rounded-lg flex items-center justify-center">
                          <span className="text-white text-xl font-bold">
                            {category.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {category.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {category.productCount} product
                            {category.productCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {category.id && (
                          <button
                            onClick={() =>
                              deleteCategory(category.id, category.name)
                            }
                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete category"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === "inventory" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Inventory Management Overview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl shadow-lg border border-blue-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
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
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-black">
                    Inventory Management
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Monitor and manage stock levels
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-1 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {inventoryAlerts.length} Active Alert
                  {inventoryAlerts.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {inventoryAlerts.length > 0 && (
            <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-red-200 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <h3 className="text-lg sm:text-xl font-bold text-black">
                  Low Stock Alerts
                </h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {inventoryAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="border border-red-200 rounded-lg p-3 sm:p-4 bg-red-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-red-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <h4 className="font-semibold text-black text-sm sm:text-base">
                          {alert.flavorName}
                        </h4>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-600">
                        Also known as:{" "}
                        {alert.flavor?.aliases?.join(", ") || "No aliases"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                      <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          On Hand
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {alert.onHand}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          Reserved
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {alert.reserved}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          Safety Stock
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {alert.safetyStock}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          Available
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-blue-600">
                          {alert.onHand - alert.reserved}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <input
                        type="number"
                        min="0"
                        placeholder="Update stock"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900 bg-white placeholder:text-gray-400"
                        onChange={() => {
                          // Update local state for immediate UI feedback
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.querySelector(
                            `input[placeholder="Update stock"]`
                          ) as HTMLInputElement;
                          const newStock = parseInt(input?.value) || 0;
                          if (newStock >= 0) {
                            updateInventory(alert.flavorId, newStock);
                            input.value = "";
                          }
                        }}
                        disabled={updatingInventory[alert.flavorId]}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 text-sm sm:text-base flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16l-4-4m0 0l4-4m-4 4h18"
                          />
                        </svg>
                        {updatingInventory[alert.flavorId]
                          ? "Updating..."
                          : "Update Stock"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-xs sm:text-sm text-gray-600">
                        Stock tracking enabled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Flavors Inventory */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-black">
                  All Flavors Inventory
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Manage stock levels for all flavors
                </p>
              </div>
            </div>

            {flavors.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-semibold mb-2 text-black">
                  No flavors found
                </h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Create flavors first to manage inventory.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {flavors.map((flavor) => (
                  <div
                    key={flavor.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-black text-sm sm:text-base">
                          {flavor.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Also known as:{" "}
                          {flavor.aliases.length > 0
                            ? flavor.aliases.join(", ")
                            : "No aliases"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm text-gray-600">
                          On
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded"></div>
                          <div className="text-xs sm:text-sm text-gray-600">
                            On Hand
                          </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {flavor.inventory?.onHand || 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <div className="text-xs sm:text-sm text-gray-600">
                            Reserved
                          </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {flavor.inventory?.reserved || 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <svg
                            className="w-3 h-3 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                          <div className="text-xs sm:text-sm text-gray-600">
                            Safety Stock
                          </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {flavor.inventory?.safetyStock || 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">
                          Available
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-blue-600">
                          {(flavor.inventory?.onHand || 0) -
                            (flavor.inventory?.reserved || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <input
                        type="number"
                        min="0"
                        placeholder="Update stock"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5D39] text-sm sm:text-base text-gray-900 bg-white placeholder:text-gray-400"
                        onChange={() => {
                          // Update local state for immediate UI feedback
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.querySelector(
                            `input[placeholder="Update stock"]`
                          ) as HTMLInputElement;
                          const newStock = parseInt(input?.value) || 0;
                          if (newStock >= 0) {
                            updateInventory(flavor.id, newStock);
                            input.value = "";
                          }
                        }}
                        disabled={updatingInventory[flavor.id]}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 text-sm sm:text-base flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16l-4-4m0 0l4-4m-4 4h18"
                          />
                        </svg>
                        {updatingInventory[flavor.id]
                          ? "Updating..."
                          : "Update Stock"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Configuration Tab */}
      {activeTab === "config" && (
        <div className="space-y-4 sm:space-y-6">
          {/* System Configuration Overview */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-black">
                  System Configuration
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Overview of system statistics and settings
                </p>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                  Total Categories
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">
                  {systemConfig?.totalCategories ||
                    productCategories.length ||
                    0}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                  Total Flavors
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">
                  {systemConfig?.totalFlavors || flavors.length || 0}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                  Total Products
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">
                  {systemConfig?.totalProducts || products.length || 0}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center border border-gray-200">
                <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                  Active Alerts
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600">
                  {inventoryAlerts.length}
                </div>
              </div>
            </div>

            {/* Default Prices Section */}
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">
                Default Prices
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {systemConfig?.defaultPrices ? (
                  Object.entries(systemConfig.defaultPrices).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-medium text-gray-700 capitalize">
                            {key.replace("-", " ")}:
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-red-600">
                            ${value}
                          </span>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-medium text-gray-700">
                          3-pack:
                        </span>
                        <span className="text-lg sm:text-xl font-bold text-red-600">
                          $27
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm sm:text-base font-medium text-gray-700">
                          5-pack:
                        </span>
                        <span className="text-lg sm:text-xl font-bold text-red-600">
                          $45
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* System Settings */}
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">
                System Settings
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm sm:text-base font-medium text-gray-700">
                        Default Price
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        Base price for new products
                      </div>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-gray-900">
                      ${systemConfig?.defaultPrice || 27}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm sm:text-base font-medium text-gray-700">
                        Min Stock Threshold
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        Minimum stock level for alerts
                      </div>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-gray-900">
                      {systemConfig?.minStockThreshold || 5}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm sm:text-base font-medium text-gray-700">
                        Max Flavors Per Product
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        Maximum flavors allowed per product
                      </div>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-gray-900">
                      {systemConfig?.maxFlavorsPerProduct || 5}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Supported Categories - View Only */}
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">
                Supported Categories
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                To add or manage categories, go to the Categories tab 🏷️
              </p>

              {/* Existing Categories */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {productCategories.length > 0 ? (
                  productCategories.map((category) => (
                    <span
                      key={category}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium"
                    >
                      {category}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    No categories yet. Add your first category above.
                  </p>
                )}
              </div>
            </div>

            {/* System Information */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">
                System Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                <div>
                  <span className="font-medium">Last Updated:</span>{" "}
                  {new Date().toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Version:</span> 1.0.0
                </div>
                <div>
                  <span className="font-medium">Environment:</span> Production
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className="ml-1 text-green-600 font-medium">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      <SimpleModal
        isOpen={deleteModal.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteModal.productName}"? This action cannot be undone.`}
        isLoading={deletingFromModal}
      />

      {/* Delete Flavor Confirmation Modal */}
      <SimpleModal
        isOpen={deleteFlavorModal.isOpen}
        onClose={handleCancelDeleteFlavor}
        onConfirm={handleConfirmDeleteFlavor}
        title="Delete Flavor"
        message={`Are you sure you want to delete "${deleteFlavorModal.flavorName}"? This action cannot be undone and will affect any products using this flavor.`}
        isLoading={deletingFromModal}
      />

      {/* View Pack Variants Modal */}
      {viewPackVariantsModal.isOpen && viewPackVariantsModal.productId && (
        <div
          className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 p-4"
          onClick={() =>
            setViewPackVariantsModal({
              isOpen: false,
              productId: null,
              productName: "",
            })
          }
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Available Variants for {viewPackVariantsModal.productName}
                </h2>
                <button
                  onClick={() =>
                    setViewPackVariantsModal({
                      isOpen: false,
                      productId: null,
                      productName: "",
                    })
                  }
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {loadingPackVariants[viewPackVariantsModal.productId] ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5D39] mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading variants...</p>
                </div>
              ) : packProductVariants[viewPackVariantsModal.productId] &&
                packProductVariants[viewPackVariantsModal.productId].length >
                  0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packProductVariants[
                    viewPackVariantsModal.productId
                  ].map((variant) => {
                    // Find the source product to edit
                    const sourceProduct = products.find(p => p.id === variant.productId);
                    
                    return (
                      <div
                        key={`${variant.productId}-${variant.variationId}`}
                        className="border border-gray-200 rounded-lg p-4 hover:border-[#FF5D39] transition-colors flex flex-col"
                      >
                        {variant.imageUrl && (
                          <div className="relative w-full h-32 mb-2 rounded overflow-hidden bg-gray-100">
                            <img
                              src={normalizeImageSrc(variant.imageUrl)}
                              alt={variant.variationName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {variant.productName}
                        </div>
                        <div className="text-sm font-medium text-gray-800 mb-1">
                          {variant.variationName}
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          {variant.packSize}-Pack • {variant.category}
                        </div>
                        {sourceProduct && (
                          <button
                            onClick={async () => {
                              // Close the variants modal first
                              setViewPackVariantsModal({
                                isOpen: false,
                                productId: null,
                                productName: "",
                              });
                              // Then open the edit modal for the source product
                              await handleEditProductClick(sourceProduct);
                            }}
                            className="mt-auto px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium w-full"
                          >
                            Edit Variant
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No variants available for this pack product.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductModal.product && (
        <EditProductModal
          isOpen={editProductModal.isOpen}
          onClose={handleCloseEditProduct}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSave={handleSaveProduct as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          product={editProductModal.product as any}
          productCategories={productCategories}
          availableFlavors={availableFlavors}
          isLoading={saving}
        />
      )}

      {/* Edit Flavor Modal */}
      {(() => {
        // Type assertion to handle incompatible Flavor types (database vs modal)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modalFlavor = editFlavorModal.flavor as any;
        return (
          <EditFlavorModal
            isOpen={editFlavorModal.isOpen}
            onClose={handleCloseEditFlavor}
            onSave={handleSaveFlavor}
            flavor={modalFlavor}
            isLoading={saving}
          />
        );
      })()}
    </div>
  );
};

const AdminPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5D39] mx-auto mb-4"></div>
            <p className="text-black text-lg">Loading admin panel...</p>
          </div>
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
};

export default AdminPage;
