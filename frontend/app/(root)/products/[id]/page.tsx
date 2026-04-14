"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { trackEcommerce } from "@/hooks/useTrackdeskEvent";
import PackProductSelector, {
  PackSelection,
} from "@/components/ui/shop/PackProductSelector";
import FormattedDescription from "@/components/ui/FormattedDescription";
const ORANGE = "#FF5D39";
const BLACK = "#111111";

// Product data structure matching the backend API
type ProductVariation = {
  id: string;
  name: string;
  sku?: string;
  isActive?: boolean;
  images: Array<{ id: string; imageUrl: string; isDefault: boolean }>;
  flavors: Array<{ id: string; name: string; quantity: number }>;
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
  flavors?: Array<{ name: string; quantity: number }>;
  sku?: string;
  updatedAt?: string;
  supportLevel?: string | null;
  packSize?: number | null;
  isPackProduct?: boolean;
  packType?: string | null;
  nutritionFactsUrl?: string | null;
  nutritionFacts?: Array<{
    id: string;
    fileUrl: string;
    fileName?: string | null;
    fileType?: string | null;
    displayOrder: number;
  }>;
  variations?: ProductVariation[];
};

const ProductDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] =
    useState<ProductVariation | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [packSelections, setPackSelections] = useState<PackSelection[]>([]);
  const [preSelectedVariationId, setPreSelectedVariationId] = useState<
    string | null
  >(null);

  // Log packSelections changes
  useEffect(() => {
    console.log("[Product Detail] packSelections updated:", {
      count: packSelections.length,
      selections: packSelections.map((s) => ({
        productName: s.productName,
        variationName: s.variationName,
        packSize: s.packSize,
      })),
    });
  }, [packSelections]);

  const id = typeof params?.id === "string" ? params.id : "";

  // Get variation ID from URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const variationId = urlParams.get("variation");
      if (variationId) {
        setPreSelectedVariationId(variationId);
      }
    }
  }, []);

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

  // Fetch product from backend API
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError("Product ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/products/${id}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Product not found");
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          setLoading(false);
          return;
        }

        const data = await response.json();

        // Handle different response formats
        let productData: Product | null = null;
        if (data && data.id) {
          productData = data;
          setProduct(data);
        } else if (data && data.product) {
          productData = data.product;
          setProduct(data.product);
        } else {
          console.error("Unexpected product API response format:", data);
          throw new Error("Invalid product API response format");
        }

        // Set initial image and variation
        if (productData) {
          if (productData.variations && productData.variations.length > 0) {
            // If a variation ID is provided in URL, use that specific variation
            if (preSelectedVariationId) {
              const preSelectedVariation = productData.variations.find(
                (v) => v.id === preSelectedVariationId
              );
              if (preSelectedVariation) {
                setSelectedVariation(preSelectedVariation);
                const variationImage =
                  preSelectedVariation.images.find((img) => img.isDefault) ||
                  preSelectedVariation.images[0];
                setCurrentImageUrl(
                  variationImage?.imageUrl || productData.imageUrl || null
                );
              } else {
                // Variation not found, use first variation as fallback
                const firstVariation = productData.variations[0];
                setSelectedVariation(firstVariation);
                const variationImage =
                  firstVariation.images.find((img) => img.isDefault) ||
                  firstVariation.images[0];
                setCurrentImageUrl(
                  variationImage?.imageUrl || productData.imageUrl || null
                );
              }
            } else {
              // No pre-selected variation, use first variation as default
              const firstVariation = productData.variations[0];
              setSelectedVariation(firstVariation);
              const variationImage =
                firstVariation.images.find((img) => img.isDefault) ||
                firstVariation.images[0];
              setCurrentImageUrl(
                variationImage?.imageUrl || productData.imageUrl || null
              );
            }
          } else {
            setCurrentImageUrl(productData.imageUrl || null);
          }
        }

        // Track product view
        if (productData && typeof window !== "undefined" && window.Trackdesk) {
          trackEcommerce.productView({
            id: productData.id,
            name: productData.name,
            price: productData.price,
            category: productData.category,
            sku: productData.sku,
          });
        }
      } catch (err) {
        console.error("Failed to fetch product:", err);
        setError("Failed to load product. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, preSelectedVariationId]);

  const { addItem } = useCartStore();
  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlistStore();

  const handleAddToCart = async () => {
    if (!product) return;

    // For pack products, validate selections
    if (product.isPackProduct) {
      if (product.packType === "gold" && packSelections.length !== 2) {
        alert("Please select one 3-pack and one 4-pack");
        return;
      }
      if (product.packType === "platinum" && packSelections.length === 0) {
        alert("Please select at least one variant before adding to cart");
        return;
      }
    }

    setAddingToCart(true);
    try {
      if (product.isPackProduct && packSelections.length > 0) {
        console.log("[Add to Cart] Adding pack product to cart:", {
          packType: product.packType,
          packSelectionsCount: packSelections.length,
          packSelections: packSelections.map((s) => ({
            productId: s.productId,
            productName: s.productName,
            variationId: s.variationId,
            variationName: s.variationName,
            packSize: s.packSize,
          })),
        });

        // Add each selected variation as a separate cart item
        // For "Add to Cart", always use quantity 1 (one complete pack)
        for (const selection of packSelections) {
          const itemToAdd = {
            productId: selection.productId,
            productName: selection.productName,
            quantity: 1, // Always 1 for "Add to Cart" (one complete pack)
            price: product.price / packSelections.length, // Divide price among selections
            imageUrl: normalizeImageSrc(selection.imageUrl, product.updatedAt),
            sku: product.sku,
            variationId: selection.variationId,
            variationName: selection.variationName,
            packProductId: product.id, // Reference to the pack product
            packProductName: product.name,
            packSize: selection.packSize, // Include pack size
          };

          console.log("[Add to Cart] Adding item to cart:", {
            variationName: selection.variationName,
            quantity: itemToAdd.quantity,
            price: itemToAdd.price,
            packProductId: itemToAdd.packProductId,
            packProductName: itemToAdd.packProductName,
          });

          await addItem(itemToAdd);
        }

        console.log("[Add to Cart] Successfully added all pack items to cart");
      } else {
        // Regular product or variation
        const imageToUse = selectedVariation
          ? (
              selectedVariation.images.find((img) => img.isDefault) ||
              selectedVariation.images[0]
            )?.imageUrl
          : product.imageUrl;

        await addItem({
          productId: product.id,
          productName: product.name,
          quantity,
          price: product.price,
          imageUrl: normalizeImageSrc(
            imageToUse || product.imageUrl,
            product.updatedAt
          ),
          sku: product.sku,
          variationId: selectedVariation?.id,
          variationName: selectedVariation?.name,
        });
      }

      // Redirect to cart page after successful addition
      router.push("/cart");
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;

    // For pack products, validate selections
    if (product.isPackProduct) {
      if (product.packType === "gold" && packSelections.length !== 2) {
        alert("Please select one 3-pack and one 4-pack");
        return;
      }
      if (product.packType === "platinum" && packSelections.length === 0) {
        alert("Please select at least one variant before proceeding to checkout");
        return;
      }
    }

    setAddingToCart(true);
    try {
      // Handle pack products with multiple variations
      if (product.isPackProduct && packSelections.length > 0) {
        console.log("[Buy Now] Adding pack product to cart:", {
          packType: product.packType,
          packSelectionsCount: packSelections.length,
          quantity: quantity,
          packSelections: packSelections.map((s) => ({
            productId: s.productId,
            productName: s.productName,
            variationId: s.variationId,
            variationName: s.variationName,
            packSize: s.packSize,
          })),
        });

        // Add each selected variation as a separate cart item
        for (const selection of packSelections) {
          const itemToAdd = {
            productId: selection.productId,
            productName: selection.productName,
            quantity: quantity, // This is the quantity of complete packs
            price: product.price / packSelections.length, // Divide price among selections
            imageUrl: normalizeImageSrc(selection.imageUrl, product.updatedAt),
            sku: product.sku,
            variationId: selection.variationId,
            variationName: selection.variationName,
            packProductId: product.id, // Reference to the pack product
            packProductName: product.name,
            packSize: selection.packSize, // Include pack size
          };

          console.log("[Buy Now] Adding item to cart:", {
            variationName: selection.variationName,
            quantity: itemToAdd.quantity,
            price: itemToAdd.price,
            packProductId: itemToAdd.packProductId,
            packProductName: itemToAdd.packProductName,
          });

          await addItem(itemToAdd);
        }

        console.log("[Buy Now] Successfully added all pack items to cart");
      } else {
        // Regular product or single variation
        const imageToUse = selectedVariation
          ? (
              selectedVariation.images.find((img) => img.isDefault) ||
              selectedVariation.images[0]
            )?.imageUrl
          : product.imageUrl;

        await addItem({
          productId: product.id,
          productName: product.name,
          quantity,
          price: product.price,
          imageUrl: normalizeImageSrc(
            imageToUse || product.imageUrl,
            product.updatedAt
          ),
          sku: product.sku,
          variationId: selectedVariation?.id,
          variationName: selectedVariation?.name,
        });
      }

      // Track buy now event
      if (typeof window !== "undefined" && window.Trackdesk) {
        trackEcommerce.addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity,
          sku: product.sku,
        });
      }

      // Redirect directly to checkout for faster purchase
      router.push("/checkout");
    } catch (error) {
      console.error("Failed to buy now:", error);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = () => {
    if (!product) return;

    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist({
        productId: product.id,
        productName: product.name,
        price: product.price,
        imageUrl: normalizeImageSrc(product.imageUrl, product.updatedAt),
        sku: product.sku,
        category: product.category,
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen layout py-10 bg-shop-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h3 className="text-2xl font-bold mb-2" style={{ color: BLACK }}>
            {error || "Product not found"}
          </h3>
          <p className="mb-6" style={{ color: BLACK, opacity: 0.7 }}>
            {error || "The product you're looking for doesn't exist."}
          </p>
          {!error && (
            <div className="mb-6 p-4 bg-gray-100 rounded-lg text-sm text-left">
              <div>
                <strong>Requested ID:</strong> {id}
              </div>
            </div>
          )}
          <Link
            href="/shop"
            className="inline-block bg-primary text-white font-bold px-8 py-3 rounded-lg shadow-lg hover:opacity-90 transition-all"
          >
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen layout py-6 sm:py-10 bg-shop-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        {/* Navigation */}
        <nav className="text-xs sm:text-sm mb-4 sm:mb-6 flex items-center gap-2 text-white">
          <Link href="/shop" className="hover:underline">
            Shop
          </Link>
          <span className="mx-1 text-gray-400">/</span>
          <span className="text-white font-semibold">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-12 bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg p-3 sm:p-4 lg:p-10">
          {/* Product Image */}
          <div className="relative">
            <div className="rounded-xl lg:rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gradient-to-br from-gray-50 to-gray-100 relative group flex items-center justify-center p-4 sm:p-6 lg:p-8">
              <Image
                src={normalizeImageSrc(
                  currentImageUrl || product.imageUrl,
                  product.updatedAt
                )}
                alt={product.name}
                width={1000}
                height={1000}
                className="w-full h-auto max-h-[300px] sm:max-h-[400px] lg:max-h-[500px] object-contain transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 80vw, 600px"
                priority
              />
              <span
                className="absolute top-3 left-3 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-lg font-semibold"
                style={{
                  background:
                    product.category === "Traditional"
                      ? "#8B4513"
                      : product.category === "Sour"
                      ? "#FF6B35"
                      : product.category === "Sweet"
                      ? "#FF69B4"
                      : ORANGE,
                }}
              >
                {product.category}
              </span>
              {product.supportLevel && (
                <span
                  className="absolute top-3 right-3 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-lg font-semibold"
                  style={{
                    background:
                      product.supportLevel === "Bronze"
                        ? "#CD7F32"
                        : product.supportLevel === "Silver"
                        ? "#C0C0C0"
                        : product.supportLevel === "Gold"
                        ? "#FFD700"
                        : product.supportLevel === "Platinum"
                        ? "#E5E4E2"
                        : ORANGE,
                  }}
                >
                  {product.supportLevel}{" "}
                  {product.packSize && `${product.packSize}-Pack`}
                </span>
              )}
            </div>
          </div>

          {/* Product Details */}
          <div className="flex flex-col justify-between space-y-3 sm:space-y-4 lg:space-y-6">
            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black">
                {selectedVariation && preSelectedVariationId
                  ? `${product.name} - ${selectedVariation.name}`
                  : product.name}
              </h1>

              {/* SKU */}
              <div className="text-xs text-gray-500 font-mono">
                SKU: {product.sku}
              </div>

              {/* Price */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span
                    className="text-xl sm:text-2xl font-bold"
                    style={{ color: ORANGE }}
                  >
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">
                    per pack
                    {product.packSize === 12 && (
                      <span className="text-xs text-gray-500 ml-1">$21</span>
                    )}
                  </span>
                  {product.stock !== undefined && (
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        product.stock > 20
                          ? "bg-green-100 text-green-700"
                          : product.stock > 10
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.stock > 20
                        ? "In Stock"
                        : product.stock > 10
                        ? "Low Stock"
                        : "Limited"}{" "}
                      ({product.stock})
                    </span>
                  )}
                </div>
                {/* Total Price Display */}
                {quantity > 1 && (
                  <div className="rounded-lg p-2 bg-orange-50 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Total for {quantity} pack{quantity > 1 ? "s" : ""}:
                      </span>
                      <span className="text-lg font-bold text-orange-600">
                        ${(product.price * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description - Formatted */}
              {product.description && (
                <div className="text-gray-700 text-sm sm:text-base">
                  <FormattedDescription
                    description={product.description}
                    className="leading-relaxed"
                  />
                </div>
              )}

              {/* Pack Product Selector */}
              {product.isPackProduct && product.packType && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <PackProductSelector
                    packType={product.packType as "gold" | "platinum"}
                    onSelectionChange={setPackSelections}
                    productId={product.id}
                  />
                </div>
              )}

              {/* Variations Selection - Options Below for Purchase */}
              {!product.isPackProduct &&
                product.variations &&
                product.variations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-black mb-3 text-base">
                      {preSelectedVariationId
                        ? "Selected Variation:"
                        : "Options Below for Purchase:"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {/* If a variation is pre-selected, show only that variation */}
                      {(preSelectedVariationId
                        ? product.variations.filter(
                            (v) => v.id === preSelectedVariationId
                          )
                        : product.variations
                      ).map((variation) => (
                        <div
                          key={variation.id}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                            selectedVariation?.id === variation.id
                              ? "border-[#FF5D39] bg-orange-50 shadow-md"
                              : preSelectedVariationId
                              ? "border-gray-300 bg-gray-50"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                          } ${!preSelectedVariationId ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            // Only allow selection if no variation is pre-selected
                            if (!preSelectedVariationId) {
                              setSelectedVariation(variation);
                              const variationImage =
                                variation.images.find((img) => img.isDefault) ||
                                variation.images[0];
                              setCurrentImageUrl(
                                variationImage?.imageUrl ||
                                  product.imageUrl ||
                                  null
                              );
                            }
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-gray-900">
                              {variation.name}
                            </span>
                            {selectedVariation?.id === variation.id && (
                              <span className="text-[#FF5D39] text-lg font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          {variation.flavors.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600 leading-relaxed">
                              <span className="font-medium">1 each: </span>
                              {variation.flavors.map((f, idx) => (
                                <span key={f.id}>
                                  {f.name}
                                  {f.quantity > 1 && ` ×${f.quantity}`}
                                  {idx < variation.flavors.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Flavors with Checkboxes */}
              <div>
                <h3 className="font-medium text-black mb-2 text-sm">
                  Contains:
                </h3>
                <div className="space-y-2">
                  {selectedVariation && selectedVariation.flavors.length > 0 ? (
                    selectedVariation.flavors.map((flavor, index) => (
                      <label
                        key={index}
                        className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                        />
                        <span className="text-gray-700">
                          {flavor.name}{" "}
                          {flavor.quantity > 1 && `×${flavor.quantity}`}
                        </span>
                      </label>
                    ))
                  ) : Array.isArray(product.flavors) &&
                    product.flavors.length > 0 ? (
                    product.flavors.map((flavor, index) => (
                      <label
                        key={index}
                        className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                        />
                        <span className="text-gray-700">
                          {flavor.name}{" "}
                          {flavor.quantity > 1 && `×${flavor.quantity}`}
                        </span>
                      </label>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">
                      No flavors listed.
                    </span>
                  )}
                </div>
              </div>

              {/* Nutrition Facts - Multiple Files */}
              {(product.nutritionFacts && product.nutritionFacts.length > 0) ||
              product.nutritionFactsUrl ? (
                <div className="mt-4">
                  <h3 className="font-medium text-black mb-3 text-sm">
                    Nutrition Facts:
                  </h3>
                  <div className="space-y-3">
                    {/* Display multiple nutrition facts */}
                    {product.nutritionFacts && product.nutritionFacts.length > 0
                      ? product.nutritionFacts.map((nf) => (
                          <div
                            key={nf.id}
                            className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            {nf.fileType === "pdf" ? (
                              <a
                                href={normalizeImageSrc(
                                  nf.fileUrl,
                                  product.updatedAt
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <svg
                                    className="w-8 h-8 text-red-500 flex-shrink-0"
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
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {nf.fileName || "Nutrition Facts PDF"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Click to view PDF
                                    </p>
                                  </div>
                                  <svg
                                    className="w-5 h-5 text-[#FF5D39] flex-shrink-0"
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
                                </div>
                              </a>
                            ) : (
                              <a
                                href={normalizeImageSrc(
                                  nf.fileUrl,
                                  product.updatedAt
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Image
                                  src={normalizeImageSrc(
                                    nf.fileUrl,
                                    product.updatedAt
                                  )}
                                  alt={nf.fileName || "Nutrition Facts"}
                                  width={500}
                                  height={600}
                                  className="w-full h-auto object-contain"
                                />
                              </a>
                            )}
                          </div>
                        ))
                      : product.nutritionFactsUrl && (
                          // Fallback to old single nutrition facts URL
                          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <a
                              href={normalizeImageSrc(
                                product.nutritionFactsUrl,
                                product.updatedAt
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#FF5D39] hover:underline text-sm flex items-center gap-2"
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
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              View Nutrition Facts
                            </a>
                          </div>
                        )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Add to Cart Section */}
            <div className="space-y-4">
              <div className="flex flex-row items-center gap-4">
                <span className="text-black font-medium text-sm">Quantity</span>
                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={product.stock || 99}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.max(
                          1,
                          Math.min(
                            product.stock || 99,
                            Number(e.target.value) || 1
                          )
                        )
                      )
                    }
                    className="w-12 h-8 text-center font-medium text-sm text-gray-900 bg-transparent outline-none border-0 border-l border-r border-gray-300"
                  />
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    onClick={() =>
                      setQuantity((q) => Math.min(product.stock || 99, q + 1))
                    }
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
                {product.stock !== undefined && (
                  <span className="text-xs text-gray-500 ml-2">
                    Max: {product.stock}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={
                    addingToCart ||
                    (product.stock !== undefined && product.stock <= 0)
                  }
                  onClick={handleBuyNow}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-sm shadow-lg hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {addingToCart
                    ? "Processing..."
                    : product.stock !== undefined && product.stock <= 0
                    ? "Out of Stock"
                    : `Buy Now - $${(product.price * quantity).toFixed(2)}`}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      addingToCart ||
                      (product.stock !== undefined && product.stock <= 0)
                    }
                    onClick={handleAddToCart}
                    className="flex-1 px-4 py-3 rounded-lg text-white font-bold text-sm shadow-lg hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FF5D39]"
                    style={{ background: ORANGE }}
                  >
                    {addingToCart
                      ? "Adding..."
                      : product.stock !== undefined && product.stock <= 0
                      ? "Out of Stock"
                      : `Add to Cart`}
                  </button>
                  <button
                    type="button"
                    onClick={handleWishlistToggle}
                    className={`px-3 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#FF5D39] cursor-pointer ${
                      isInWishlist(product.id)
                        ? "border-red-500 text-red-500 hover:bg-red-50"
                        : "border-gray-300 text-gray-600 hover:border-[#FF5D39] hover:text-[#FF5D39]"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={isInWishlist(product.id) ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Features */}
              {/* <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <span className="text-green-600">✓</span>
                  Free shipping on orders over $50
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <span className="text-green-600">✓</span>
                  30-day money-back guarantee
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
