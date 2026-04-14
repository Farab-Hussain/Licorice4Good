"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import apiClient from "@/utils/axios";

const ORANGE = "#FF5D39";
const BLACK = "#111111";

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
  sku?: string;
  supportLevel?: string | null;
  packSize?: number | null;
  variations?: ProductVariation[];
};

interface PackProductSelectorProps {
  packType: "gold" | "platinum";
  onSelectionChange: (selections: PackSelection[]) => void;
  productId: string;
}

export type PackSelection = {
  productId: string;
  productName: string;
  variationId: string;
  variationName: string;
  packSize: number;
  imageUrl?: string | null;
};

const PackProductSelector: React.FC<PackProductSelectorProps> = ({
  packType,
  onSelectionChange,
  productId,
}) => {
  const [threePackProducts, setThreePackProducts] = useState<Product[]>([]);
  const [fourPackProducts, setFourPackProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<PackSelection[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    console.log("[PackProductSelector] Selections changed:", {
      count: selections.length,
      selections: selections.map((s) => ({
        productName: s.productName,
        variationName: s.variationName,
        packSize: s.packSize,
      })),
    });
    onSelectionChange(selections);
  }, [selections, onSelectionChange]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [threePackRes, fourPackRes] = await Promise.all([
        apiClient.get<{ products: Product[] }>("/products/by-pack-size", {
          params: { packSize: 3 },
        }),
        apiClient.get<{ products: Product[] }>("/products/by-pack-size", {
          params: { packSize: 4 },
        }),
      ]);

      const threePacks = threePackRes.data.products || [];
      const fourPacks = fourPackRes.data.products || [];

      setThreePackProducts(threePacks);
      setFourPackProducts(fourPacks);

      // Auto-select all platinum variants (12-pack = 4 different 3-packs)
      if (packType === "platinum") {
        const autoSelections: PackSelection[] = [];
        
        threePacks.forEach((product) => {
          if (product.variations && product.variations.length > 0) {
            product.variations.forEach((variation) => {
              autoSelections.push({
                productId: product.id,
                productName: product.name,
                variationId: variation.id,
                variationName: variation.name,
                packSize: 3,
                imageUrl:
                  variation.images.find((img) => img.isDefault)?.imageUrl ||
                  variation.images[0]?.imageUrl ||
                  product.imageUrl,
              });
            });
          }
        });
        
        setSelections(autoSelections);
      }

      // Debug logging
      console.log("PackProductSelector - Loaded products:", {
        packType,
        threePackCount: threePacks.length,
        fourPackCount: fourPacks.length,
        threePacksWithVariations: threePacks.filter(
          (p) => p.variations && p.variations.length > 0
        ).length,
        fourPacksWithVariations: fourPacks.filter(
          (p) => p.variations && p.variations.length > 0
        ).length,
        threePackDetails: threePacks.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          variationCount: p.variations?.length || 0,
          variations: p.variations?.map((v) => ({ id: v.id, name: v.name })),
        })),
        fourPackDetails: fourPacks.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          variationCount: p.variations?.length || 0,
          variations: p.variations?.map((v) => ({ id: v.id, name: v.name })),
        })),
      });

    } catch (error) {
      console.error("Error fetching products for PackProductSelector:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      // Show error state to user
    } finally {
      setLoading(false);
    }
  };

  const normalizeImageSrc = (src?: string | null) => {
    if (!src) return "/assets/images/slider.png";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return apiUrl ? `${apiUrl}${src.startsWith("/") ? src : `/${src}`}` : src;
  };

  const handleVariationSelect = (
    product: Product,
    variation: ProductVariation
  ) => {
    if (packType === "gold") {
      // Gold: One 3-pack and one 4-pack
      const newSelections = [...selections];

      // Check if this exact variant is already selected
      const isAlreadySelected = newSelections.some(
        (s) => s.productId === product.id && s.variationId === variation.id
      );

      if (isAlreadySelected) {
        // Toggle off: Remove this selection
        const filteredSelections = newSelections.filter(
          (s) => !(s.productId === product.id && s.variationId === variation.id)
        );
        setSelections(filteredSelections);
        return;
      }

      // Toggle on: Add or replace selection for this packSize
      const existingIndex = newSelections.findIndex(
        (s) => s.packSize === product.packSize
      );

      const selection: PackSelection = {
        productId: product.id,
        productName: product.name,
        variationId: variation.id,
        variationName: variation.name,
        packSize: product.packSize || 0,
        imageUrl:
          variation.images.find((img) => img.isDefault)?.imageUrl ||
          variation.images[0]?.imageUrl ||
          product.imageUrl,
      };

      if (existingIndex >= 0) {
        newSelections[existingIndex] = selection;
      } else {
        newSelections.push(selection);
      }

      // Ensure we only have one 3-pack and one 4-pack
      const threePack = newSelections.find((s) => s.packSize === 3);
      const fourPack = newSelections.find((s) => s.packSize === 4);
      setSelections([threePack, fourPack].filter(Boolean) as PackSelection[]);
    } else {
      // Platinum: Multiple 3-packs (all sweet and sour)
      const newSelections = [...selections];

      // Check if this exact variant is already selected
      const isAlreadySelected = newSelections.some(
        (s) => s.productId === product.id && s.variationId === variation.id
      );

      if (isAlreadySelected) {
        // Toggle off: Remove this selection
        const filteredSelections = newSelections.filter(
          (s) => !(s.productId === product.id && s.variationId === variation.id)
        );
        setSelections(filteredSelections);
        return;
      }

      // Toggle on: Add or replace selection for this product
      const existingIndex = newSelections.findIndex(
        (s) => s.productId === product.id
      );

      const selection: PackSelection = {
        productId: product.id,
        productName: product.name,
        variationId: variation.id,
        variationName: variation.name,
        packSize: 3,
        imageUrl:
          variation.images.find((img) => img.isDefault)?.imageUrl ||
          variation.images[0]?.imageUrl ||
          product.imageUrl,
      };

      if (existingIndex >= 0) {
        newSelections[existingIndex] = selection;
      } else {
        newSelections.push(selection);
      }

      setSelections(newSelections);
    }
  };

  const isVariationSelected = (productId: string, variationId: string) => {
    return selections.some(
      (s) => s.productId === productId && s.variationId === variationId
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Loading products and variations...</div>
      </div>
    );
  }

  // Check if we have any products with variations
  const threePacksWithVariations = threePackProducts.filter(
    (p) => p.variations && p.variations.length > 0
  );
  const fourPacksWithVariations = fourPackProducts.filter(
    (p) => p.variations && p.variations.length > 0
  );

  const hasVariations =
    (packType === "gold" &&
      (threePacksWithVariations.length > 0 ||
        fourPacksWithVariations.length > 0)) ||
    (packType === "platinum" && threePacksWithVariations.length > 0);

  if (!hasVariations) {
    return (
      <div className="text-center py-8 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No Variations Available
          </h3>
          <p className="text-gray-600 mb-4">
            No product variations are currently available for selection.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Total products loaded:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>3-pack products: {threePackProducts.length}</li>
              {packType === "gold" && (
                <li>4-pack products: {fourPackProducts.length}</li>
              )}
            </ul>
            <p className="mt-2">Products with variations:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>3-pack products: {threePacksWithVariations.length}</li>
              {packType === "gold" && (
                <li>4-pack products: {fourPacksWithVariations.length}</li>
              )}
            </ul>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Please check the browser console for more details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {packType === "gold" && (
        <>
          {/* Gold: 3-Pack Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Select One 3-Pack
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {threePackProducts
                .filter(
                  (product) =>
                    product.variations && product.variations.length > 0
                )
                .map((product) =>
                  product.variations?.map((variation) => (
                    <div
                      key={`${product.id}-${variation.id}`}
                      onClick={() => handleVariationSelect(product, variation)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${isVariationSelected(product.id, variation.id)
                          ? "border-[#FF5D39] bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="relative w-full h-32 mb-2 rounded overflow-hidden bg-gray-100">
                        <Image
                          src={normalizeImageSrc(
                            (variation.images && variation.images.length > 0
                              ? variation.images.find((img) => img.isDefault)
                                ?.imageUrl || variation.images[0]?.imageUrl
                              : null) || product.imageUrl
                          )}
                          alt={variation.name || product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">
                        {product.name}
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        {variation.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {variation.flavors
                          .map((f) => `${f.name} (${f.quantity})`)
                          .join(", ")}
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>

          {/* Gold: 4-Pack Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Select One 4-Pack
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fourPackProducts
                .filter(
                  (product) =>
                    product.variations && product.variations.length > 0
                )
                .map((product) =>
                  product.variations?.map((variation) => (
                    <div
                      key={`${product.id}-${variation.id}`}
                      onClick={() => handleVariationSelect(product, variation)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${isVariationSelected(product.id, variation.id)
                          ? "border-[#FF5D39] bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="relative w-full h-32 mb-2 rounded overflow-hidden bg-gray-100">
                        <Image
                          src={normalizeImageSrc(
                            (variation.images && variation.images.length > 0
                              ? variation.images.find((img) => img.isDefault)
                                ?.imageUrl || variation.images[0]?.imageUrl
                              : null) || product.imageUrl
                          )}
                          alt={variation.name || product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">
                        {product.name}
                      </div>
                      <div className="text-sm font-medium text-gray-800">
                        {variation.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {variation.flavors
                          .map((f) => `${f.name} (${f.quantity})`)
                          .join(", ")}
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        </>
      )}

      {/* Selection Summary */}
      {selections.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">
            Selected ({selections.length}):
          </h4>
          <div className="space-y-2">
            {selections.map((selection, index) => (
              <div key={index} className="text-sm text-gray-600">
                • {selection.productName} - {selection.variationName} (
                {selection.packSize}-pack)
              </div>
            ))}
          </div>
        </div>
      )}

      {packType === "platinum" && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Select 3-Pack Variations
          </h3>

          <div className="space-y-6">

            {/* Sweet Products */}
            <div>
              <h4 className="text-md font-medium mb-3 text-gray-700">
                Sweet 3-Packs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {threePackProducts
                  .filter(
                    (p) =>
                      p.category.toLowerCase() === "sweet" &&
                      p.variations &&
                      p.variations.length > 0
                  )
                  .map((product) =>
                    product.variations?.map((variation) => (
                      <div
                        key={`${product.id}-${variation.id}`}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isVariationSelected(product.id, variation.id)
                            ? "border-[#FF5D39] bg-orange-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="relative w-full h-32 mb-2 rounded overflow-hidden">
                          <Image
                            src={normalizeImageSrc(
                              variation.images.find((img) => img.isDefault)
                                ?.imageUrl ||
                              variation.images[0]?.imageUrl ||
                              product.imageUrl
                            )}
                            alt={variation.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {product.name}
                        </div>
                        <div className="text-sm font-medium text-gray-800">
                          {variation.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {variation.flavors
                            .map((f) => `${f.name} (${f.quantity})`)
                            .join(", ")}
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>

            {/* Sour Products */}
            <div>
              <h4 className="text-md font-medium mb-3 text-gray-700">
                Sour 3-Packs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {threePackProducts
                  .filter(
                    (p) =>
                      p.category.toLowerCase() === "sour" &&
                      p.variations &&
                      p.variations.length > 0
                  )
                  .map((product) =>
                    product.variations?.map((variation) => (
                      <div
                        key={`${product.id}-${variation.id}`}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isVariationSelected(product.id, variation.id)
                            ? "border-[#FF5D39] bg-orange-50"
                            : "border-gray-200"
                        }`}
                      >

                        <div className="relative w-full h-32 mb-2 rounded overflow-hidden">
                          <Image
                            src={normalizeImageSrc(
                              variation.images.find((img) => img.isDefault)
                                ?.imageUrl ||
                              variation.images[0]?.imageUrl ||
                              product.imageUrl
                            )}
                            alt={variation.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {product.name}
                        </div>
                        <div className="text-sm font-medium text-gray-800">
                          {variation.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {variation.flavors
                            .map((f) => `${f.name} (${f.quantity})`)
                            .join(", ")}
                        </div>

                      </div>
                    ))
                  )}
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default PackProductSelector;
