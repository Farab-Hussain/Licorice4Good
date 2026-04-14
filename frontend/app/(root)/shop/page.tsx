"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import CustomButton from "@/components/custom/CustomButton";
import { useRouter } from "next/navigation";
// TODO: Uncomment when Build Your Own Pack feature is needed
// import CustomPackBuilder from "@/components/ui/shop/CustomPackBuilder";
import { useUser } from "@/hooks/useUser";
import { useCartStore } from "@/store/cartStore";

const ORANGE = "#FF5D39";
const BLACK = "#111111";

// Product data structure matching the backend API
type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  stock?: number;
  flavors?: Array<{ name: string; quantity: number }>;
  sku?: string;
  updatedAt?: string;
  supportLevel?: string | null;
  packSize?: number | null;
  isPackProduct?: boolean;
  packType?: string | null;
};

type PackVariant = {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  productId: string;
  productName: string;
  productPrice: number;
  productImageUrl?: string | null;
  packSize: number; // 3 or 4
  images: Array<{
    id: string;
    imageUrl: string;
    isDefault: boolean;
  }>;
  flavors: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
};

const ShopPage = () => {
  const router = useRouter();
  const { loading: userLoading } = useUser();
  const { addPreDefinedPack } = useCartStore();
  const [packages, setPackages] = useState<Product[]>([]);
  const [packProducts, setPackProducts] = useState<Product[]>([]);
  const [packVariants, setPackVariants] = useState<Array<PackVariant>>([]);
  const [loading, setLoading] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TODO: Uncomment when Build Your Own Pack feature is needed
  // const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "12" | "7" | "4" | "3">(
    "all"
  );
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
        console.error("NEXT_PUBLIC_API_URL is not defined");
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
      console.error("NEXT_PUBLIC_API_URL is not defined");
      return `${src}${cacheBuster}`;
    }

    // Ensure src starts with / for proper path construction
    const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
    return `${apiUrl}${normalizedSrc}${cacheBuster}`;
  };

  // No authentication check - shop page is accessible to everyone
  // Authentication will be required only for adding items to cart

  // Fetch products from backend API (accessible to everyone)
  useEffect(() => {
    // Fetch products regardless of authentication status

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const API_URL = process.env.NEXT_PUBLIC_API_URL;

        const response = await fetch(`${API_URL}/products?limit=1000`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Ensure data is an array
        let allProducts: Product[] = [];
        if (Array.isArray(data)) {
          allProducts = data;
        } else if (data && Array.isArray(data.products)) {
          allProducts = data.products;
        } else if (data && Array.isArray(data.data)) {
          allProducts = data.data;
        } else {
          console.error("Unexpected API response format:", data);
          // Use fallback data instead of throwing error
          throw new Error("Invalid API response format");
        }

        // Separate pack products from regular products
        const regularProducts = allProducts.filter((p) => !p.isPackProduct);
        const packProductsList = allProducts.filter(
          (p) => p.isPackProduct === true
        );

        console.log("Total products:", allProducts.length);
        console.log("Regular products:", regularProducts.length);
        console.log("Pack products:", packProductsList.length);
        console.log("Pack products data:", packProductsList);

        setPackages(regularProducts);
        setPackProducts(packProductsList);

        // Fetch 3-pack and 4-pack product variations
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL;
          const packProducts = regularProducts.filter(
            (p) => p.packSize === 3 || p.packSize === 4
          );

          // Fetch variations for each pack product (3-pack and 4-pack)
          const packVariantsPromises = packProducts.map(async (product) => {
            try {
              const productResponse = await fetch(
                `${API_URL}/products/${product.id}`,
                {
                  method: "GET",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              if (productResponse.ok) {
                const productData = await productResponse.json();
                if (productData && productData.variations) {
                  // Transform variations to include product info
                  type ProductVariation = {
                    id: string;
                    name: string;
                    isActive?: boolean;
                    images: Array<{
                      id: string;
                      imageUrl: string;
                      isDefault: boolean;
                    }>;
                    flavors: Array<{
                      id: string;
                      name: string;
                      quantity: number;
                    }>;
                  };
                  return productData.variations
                    .filter((v: ProductVariation) => v.isActive)
                    .map((v: ProductVariation) => ({
                      ...v,
                      productId: product.id,
                      productName: product.name,
                      productPrice: product.price,
                      productImageUrl: product.imageUrl,
                      packSize: product.packSize || 3, // Default to 3 if not set
                    }));
                }
              }
              return [];
            } catch (err) {
              console.warn(
                `Failed to fetch variations for product ${product.id}:`,
                err
              );
              return [];
            }
          });

          const allPackVariants = await Promise.all(packVariantsPromises);
          const flattenedVariants = allPackVariants.flat();
          setPackVariants(flattenedVariants);
        } catch (packErr) {
          console.warn("Failed to fetch pack variants:", packErr);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setError("Request timed out. Please try again.");
          } else {
            setError("Failed to load products. Please try again later.");
          }
        } else {
          setError("Failed to load products. Please try again later.");
        }

        setPackages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []); // No dependencies - fetch once on component mount

  // Helper function to get pack size from a product
  const getProductPackSize = (
    product: Product | PackVariant
  ): number | null => {
    // For pack products (12-pack and 7-pack)
    if (
      "isPackProduct" in product &&
      product.isPackProduct &&
      product.packSize
    ) {
      return product.packSize;
    }
    // For regular products
    if ("packSize" in product && product.packSize) {
      return product.packSize;
    }
    // For pack variants (3-pack and 4-pack)
    if ("productId" in product && "packSize" in product) {
      return product.packSize;
    }
    return null;
  };

  // Combine all products into a unified list with pack size info
  const getAllProducts = () => {
    const allProducts: Array<{
      type: "pack" | "regular" | "packVariant";
      product: Product | PackVariant;
      packSize: number | null;
    }> = [];

    // Add pack products (12-pack and 7-pack)
    packProducts.forEach((p) => {
      allProducts.push({
        type: "pack",
        product: p,
        packSize: getProductPackSize(p),
      });
    });

    // Add regular products (excluding 3-pack and 4-pack, as we'll use variations instead)
    packages
      .filter((p) => p.packSize !== 3 && p.packSize !== 4)
      .forEach((p) => {
        allProducts.push({
          type: "regular",
          product: p,
          packSize: getProductPackSize(p),
        });
      });

    // Add pack variants (3-pack and 4-pack)
    packVariants.forEach((v) => {
      allProducts.push({
        type: "packVariant",
        product: v,
        packSize: v.packSize,
      });
    });

    return allProducts;
  };

  // Sort products by pack size: 3 → 4 → 7 → 12 (ascending)
  const sortProductsByPackSize = (
    products: Array<{
      type: "pack" | "regular" | "packVariant";
      product: Product | PackVariant;
      packSize: number | null;
    }>
  ) => {
    const packSizeOrder = [3, 4, 7, 12];

    return [...products].sort((a, b) => {
      const aSize = a.packSize || 999; // Products without pack size go to the end
      const bSize = b.packSize || 999;

      const aIndex = packSizeOrder.indexOf(aSize);
      const bIndex = packSizeOrder.indexOf(bSize);

      // If both are in the order, sort by the order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one is in the order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither is in the order, maintain original order
      return 0;
    });
  };

  // Filter products based on active tab
  const filterProductsByTab = (
    products: Array<{
      type: "pack" | "regular" | "packVariant";
      product: Product | PackVariant;
      packSize: number | null;
    }>
  ) => {
    if (activeTab === "all") {
      return products;
    }

    const targetPackSize = parseInt(activeTab);
    return products.filter((item) => item.packSize === targetPackSize);
  };

  // Get sorted and filtered products
  const getDisplayProducts = () => {
    const allProducts = getAllProducts();
    const sorted = sortProductsByPackSize(allProducts);
    const filtered = filterProductsByTab(sorted);
    return filtered;
  };

  // Get filtered and sorted arrays for rendering
  const getFilteredPackProducts = () => {
    const allProducts = getAllProducts();
    const sorted = sortProductsByPackSize(allProducts);
    const filtered = filterProductsByTab(sorted);

    return filtered
      .filter((item) => item.type === "pack")
      .map((item) => item.product as Product);
  };

  const getFilteredRegularPackages = () => {
    const allProducts = getAllProducts();
    const sorted = sortProductsByPackSize(allProducts);
    const filtered = filterProductsByTab(sorted);

    return filtered
      .filter((item) => item.type === "regular")
      .map((item) => item.product as Product);
  };

  const viewPackage = (id: string) => router.push(`/products/${id}`);

  const addPreDefinedPackToCart = async (
    recipeId: string,
    buyNow: boolean = false
  ) => {
    try {
      await addPreDefinedPack(recipeId, 1);
      // Redirect to checkout for Buy Now, or cart for Add to Cart
      router.push(buyNow ? "/checkout" : "/cart");
    } catch (error) {
      console.error("Failed to add pre-defined pack to cart:", error);
    }
  };

  const buyNow = async (
    productId: string,
    productName: string,
    price: number,
    imageUrl: string,
    sku?: string,
    variationId?: string,
    variationName?: string
  ) => {
    try {
      const { addItem } = useCartStore.getState();
      await addItem({
        productId,
        productName,
        quantity: 1,
        price,
        imageUrl,
        sku,
        variationId,
        variationName,
      });
      // Redirect directly to checkout for faster purchase
      router.push("/checkout");
    } catch (error) {
      console.error("Failed to buy now:", error);
    }
  };

  // Show loading while fetching products
  if (loading) {
    return (
      <div className="w-full min-h-screen layout py-10 bg-shop-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {userLoading ? "Checking authentication..." : "Loading products..."}
          </p>
        </div>
      </div>
    );
  }

  // Shop page is accessible to everyone - no authentication required for browsing

  if (error && packages.length === 0) {
    return (
      <div className="w-full min-h-screen layout py-10 bg-shop-bg">
        <div className="w-full text-center">
          <h1 className="text-4xl font-extrabold mb-6">
            <span className="inline-block text-shop-gradient font-extrabold drop-shadow text-white">
              Shop Packages
            </span>
          </h1>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-bold">Error Loading Products</p>
            <p>{error}</p>
          </div>
          <button
            onClick={() => {
              setRetryLoading(true);
              window.location.reload();
            }}
            disabled={retryLoading}
            className="bg-white text-black font-bold px-8 py-3 rounded-lg shadow-lg hover:bg-gray-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {retryLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                Retrying...
              </div>
            ) : (
              "Try Again"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen layout py-10 bg-shop-bg"
      style={{
        color: BLACK,
      }}
    >
      <div className="flex items-center gap-3 mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
          <span className="inline-block text-shop-gradient font-extrabold drop-shadow text-white">
            Shop Packages
          </span>
        </h1>
      </div>

      <div className="mb-6 sm:mb-8">
        <p className="text-white text-base sm:text-lg mb-6">
          Choose from our carefully curated licorice rope packages. Each package
          contains 3 delicious flavors for the perfect tasting experience.
        </p>

        {/* Tabs for filtering by pack size */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          {[
            { id: "all", label: "All" },
            { id: "3", label: "3 Pack Bronze Supporter" },
            { id: "4", label: "4 Pack Silver Supporter" },
            { id: "7", label: "7 Pack Gold Supporter" },
            { id: "12", label: "12 Pack Platinum Supporter" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-white text-[#FF5D39] shadow-lg transform scale-105"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TODO: Uncomment when Build Your Own Pack feature is needed */}
      {/* Custom Pack Builder */}
      {/* {showCustomBuilder && (
        <div className="mb-8">
          <CustomPackBuilder />
        </div>
      )} */}

      {/* Package grid: 4 cards per row on large screens, tighter spacing */}
      {/* TODO: Uncomment when Build Your Own Pack feature is needed - restore conditional: {!showCustomBuilder && ( */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
        {/* Display all products in ascending order (3, 4, 7, 12) */}
        {getDisplayProducts().map((item) => {
          // Render Pack Products (12-pack and 7-pack)
          if (item.type === "pack") {
            const packProduct = item.product as Product;
            const isGold = packProduct.packType === "gold";
            const isPlatinum = packProduct.packType === "platinum";
            const badgeColor = isGold
              ? "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)"
              : "linear-gradient(135deg, #E5E4E2 0%, #C0C0C0 100%)";
            const badgeText = isGold ? "Gold" : "Platinum";
            const iconGradient = isGold
              ? "from-[#FFD700] to-[#FFA500]"
              : "from-[#E5E4E2] to-[#C0C0C0]";

            return (
              <Link
                key={packProduct.id}
                href={`/products/${packProduct.id}`}
                className="group rounded-2xl overflow-hidden bg-white border border-[#F1A900]/20 hover:border-[#F1A900] shadow-md hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 h-full flex flex-col cursor-pointer"
              >
                <div className="relative">
                  <div
                    className={`w-full aspect-[4/3] bg-gradient-to-br ${iconGradient}/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 rounded-t-2xl`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-lg`}
                    >
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>
                  <span
                    className="absolute top-3 sm:top-4 left-3 sm:left-4 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-1 rounded-full shadow"
                    style={{
                      background: badgeColor,
                      color: "white",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    {badgeText}
                  </span>
                  <span
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 text-sm sm:text-lg font-bold px-2.5 sm:px-3 py-1 rounded-full shadow"
                    style={{
                      background: ORANGE,
                      color: "white",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    ${packProduct.price.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 sm:p-6 flex flex-col flex-1 gap-3 sm:gap-4">
                  <div>
                    <h3
                      className="font-extrabold text-lg sm:text-xl mb-2"
                      style={{ color: BLACK }}
                    >
                      {packProduct.name}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3">
                      {packProduct.description ||
                        (isGold
                          ? "Have customers pick any one 3 pack from above and any one 4 pack from above"
                          : "One of each of our sweet and sour 3 packs, all the best sellers and all the classics")}
                    </p>

                    {/* Features */}
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs text-gray-700">
                        Features:
                      </h4>
                      <div className="space-y-1">
                        {isGold ? (
                          <>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></span>
                              Choose one 3-pack
                            </div>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FFA500]"></span>
                              Choose one 4-pack
                            </div>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></span>
                              {packProduct.packSize}-Pack Total
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E5E4E2]"></span>
                              All sweet 3-packs
                            </div>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C0C0C0]"></span>
                              All sour 3-packs
                            </div>
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E5E4E2]"></span>
                              {packProduct.packSize}-Pack Total
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 sm:pt-4 mt-auto">
                    <CustomButton
                      title="Start Building"
                      className="w-full !bg-gradient-to-r !from-[#F1A900] !to-[#FF6B35] !text-white font-bold py-2.5 sm:py-3 rounded-lg shadow-lg transition-all hover:opacity-90"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`/products/${packProduct.id}`);
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          }

          // Render pack variants (3-pack and 4-pack)
          if (item.type === "packVariant") {
            const variant = item.product as PackVariant;
            const defaultImage =
              variant.images.find(
                (img: { isDefault: boolean; imageUrl: string }) => img.isDefault
              )?.imageUrl ||
              variant.images[0]?.imageUrl ||
              variant.productImageUrl ||
              "/assets/images/slider.png";

            return (
              <div
                key={variant.id}
                className="group rounded-2xl overflow-hidden bg-white border-2 border-gray-100 hover:border-[#FF5D39] shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col"
              >
                {/* Product Image Section */}
                <div className="relative bg-gradient-to-br from-orange-50 to-red-50 overflow-hidden">
                  <Link
                    href={`/products/${variant.productId}?variation=${variant.id}`}
                    className="block p-4"
                  >
                    <Image
                      src={normalizeImageSrc(defaultImage)}
                      alt={variant.name}
                      width={640}
                      height={480}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full aspect-square object-contain transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                    />
                  </Link>

                  {/* Category Badge */}
                  <span
                    className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm"
                    style={{
                      background:
                        variant.name === "Traditional"
                          ? "linear-gradient(135deg, #8B4513 0%, #A0522D 100%)"
                          : variant.name.includes("Sour")
                          ? "linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)"
                          : variant.name.includes("Sweet")
                          ? "linear-gradient(135deg, #FF69B4 0%, #FF89C9 100%)"
                          : "linear-gradient(135deg, #F1A900 0%, #FFB800 100%)",
                      color: "white",
                    }}
                  >
                    {variant.name}
                  </span>

                  {/* Price Badge */}
                  <span
                    className="absolute top-3 right-3 text-base font-extrabold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, #FF5D39 0%, #FF8F6B 100%)",
                      color: "white",
                    }}
                  >
                    ${variant.productPrice.toFixed(2)}
                  </span>
                </div>

                {/* Product Details Section */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Title & Description */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-bold text-purple-600">
                        ⭐ {variant.packSize}-PACK
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1.5 text-gray-900 line-clamp-1">
                      {variant.name}
                    </h3>
                    <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
                      Pre-made {variant.packSize}-pack with carefully selected
                      flavors
                    </p>
                  </div>

                  {/* Flavors with Checkboxes - Compact */}
                  {Array.isArray(variant.flavors) &&
                    variant.flavors.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-xs text-gray-700 mb-1.5">
                          Contains:
                        </h4>
                        <div className="space-y-1">
                          {variant.flavors
                            .slice(0, 4)
                            .map(
                              (
                                flavor: { name: string; quantity: number },
                                index: number
                              ) => (
                                <label
                                  key={index}
                                  className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-2 py-1.5 rounded cursor-pointer hover:bg-orange-50 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="w-3.5 h-3.5 text-orange-600 bg-white border-gray-300 rounded focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                  />
                                  <span className="flex-1">{flavor.name}</span>
                                  {flavor.quantity > 1 && (
                                    <span className="text-xs font-bold text-orange-600">
                                      ×{flavor.quantity}
                                    </span>
                                  )}
                                </label>
                              )
                            )}
                          {variant.flavors.length > variant.packSize && (
                            <div className="text-xs text-gray-500 italic pl-2">
                              +{variant.flavors.length - variant.packSize} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Buttons - Compact */}
                  <div className="mt-auto space-y-1.5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() =>
                        buyNow(
                          variant.productId,
                          `${variant.productName} - ${variant.name}`,
                          variant.productPrice,
                          normalizeImageSrc(defaultImage),
                          variant.sku,
                          variant.id,
                          variant.name
                        )
                      }
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2.5 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                    >
                      Buy Now
                    </button>
                    <button
                      onClick={() =>
                        router.push(
                          `/products/${variant.productId}?variation=${variant.id}`
                        )
                      }
                      className="w-full text-white font-bold py-2.5 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                      style={{ background: "#FF5D39" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#FF6B35")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#FF5D39")
                      }
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Render regular packages (excluding 4-pack, as we use variations)
          if (item.type === "regular") {
            const pkg = item.product as Product;
            return (
              <div
                key={pkg.id}
                className="group rounded-2xl overflow-hidden bg-white border-2 border-gray-100 hover:border-[#FF5D39] shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col"
              >
                {/* Product Image Section */}
                <div className="relative bg-gradient-to-br from-orange-50 to-red-50 overflow-hidden">
                  <Link href={`/products/${pkg.id}`} className="block p-4">
                    <Image
                      src={normalizeImageSrc(pkg.imageUrl, pkg.updatedAt)}
                      alt={pkg.name}
                      width={640}
                      height={480}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full aspect-square object-contain transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                    />
                  </Link>

                  {/* Category Badge */}
                  <span
                    className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm"
                    style={{
                      background:
                        pkg.category === "Traditional"
                          ? "linear-gradient(135deg, #8B4513 0%, #A0522D 100%)"
                          : pkg.category === "Sour"
                          ? "linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)"
                          : pkg.category === "Sweet"
                          ? "linear-gradient(135deg, #FF69B4 0%, #FF89C9 100%)"
                          : "linear-gradient(135deg, #F1A900 0%, #FFB800 100%)",
                      color: "white",
                    }}
                  >
                    {pkg.category}
                  </span>

                  {/* Price Badge */}
                  <span
                    className="absolute top-3 right-3 text-base font-extrabold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, #FF5D39 0%, #FF8F6B 100%)",
                      color: "white",
                    }}
                  >
                    ${pkg.price.toFixed(2)}
                  </span>
                </div>

                {/* Product Details Section */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Title & Description */}
                  <div className="mb-3">
                    <h3 className="font-bold text-lg mb-1.5 text-gray-900 line-clamp-1">
                      {pkg.name}
                    </h3>
                    <p className="text-gray-600 text-xs leading-relaxed line-clamp-2 mb-2">
                      {pkg.description}
                    </p>

                    {/* Stock Status */}
                    {pkg.stock !== undefined && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                          pkg.stock > 20
                            ? "bg-green-100 text-green-700"
                            : pkg.stock > 10
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {pkg.stock > 20
                          ? "In Stock"
                          : pkg.stock > 10
                          ? "Low Stock"
                          : "Limited"}{" "}
                        ({pkg.stock})
                      </span>
                    )}
                  </div>

                  {/* Flavors with Checkboxes - Compact */}
                  {Array.isArray(pkg.flavors) && pkg.flavors.length > 0 && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-xs text-gray-700 mb-1.5">
                        Contains:
                      </h4>
                      <div className="space-y-1">
                        {pkg.flavors
                          .slice(0, 3)
                          .map(
                            (
                              flavor: { name: string; quantity: number },
                              index: number
                            ) => (
                              <label
                                key={index}
                                className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-2 py-1.5 rounded cursor-pointer hover:bg-orange-50 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  defaultChecked
                                  className="w-3.5 h-3.5 text-orange-600 bg-white border-gray-300 rounded focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="flex-1">{flavor.name}</span>
                                {flavor.quantity > 1 && (
                                  <span className="text-xs font-bold text-orange-600">
                                    ×{flavor.quantity}
                                  </span>
                                )}
                              </label>
                            )
                          )}
                        {pkg.flavors.length > 3 && (
                          <div className="text-xs text-gray-500 italic pl-2">
                            +{pkg.flavors.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Buttons - Compact */}
                  <div className="mt-auto space-y-1.5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() =>
                        buyNow(
                          pkg.id,
                          pkg.name,
                          pkg.price,
                          normalizeImageSrc(pkg.imageUrl, pkg.updatedAt),
                          pkg.sku
                        )
                      }
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2.5 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                    >
                      Buy Now
                    </button>
                    <button
                      onClick={() => viewPackage(pkg.id)}
                      className="w-full text-white font-bold py-2.5 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                      style={{ background: "#FF5D39" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#FF6B35")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#FF5D39")
                      }
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* TODO: Uncomment when Build Your Own Pack feature is needed */}
        {/* Custom Pack Builder Card - at the end */}
        {/* <div
            className="group rounded-2xl overflow-hidden bg-white border border-[#F1A900]/20 hover:border-[#F1A900] shadow-md hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 h-full flex flex-col cursor-pointer"
            onClick={() => setShowCustomBuilder(!showCustomBuilder)}
          >
            <div className="relative">
              <div className="w-full aspect-[4/3] bg-gradient-to-br from-[#F1A900]/20 to-[#FF6B35]/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 rounded-t-2xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F1A900] to-[#FF6B35] flex items-center justify-center shadow-lg">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
              </div>
              <span
                className="absolute top-3 sm:top-4 left-3 sm:left-4 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-1 rounded-full shadow"
                style={{
                  background: "#F1A900",
                  color: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                Custom
              </span>
              <span
                className="absolute top-3 sm:top-4 right-3 sm:right-4 text-sm sm:text-lg font-bold px-2.5 sm:px-3 py-1 rounded-full shadow"
                style={{
                  background: ORANGE,
                  color: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                $27.00
              </span>
            </div>
            <div className="p-4 sm:p-6 flex flex-col flex-1 gap-3 sm:gap-4">
              <div>
                <h3
                  className="font-extrabold text-lg sm:text-xl mb-2"
                  style={{ color: BLACK }}
                >
                  Build Your Own Pack
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3">
                  Choose exactly 3 flavors from our collection to create your
                  unique custom pack
                </p>

                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-gray-700">
                    Features:
                  </h4>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F1A900]"></span>
                      Choose any 3 flavors
                    </div>
                    <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"></span>
                      Same great price
                    </div>
                    <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F1A900]"></span>
                      Perfect for you
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2 sm:pt-4 mt-auto">
                <CustomButton
                  title="Start Building"
                  className="w-full !bg-gradient-to-r !from-[#F1A900] !to-[#FF6B35] !text-white font-bold py-2.5 sm:py-3 rounded-lg shadow-lg transition-all hover:opacity-90"
                  onClick={() => setShowCustomBuilder(!showCustomBuilder)}
                />
              </div>
            </div>
          </div> */}
        {!Array.isArray(packages) && (
          <div className="col-span-full text-center py-12">
            <div className="bg-white rounded-lg p-8 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                No Products Available
              </h3>
              <p className="text-gray-600 mb-4">
                Unable to load products at this time.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-white font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-all"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}
      </div>
      {/* TODO: Uncomment when Build Your Own Pack feature is needed - restore closing: )} */}

      {/* <div className="mt-12 text-center">
        <p className="text-white text-lg mb-6">
          Each package contains 3 carefully selected licorice rope flavors for
          the perfect tasting experience.
        </p>
        <Link
          href="/Home"
          className="inline-block bg-white text-black font-bold px-8 py-3 rounded-lg shadow-lg hover:bg-gray-100 transition-all"
        >
          Back to Home
        </Link>
      </div> */}
    </div>
  );
};

export default ShopPage;
