import React, { useState, useEffect } from "react";
import apiClient from "@/utils/axios";
import { toast } from "react-toastify";

interface ProductFlavor {
  id: string;
  name: string;
  quantity: number;
}

interface ProductVariation {
  id?: string;
  name: string;
  sku?: string;
  isActive?: boolean;
  flavors: Array<{ id: string; name: string; quantity: number }>;
  images: Array<{ id: string; imageUrl: string; isDefault: boolean }>;
  imageFile?: File | null;
  imagePreview?: string | null;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock?: number;
  category: string;
  imageUrl?: string | null;
  updatedAt?: string;
  sku?: string;
  flavors?: ProductFlavor[];
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
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product, imageFile?: File | null) => void;
  product: Product | null;
  productCategories: string[];
  availableFlavors: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  onSave: _onSave, // Kept for interface compatibility but modal handles saving internally
  product,
  productCategories,
  availableFlavors,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    category: "",
    sku: "",
    flavors: [] as ProductFlavor[],
    supportLevel: "" as string | null,
    packSize: null as number | null,
    isPackProduct: false,
    packType: null as string | null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [savingVariations, setSavingVariations] = useState(false);

  useEffect(() => {
    if (product) {
      console.log("EditProductModal: Product data received:", product);
      console.log("EditProductModal: Product variations:", product.variations);

      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        stock: product.stock || 0,
        category: product.category,
        sku: product.sku || "",
        flavors: product.flavors || [],
        supportLevel: product.supportLevel || null,
        packSize: product.packSize || null,
        isPackProduct: product.isPackProduct || false,
        packType: product.packType || null,
      });

      // Set image preview
      if (product.imageUrl) {
        const normalizedUrl = normalizeImageSrc(
          product.imageUrl,
          product.updatedAt
        );
        setImagePreview(normalizedUrl);
      } else {
        setImagePreview(null);
      }

      // Load existing nutrition facts
      if (product.nutritionFacts && product.nutritionFacts.length > 0) {
        setExistingNutritionFacts(product.nutritionFacts);
      } else {
        setExistingNutritionFacts([]);
      }
      setNutritionFactsFiles([]);

      // Load variations - fetch fresh data if product has ID but no variations in prop
      if (product.variations && product.variations.length > 0) {
        console.log(
          "EditProductModal: Loading variations from product prop:",
          product.variations
        );
        setVariations(
          product.variations.map((v) => ({
            ...v,
            imageFile: null,
            imagePreview:
              v.images && v.images.length > 0
                ? normalizeImageSrc(
                    v.images.find((img) => img.isDefault)?.imageUrl ||
                      v.images[0]?.imageUrl,
                    product.updatedAt
                  )
                : null,
          }))
        );
      } else if (product.id) {
        // If product has ID but no variations in prop, fetch them
        console.log(
          "EditProductModal: Product has no variations in prop, fetching from API..."
        );
        apiClient
          .get(`/variations/product/${product.id}`)
          .then((response) => {
            console.log(
              "EditProductModal: Fetched variations response:",
              response.data
            );
            // API returns { variations: [...] }
            const variationsData = response.data?.variations || [];
            if (variationsData.length > 0) {
              console.log(
                "EditProductModal: Loading",
                variationsData.length,
                "variations"
              );
              setVariations(
                variationsData.map(
                  (v: {
                    id: string;
                    name: string;
                    sku?: string;
                    isActive?: boolean;
                    flavors?: Array<{
                      flavor?: { id: string; name: string };
                      flavorId?: string;
                      name?: string;
                      quantity?: number;
                    }>;
                    images?: Array<{
                      id: string;
                      imageUrl: string;
                      isDefault?: boolean;
                    }>;
                  }) => ({
                    id: v.id,
                    name: v.name,
                    sku: v.sku,
                    isActive: v.isActive,
                    flavors:
                      v.flavors?.map((vf) => ({
                        id: vf.flavor?.id || vf.flavorId || "",
                        name: vf.flavor?.name || vf.name || "",
                        quantity: vf.quantity || 1,
                      })) || [],
                    images: v.images || [],
                    imageFile: null,
                    imagePreview:
                      v.images && v.images.length > 0
                        ? normalizeImageSrc(
                            v.images.find((img) => img.isDefault)?.imageUrl ||
                              v.images[0]?.imageUrl,
                            product.updatedAt
                          )
                        : null,
                  })
                )
              );
            } else {
              console.log("EditProductModal: No variations found");
              setVariations([]);
            }
          })
          .catch((err) => {
            console.error("EditProductModal: Error fetching variations:", err);
            setVariations([]);
          });
      } else {
        setVariations([]);
      }

      // Clear any selected new files
      setImageFile(null);
      nutritionFactsFiles.forEach((nf) => {
        if (nf.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(nf.preview);
        }
      });
      setNutritionFactsFiles([]);
    } else {
      // Reset form when product is null
      setFormData({
        name: "",
        description: "",
        price: 0,
        stock: 0,
        category: "",
        sku: "",
        flavors: [],
        supportLevel: null,
        packSize: null,
        isPackProduct: false,
        packType: null,
      });
      setVariations([]);
      setImagePreview(null);
      nutritionFactsFiles.forEach((nf) => {
        if (nf.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(nf.preview);
        }
      });
      setNutritionFactsFiles([]);
      setExistingNutritionFacts([]);
      setImageFile(null);
    }
  }, [product]);

  // Helper function to normalize image URLs
  const normalizeImageSrc = (src?: string | null, updatedAt?: string) => {
    if (!src) return "/assets/images/slider.png";

    if (src.startsWith("/assets")) {
      const cacheBuster = updatedAt
        ? `?t=${new Date(updatedAt).getTime()}`
        : `?t=${Date.now()}`;
      return `${src}${cacheBuster}`;
    }

    if (src.startsWith("/uploads") || src.startsWith("uploads")) {
      const path = src.startsWith("/uploads") ? src : `/${src}`;
      const cacheBuster = updatedAt
        ? `?t=${new Date(updatedAt).getTime()}`
        : `?t=${Date.now()}`;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return `${path}${cacheBuster}`;
      return `${apiUrl}${path}${cacheBuster}`;
    }

    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }

    return "/assets/images/slider.png";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    try {
      setSavingVariations(true);

      // Create FormData for product update
      const productFd = new FormData();
      productFd.append("name", formData.name);
      productFd.append("price", String(formData.price));
      productFd.append("stock", String(formData.stock));
      productFd.append("category", formData.category);
      productFd.append("description", formData.description);
      productFd.append("sku", formData.sku);
      if (formData.supportLevel) {
        productFd.append("supportLevel", formData.supportLevel);
      }
      if (formData.packSize !== null) {
        productFd.append("packSize", String(formData.packSize));
      }
      if (formData.flavors && formData.flavors.length > 0) {
        productFd.append(
          "flavors",
          JSON.stringify(
            formData.flavors.map((f) => ({
              name: f.name,
              quantity: f.quantity,
            }))
          )
        );
      }
      if (imageFile) {
        productFd.append("productImage", imageFile);
      }
      // Add multiple nutrition facts files if provided
      nutritionFactsFiles.forEach((nf) => {
        productFd.append("nutritionFacts", nf.file);
      });

      // Save the product
      await apiClient.put(`/products/admin/${product.id}`, productFd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Handle variations
      if (product.id) {
        const productId = product.id;
        const originalVariations = product.variations || [];
        const originalVariationIds = new Set(
          originalVariations.map((v) => v.id).filter(Boolean)
        );
        const newVariationIds = new Set(
          variations.filter((v) => v.id).map((v) => v.id!)
        );

        // Delete variations that were removed
        for (const originalVar of originalVariations) {
          if (originalVar.id && !newVariationIds.has(originalVar.id)) {
            try {
              await apiClient.delete(`/variations/${originalVar.id}`);
            } catch (err) {
              console.error("Error deleting variation:", err);
            }
          }
        }

        // Handle variations
        if (variations.length > 0) {
          const productId = product.id;
          const originalVariations = product.variations || [];
          const newVariationIds = new Set(
            variations.filter((v) => v.id).map((v) => v.id!)
          );

          // Delete variations that were removed
          for (const originalVar of originalVariations) {
            if (originalVar.id && !newVariationIds.has(originalVar.id)) {
              try {
                await apiClient.delete(`/variations/${originalVar.id}`);
              } catch (err) {
                console.error("Error deleting variation:", err);
                toast.warning(
                  `Failed to delete variation: ${originalVar.name}`
                );
              }
            }
          }

          // Update or create variations
          for (const variation of variations) {
            try {
              if (!variation.name || variation.name.trim() === "") {
                console.warn("Skipping variation with empty name");
                continue;
              }

              if (variation.id) {
                // Update existing variation
                const variationFd = new FormData();
                variationFd.append("name", variation.name.trim());
                if (variation.flavors && variation.flavors.length > 0) {
                  variationFd.append(
                    "flavors",
                    JSON.stringify(
                      variation.flavors
                        .filter((f) => f.name && f.name.trim() !== "")
                        .map((f) => ({
                          name: f.name,
                          quantity: f.quantity || 1,
                        }))
                    )
                  );
                } else {
                  variationFd.append("flavors", JSON.stringify([]));
                }

                await apiClient.put(
                  `/variations/${variation.id}`,
                  variationFd,
                  {
                    headers: { "Content-Type": "multipart/form-data" },
                  }
                );

                // Update variation image if new file provided
                if (variation.imageFile && variation.id) {
                  const imageFd = new FormData();
                  imageFd.append("productImage", variation.imageFile);
                  imageFd.append("isDefault", "true");
                  imageFd.append("replaceExisting", "true"); // Delete old default image before adding new one

                  try {
                    await apiClient.post(
                      `/variations/${variation.id}/images`,
                      imageFd,
                      {
                        headers: { "Content-Type": "multipart/form-data" },
                      }
                    );
                    console.log(
                      `Variation image updated for variation ${variation.id}`
                    );
                  } catch (imageError: unknown) {
                    console.error(
                      "Error updating variation image:",
                      imageError
                    );
                    const error = imageError as {
                      response?: {
                        data?: { message?: string; error?: string };
                      };
                      message?: string;
                    };
                    const errorMessage =
                      error?.response?.data?.message ||
                      error?.response?.data?.error ||
                      error?.message ||
                      "Unknown error";
                    toast.warning(
                      `Failed to update image for variation "${variation.name}": ${errorMessage}`
                    );
                    // Continue with other variations even if image update fails
                  }
                }
              } else {
                // Create new variation
                const variationFd = new FormData();
                variationFd.append("name", variation.name.trim());
                if (variation.flavors && variation.flavors.length > 0) {
                  variationFd.append(
                    "flavors",
                    JSON.stringify(
                      variation.flavors
                        .filter((f) => f.name && f.name.trim() !== "")
                        .map((f) => ({
                          name: f.name,
                          quantity: f.quantity || 1,
                        }))
                    )
                  );
                } else {
                  variationFd.append("flavors", JSON.stringify([]));
                }

                const variationResponse = await apiClient.post(
                  `/variations/product/${productId}`,
                  variationFd,
                  {
                    headers: { "Content-Type": "multipart/form-data" },
                  }
                );

                console.log(
                  "Variation creation response:",
                  variationResponse.data
                );

                // Add image to new variation if provided
                const newVariationId =
                  variationResponse.data?.variation?.id ||
                  variationResponse.data?.id;
                if (variation.imageFile && newVariationId) {
                  const imageFd = new FormData();
                  imageFd.append("productImage", variation.imageFile);
                  imageFd.append("isDefault", "true");

                  await apiClient.post(
                    `/variations/${newVariationId}/images`,
                    imageFd,
                    {
                      headers: { "Content-Type": "multipart/form-data" },
                    }
                  );
                }
              }
            } catch (variationError: unknown) {
              console.error("Error saving variation:", variationError);
              const error = variationError as {
                response?: { data?: { message?: string; error?: string } };
                message?: string;
              };
              const errorMessage =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Unknown error";
              console.error("Variation error details:", {
                variationName: variation.name,
                variationId: variation.id,
                errorMessage,
                fullError: error,
              });
              toast.warning(
                `Failed to save variation "${variation.name}": ${errorMessage}`
              );
            }
          }
        }
      }

      toast.success("Product and variations updated successfully");
      // Close modal - parent should refresh products list
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setSavingVariations(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(product?.imageUrl || null);
    }
  };

  const handleNutritionFactsChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxFiles = 13;
    const currentCount =
      nutritionFactsFiles.length + existingNutritionFacts.length;

    if (currentCount + files.length > maxFiles) {
      toast.error(
        `Maximum ${maxFiles} nutrition fact files allowed. You already have ${currentCount} file(s).`
      );
      e.target.value = "";
      return;
    }

    const maxSizeMB = 500;
    const validFiles: Array<{ file: File; preview: string; id: string }> = [];

    files.forEach((file) => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        toast.error(
          `File "${file.name}" is too large (${fileSizeMB.toFixed(
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
      setNutritionFactsFiles((prev) => [...prev, ...validFiles]);
    }
    e.target.value = "";
  };

  const handleDeleteExistingNutritionFact = async (nutritionFactId: string) => {
    try {
      await apiClient.delete(
        `/products/admin/nutrition-facts/${nutritionFactId}`
      );
      setExistingNutritionFacts((prev) =>
        prev.filter((item) => item.id !== nutritionFactId)
      );
      toast.success("Nutrition fact deleted");
    } catch (error) {
      toast.error("Failed to delete nutrition fact");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          maxWidth: "800px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          overflowX: "hidden",
        }}
        className="custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "20px",
            fontWeight: "bold",
            color: "#1f2937",
          }}
        >
          Edit Product
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Basic Product Info */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                color: "#1f2937",
                backgroundColor: "white",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              Description (Notepad Style - Supports Formatting)
            </label>
            <div style={{ marginBottom: "16px" }}>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter product description with formatting...

## Main Heading
### Subheading
- Bullet point 1
- Bullet point 2
- Bullet point 3

Regular paragraph text here..."
                rows={12}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  resize: "vertical",
                  color: "#1f2937",
                  backgroundColor: "#f9fafb",
                  fontFamily: "monospace",
                  minHeight: "200px",
                }}
              />
              <div
                style={{
                  marginTop: "8px",
                  backgroundColor: "#dbeafe",
                  border: "1px solid #93c5fd",
                  borderRadius: "4px",
                  padding: "8px",
                  fontSize: "11px",
                  color: "#1e40af",
                }}
              >
                <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                  Formatting Guide:
                </p>
                <ul
                  style={{
                    listStyle: "disc",
                    paddingLeft: "20px",
                    margin: 0,
                    lineHeight: "1.6",
                  }}
                >
                  <li>
                    <code
                      style={{
                        backgroundColor: "#bfdbfe",
                        padding: "2px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      ## Heading
                    </code>{" "}
                    - Main heading
                  </li>
                  <li>
                    <code
                      style={{
                        backgroundColor: "#bfdbfe",
                        padding: "2px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      ### Subheading
                    </code>{" "}
                    - Subheading
                  </li>
                  <li>
                    <code
                      style={{
                        backgroundColor: "#bfdbfe",
                        padding: "2px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      - Item
                    </code>{" "}
                    or{" "}
                    <code
                      style={{
                        backgroundColor: "#bfdbfe",
                        padding: "2px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      * Item
                    </code>{" "}
                    - Bullet point
                  </li>
                  <li>Empty line - Paragraph break</li>
                </ul>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Price
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.price === 0 ? "" : formData.price}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    const numValue = value === "" ? 0 : parseFloat(value);
                    setFormData({
                      ...formData,
                      price: isNaN(numValue) ? 0 : numValue,
                    });
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  const numValue = value === "" ? 0 : parseFloat(value);
                  setFormData({
                    ...formData,
                    price: isNaN(numValue) ? 0 : Math.max(0, numValue),
                  });
                }}
                placeholder="0.00"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Stock
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.stock === 0 ? "" : formData.stock}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d+$/.test(value)) {
                    const numValue = value === "" ? 0 : parseInt(value);
                    setFormData({
                      ...formData,
                      stock: isNaN(numValue) ? 0 : numValue,
                    });
                  }
                }}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
                required
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
                required
              >
                <option value="">Select category</option>
                {productCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                placeholder="e.g., 3P-SWE-WAT-BERRY"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>

          {/* Support Level and Pack Size */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Support Level
              </label>
              <select
                value={formData.supportLevel || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supportLevel: e.target.value || null,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
              >
                <option value="">None (Regular Product)</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Pack Size
              </label>
              <input
                type="number"
                min="1"
                value={formData.packSize ?? ""}
                onChange={(e) => {
                  const value =
                    e.target.value === "" ? null : parseInt(e.target.value);
                  setFormData({ ...formData, packSize: value });
                }}
                placeholder="e.g., 3, 4, 7, 12"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>

          {/* Pack Product Fields */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.isPackProduct || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPackProduct: e.target.checked,
                      packType: e.target.checked ? formData.packType : null,
                    })
                  }
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                  }}
                />
                <span>Is Pack Product (Gold/Platinum Supporter)</span>
              </label>
            </div>

            {formData.isPackProduct && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Pack Type
                </label>
                <select
                  value={formData.packType || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      packType: e.target.value || null,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "14px",
                    color: "#1f2937",
                    backgroundColor: "white",
                  }}
                >
                  <option value="">Select Pack Type</option>
                  <option value="gold">Gold Supporter</option>
                  <option value="platinum">Platinum Supporter</option>
                </select>
              </div>
            )}
          </div>

          {/* Product Flavors Section */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#1f2937",
              }}
            >
              Product Flavors
            </label>
            {formData.flavors && formData.flavors.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                {formData.flavors.map((flavor, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                      padding: "12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <select
                        value={flavor.id || ""}
                        onChange={(e) => {
                          const selectedFlavor = availableFlavors.find(
                            (f) => f.id === e.target.value
                          );
                          const newFlavors = [...formData.flavors];
                          newFlavors[index] = {
                            ...newFlavors[index],
                            id: e.target.value,
                            name: selectedFlavor?.name || "",
                          };
                          setFormData({ ...formData, flavors: newFlavors });
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: "#1f2937",
                          backgroundColor: "white",
                        }}
                      >
                        <option value="">Select flavor</option>
                        {availableFlavors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: "80px" }}>
                      <input
                        type="number"
                        min="1"
                        value={flavor.quantity ?? 1}
                        onChange={(e) => {
                          const newFlavors = [...formData.flavors];
                          newFlavors[index] = {
                            ...newFlavors[index],
                            quantity: parseInt(e.target.value) || 1,
                          };
                          setFormData({ ...formData, flavors: newFlavors });
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: "#1f2937",
                          backgroundColor: "white",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newFlavors = formData.flavors.filter(
                          (_, i) => i !== index
                        );
                        setFormData({ ...formData, flavors: newFlavors });
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(!formData.flavors || formData.flavors.length < 3) && (
              <button
                type="button"
                onClick={() => {
                  const newFlavors = [
                    ...(formData.flavors || []),
                    { id: "", name: "", quantity: 1 },
                  ];
                  setFormData({ ...formData, flavors: newFlavors });
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                + Add Flavor
              </button>
            )}
          </div>

          {/* Product Image */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              Product Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            {imagePreview && (
              <div style={{ marginTop: "12px" }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                    borderRadius: "4px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>
            )}
          </div>

          {/* Nutrition Facts - Multiple Files */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              Nutrition Facts (Optional) - Multiple Files
            </label>

            {/* Existing Nutrition Facts */}
            {existingNutritionFacts.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  Existing Nutrition Facts:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {existingNutritionFacts.map((nf) => (
                    <div
                      key={nf.id}
                      style={{
                        position: "relative",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        padding: "8px",
                        backgroundColor: "#f9fafb",
                      }}
                    >
                      {nf.fileType === "pdf" ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "80px",
                          }}
                        >
                          <svg
                            style={{
                              width: "32px",
                              height: "32px",
                              color: "#ef4444",
                              marginBottom: "4px",
                            }}
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
                          <p
                            style={{
                              fontSize: "10px",
                              color: "#374151",
                              textAlign: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              width: "100%",
                            }}
                          >
                            {nf.fileName || "PDF"}
                          </p>
                        </div>
                      ) : (
                        <div style={{ position: "relative" }}>
                          <img
                            src={normalizeImageSrc(
                              nf.fileUrl,
                              product?.updatedAt
                            )}
                            alt={nf.fileName || "Nutrition Facts"}
                            style={{
                              width: "100%",
                              height: "auto",
                              objectFit: "contain",
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingNutritionFact(nf.id)}
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          backgroundColor: "#ef4444",
                          color: "white",
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
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
              <div style={{ marginBottom: "12px" }}>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  New Files to Upload:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {nutritionFactsFiles.map((nf) => (
                    <div
                      key={nf.id}
                      style={{
                        position: "relative",
                        border: "2px solid #FF5D39",
                        borderRadius: "4px",
                        padding: "8px",
                        backgroundColor: "white",
                      }}
                    >
                      {nf.file.type === "application/pdf" ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "80px",
                          }}
                        >
                          <svg
                            style={{
                              width: "32px",
                              height: "32px",
                              color: "#ef4444",
                              marginBottom: "4px",
                            }}
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
                          <p
                            style={{
                              fontSize: "10px",
                              color: "#374151",
                              textAlign: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              width: "100%",
                            }}
                          >
                            {nf.file.name}
                          </p>
                        </div>
                      ) : (
                        <div style={{ position: "relative" }}>
                          <img
                            src={nf.preview}
                            alt="Nutrition Facts Preview"
                            style={{
                              width: "100%",
                              height: "auto",
                              objectFit: "contain",
                              borderRadius: "4px",
                            }}
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
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          backgroundColor: "#ef4444",
                          color: "white",
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Input */}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleNutritionFactsChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <p
              style={{
                fontSize: "11px",
                color: "#6b7280",
                marginTop: "4px",
              }}
            >
              PNG, JPG, PDF up to 500MB each (Max 13 files)
            </p>
          </div>

          {/* Variations Section */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <label
                style={{
                  fontWeight: "600",
                  color: "#1f2937",
                  fontSize: "16px",
                }}
              >
                Product Variations
              </label>
              <button
                type="button"
                onClick={() => {
                  setVariations([
                    ...variations,
                    {
                      name: "",
                      flavors: [],
                      images: [],
                      imageFile: null,
                      imagePreview: null,
                    },
                  ]);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                + Add Variation
              </button>
            </div>

            {variations.map((variation, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px",
                  backgroundColor: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#1f2937",
                    }}
                  >
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
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
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
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "13px",
                      color: "#1f2937",
                      backgroundColor: "white",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Flavors for this Variation
                  </label>
                  {variation.flavors.map((flavor, flavorIndex) => (
                    <div
                      key={flavorIndex}
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <select
                        value={flavor.id || ""}
                        onChange={(e) => {
                          const selectedFlavor = availableFlavors.find(
                            (f) => f.id === e.target.value
                          );
                          const newVariations = [...variations];
                          newVariations[index].flavors[flavorIndex] = {
                            id: e.target.value,
                            name: selectedFlavor?.name || "",
                            quantity: flavor.quantity,
                          };
                          setVariations(newVariations);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: "#1f2937",
                          backgroundColor: "white",
                        }}
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
                        value={flavor.quantity ?? 1}
                        onChange={(e) => {
                          const newVariations = [...variations];
                          newVariations[index].flavors[flavorIndex].quantity =
                            parseInt(e.target.value) || 1;
                          setVariations(newVariations);
                        }}
                        placeholder="Qty"
                        style={{
                          width: "80px",
                          padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: "#1f2937",
                          backgroundColor: "white",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newVariations = [...variations];
                          newVariations[index].flavors = newVariations[
                            index
                          ].flavors.filter((_, i) => i !== flavorIndex);
                          setVariations(newVariations);
                        }}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
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
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    + Add Flavor
                  </button>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Variation Image
                  </label>
                  {variation.imagePreview && (
                    <div style={{ marginBottom: "8px" }}>
                      <img
                        src={variation.imagePreview}
                        alt="Variation preview"
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          border: "1px solid #d1d5db",
                        }}
                      />
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
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "13px",
                      color: "#1f2937",
                      backgroundColor: "white",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                backgroundColor: "white",
                color: "#374151",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || savingVariations}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "4px",
                backgroundColor:
                  isLoading || savingVariations ? "#9ca3af" : "#dc2626",
                color: "white",
                cursor:
                  isLoading || savingVariations ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              {isLoading || savingVariations ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;
