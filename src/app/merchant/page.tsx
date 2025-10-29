"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  CheckCircle,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Filter,
  Loader2,
  Megaphone,
  Percent,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/guest-cart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// Local interface projections keep the dashboard resilient even if the Supabase
// generated typings lag behind new tables or columns. These align with the
// merchant-oriented tables we introduce for analytics and notifications.
interface MerchantProfile {
  id: string;
  user_id: string;
  business_name: string | null;
  business_description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  created_at: string;
  storefront_url: string | null;
  support_email: string | null;
  support_phone: string | null;
}

interface MerchantMetrics {
  id: string;
  merchant_id: string;
  total_sales: number;
  total_orders: number;
  total_customers: number;
  inventory_value: number;
  last_updated: string;
}

interface MerchantNotification {
  id: string;
  merchant_id: string;
  title: string;
  message: string;
  category: "order" | "inventory" | "payout" | "system";
  is_read: boolean;
  created_at: string;
}

interface MerchantProduct {
  id: string;
  merchant_id: string | null;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category_id: string | null;
  image_url: string | null;
  weight_grams: number | null;
  ingredients: string[] | null;
  allergens: string[] | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MerchantOrder {
  id: string;
  order_number: string;
  customer_id: string;
  merchant_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total_amount: number;
  shipping_address_id: string;
  created_at: string;
  updated_at: string;
}

interface MerchantOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  price: number;
  created_at: string;
}

type ProductFormMessage = {
  type: "success" | "error";
  text: string;
};

// Helper converts comma-separated input into a clean string array for storage.
const parseListInput = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

// Shared utility to coerce numeric inputs and gracefully handle blanks.
const parseNumberInput = (value: string) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const nullableString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const calculateOrderRevenue = (order: MerchantOrder, items: MerchantOrderItem[]) =>
  items
    .filter((item) => item.order_id === order.id)
    .reduce((accumulator, item) => accumulator + item.price * item.quantity, 0);

const calculateLineItems = (orders: MerchantOrder[], orderItems: MerchantOrderItem[]) =>
  orders.map((order) => ({
    orderId: order.id,
    createdAt: order.created_at,
    revenue: calculateOrderRevenue(order, orderItems),
    status: order.status,
    totalItems: orderItems.filter((item) => item.order_id === order.id).reduce((sum, item) => sum + item.quantity, 0),
  }));

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [metrics, setMetrics] = useState<MerchantMetrics | null>(null);
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [orderItems, setOrderItems] = useState<MerchantOrderItem[]>([]);
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local form state keeps product creation responsive and validated before hitting Supabase.
  const [newProductName, setNewProductName] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("0");
  const [newProductStock, setNewProductStock] = useState("0");
  const [newProductWeight, setNewProductWeight] = useState("");
  const [newProductIngredients, setNewProductIngredients] = useState("");
  const [newProductAllergens, setNewProductAllergens] = useState("");
  const [newProductImageFiles, setNewProductImageFiles] = useState<File[]>([]);
  const [productFormMessage, setProductFormMessage] = useState<ProductFormMessage | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productFormResetToken, setProductFormResetToken] = useState(0);
  const [productDetailsMode, setProductDetailsMode] = useState<"manual" | "ai" | null>(null);
  const [aiHelperMessage, setAiHelperMessage] = useState<ProductFormMessage | null>(null);
  const [isGeneratingProductDetails, setIsGeneratingProductDetails] = useState(false);
  const [uploadedImageDetails, setUploadedImageDetails] = useState<{
    objectKey: string;
    publicUrl: string;
    productImageId?: string;
  } | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState<ProductFormMessage | null>(null);
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);

  // The cloud function URL is injected via NEXT_PUBLIC_ env to keep secrets out of the client bundle.
  const productAnalyzeEndpoint = process.env.NEXT_PUBLIC_PRODUCT_ANALYZE_ENDPOINT ?? "";

  const isMerchant = profile?.role === "merchant";

  const releasePreviewUrl = (preview: string | null) => {
    if (preview && preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
  };

  // Resets all product creation inputs so merchants can quickly add multiple SKUs.
  const resetProductForm = () => {
    setNewProductName("");
    setNewProductDescription("");
    setNewProductPrice("0");
    setNewProductStock("0");
    setNewProductWeight("");
    setNewProductIngredients("");
    setNewProductAllergens("");
    setNewProductImageFiles([]);
    setProductFormResetToken((token) => token + 1);
    setProductDetailsMode(null);
    setAiHelperMessage(null);
    setIsGeneratingProductDetails(false);
    setUploadedImageDetails(null);
    setIsImageUploading(false);
    setImageUploadMessage(null);
    setLocalImagePreview((current) => {
      releasePreviewUrl(current);
      return null;
    });
  };

  // Captures multiple uploaded file references for the upcoming storage upload.
  const handleProductImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setNewProductImageFiles(files);
    setProductDetailsMode(null);
    setAiHelperMessage(null);
    setIsGeneratingProductDetails(false);
    setUploadedImageDetails(null);
    setImageUploadMessage(null);

    // Maintain a local preview while the images are stored in Supabase Storage.
    setLocalImagePreview((current) => {
      releasePreviewUrl(current);
      return null;
    });
  };

  // Removes a specific image from the selection.
  const handleRemoveImage = (index: number) => {
    setNewProductImageFiles((current) => current.filter((_, i) => i !== index));
  };

  // Ensures the selected image is present in Supabase Storage so downstream AI or product insert work off a stable URL.
  const ensureImageUploaded = async (
    merchantOverride?: MerchantProfile | null,
  ): Promise<{ objectKey: string; publicUrl: string; productImageId?: string }> => {
    if (uploadedImageDetails?.productImageId) {
      return uploadedImageDetails;
    }

    const activeMerchant = merchantOverride ?? merchant;

    if (!activeMerchant) {
      throw new Error("Complete your merchant profile before publishing products.");
    }

    if (newProductImageFiles.length === 0) {
      throw new Error("Attach at least one product image before generating suggestions.");
    }

    // Upload the first image for now (multi-image support can be extended later).
    const primaryFile = newProductImageFiles[0];
    const uniqueId = crypto.randomUUID();
    const fileExtension = primaryFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const objectKey = `${activeMerchant.id}/${uniqueId}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(objectKey, primaryFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: primaryFile.type || "application/octet-stream",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(objectKey);
    const publicUrl = publicUrlData.publicUrl;

    let productImageId = uploadedImageDetails?.productImageId;

    if (!productImageId) {
      const { data: insertedRecord, error: imageInsertError } = await (supabase
        .from("product_images") as any)
        .insert({
          image_urls: [publicUrl],
          primary_image_url: publicUrl,
          storage_path: objectKey,
          storage_bucket: "product-images",
          status: "uploaded",
          source: "merchant-dashboard",
        })
        .select("id")
        .single();

      if (imageInsertError || !insertedRecord?.id) {
        throw imageInsertError ?? new Error("We could not register the uploaded image record.");
      }

      productImageId = insertedRecord.id as string;
    }

    const details = { objectKey, publicUrl, productImageId };
    setUploadedImageDetails(details);
    return details;
  };

  // Calls the product analysis cloud function to draft copy and pricing suggestions from the uploaded image.
  const handleGenerateProductDetails = async () => {
    if (newProductImageFiles.length === 0) {
      setAiHelperMessage({ type: "error", text: "Upload at least one image before generating AI suggestions." });
      return;
    }

    if (!productAnalyzeEndpoint) {
      setAiHelperMessage({ type: "error", text: "AI endpoint is not configured. Contact support to enable this feature." });
      return;
    }

    setIsGeneratingProductDetails(true);
    setAiHelperMessage(null);

    try {
      const { publicUrl, productImageId } = await ensureImageUploaded(merchant);

      const analyzerRequest = productImageId
        ? { product_image_id: productImageId }
        : { image_url: publicUrl };

      const response = await fetch(productAnalyzeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzerRequest),
      });

      if (!response.ok) {
        throw new Error("The AI service could not analyse the product image. Try again later.");
      }

      const responseBody: any = await response.json();
      const analysis = responseBody?.analysis ?? responseBody ?? {};

      if (!analysis) {
        throw new Error("The AI service did not return any suggestions. Please fill the details manually.");
      }

      if (analysis.title) {
        setNewProductName(String(analysis.title));
      }

      if (analysis.description) {
        setNewProductDescription(String(analysis.description));
      }

      if (analysis.price_inr !== undefined && analysis.price_inr !== null) {
        const inferredPrice = Number(analysis.price_inr);
        if (Number.isFinite(inferredPrice) && inferredPrice >= 0) {
          setNewProductPrice(String(inferredPrice));
        }
      }

      setProductDetailsMode("ai");
      setAiHelperMessage({
        type: "success",
        text: "We drafted product copy from your image. Review the suggestions before publishing.",
      });
    } catch (error: any) {
      console.error("AI description generation failed", error);
      setAiHelperMessage({
        type: "error",
        text: error?.message ?? "We could not generate a description. Please try again or fill the fields manually.",
      });
    } finally {
      setIsGeneratingProductDetails(false);
    }
  };

  // Uploads the selected images ahead of revealing the product detail inputs.
  const handleConfirmImageUpload = async () => {
    if (newProductImageFiles.length === 0) {
      setImageUploadMessage({ type: "error", text: "Select at least one image before uploading." });
      return;
    }

    // Check if merchant profile is loaded
    let currentMerchant = merchant;
    if (!currentMerchant) {
      setImageUploadMessage({ 
        type: "error", 
        text: "Merchant profile is still loading. Retrying..." 
      });
      // Trigger a reload of merchant data and wait for it
      currentMerchant = await loadMerchantData();
      
      // Check again after reload
      if (!currentMerchant) {
        setImageUploadMessage({ 
          type: "error", 
          text: "Could not load merchant profile. Please refresh the page and try again." 
        });
        return;
      }
    }

    // Check if profile is complete before allowing upload.
    const missingFields = [];
    if (!profile?.full_name) missingFields.push("name");
    if (!profile?.phone) missingFields.push("phone");
    if (!profile?.address_line1) missingFields.push("address");
    if (!profile?.city) missingFields.push("city");
    if (!profile?.state) missingFields.push("state");
    if (!profile?.postal_code) missingFields.push("postal code");

    if (missingFields.length > 0) {
      setImageUploadMessage({ 
        type: "error", 
        text: `Complete your profile (${missingFields.join(", ")}) before uploading images.` 
      });
      return;
    }

    setIsImageUploading(true);
    setImageUploadMessage(null);

    try {
      const details = await ensureImageUploaded(currentMerchant);
      setImageUploadMessage({ type: "success", text: "Image uploaded successfully. Continue with product details." });
      // Use the freshly uploaded image preview instead of the temporary object URL.
      setLocalImagePreview((current) => {
        releasePreviewUrl(current);
        return details.publicUrl;
      });
    } catch (error: any) {
      console.error("Image upload failed", error);
      setImageUploadMessage({
        type: "error",
        text: error?.message ?? "We could not upload the image. Please try again.",
      });
    } finally {
      setIsImageUploading(false);
    }
  };

  // Publishes a new product by storing the image in Supabase Storage and inserting a row in `products`.
  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!merchant) {
      setProductFormMessage({
        type: "error",
        text: "We could not locate your merchant profile. Refresh and try again.",
      });
      return;
    }

    if (!newProductName.trim()) {
      setProductFormMessage({ type: "error", text: "Product name is required." });
      return;
    }

    const parsedPrice = parseNumberInput(newProductPrice);
    const parsedStock = parseNumberInput(newProductStock);
    const parsedWeight = parseNumberInput(newProductWeight ?? "");

    if (parsedPrice === null || parsedPrice < 0) {
      setProductFormMessage({ type: "error", text: "Enter a valid price greater than or equal to 0." });
      return;
    }

    if (parsedStock === null || parsedStock < 0) {
      setProductFormMessage({ type: "error", text: "Enter a valid stock quantity." });
      return;
    }

    if (newProductImageFiles.length === 0) {
      setProductFormMessage({ type: "error", text: "Attach at least one product image before publishing." });
      return;
    }

    if (!uploadedImageDetails) {
      setProductFormMessage({ type: "error", text: "Upload your image before adding product details." });
      return;
    }

    setIsCreatingProduct(true);
    setProductFormMessage(null);

    try {
      const { publicUrl: productImageUrl } = await ensureImageUploaded(merchant);

      const ingredientsArray = parseListInput(newProductIngredients);
      const allergensArray = parseListInput(newProductAllergens);
      const now = new Date().toISOString();

      const { data: insertedProduct, error: productInsertError } = await (supabase
        .from("products") as any)
        .insert({
          merchant_id: merchant.id,
          name: newProductName.trim(),
          description: nullableString(newProductDescription),
          price: parsedPrice,
          stock_quantity: parsedStock,
          image_url: productImageUrl,
          weight_grams: parsedWeight,
          ingredients: ingredientsArray.length > 0 ? ingredientsArray : null,
          allergens: allergensArray.length > 0 ? allergensArray : null,
          is_available: true,
          is_featured: false,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (productInsertError || !insertedProduct) {
        throw productInsertError ?? new Error("Product creation failed.");
      }

      setProducts((current) => [insertedProduct as MerchantProduct, ...current]);
      resetProductForm();
      setProductFormMessage({ type: "success", text: "Product published successfully." });
    } catch (error: any) {
      console.error("Product creation failed", error);
      setProductFormMessage({
        type: "error",
        text: error?.message ?? "Unexpected error while creating product.",
      });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  useEffect(() => {
    if (!loading && (!user || !isMerchant)) {
      router.replace("/");
    }
  }, [loading, user, isMerchant, router]);

  const loadMerchantData = async (): Promise<MerchantProfile | null> => {
    if (!user || !isMerchant) {
      return null;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      let { data: merchantRow, error: merchantError } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (merchantError) {
        throw merchantError;
      }

      if (!merchantRow) {
        // Auto-create merchant profile if user has merchant role but no merchant record
        const { data: newMerchant, error: createError } = await (supabase
          .from("merchants") as any)
          .insert({
            user_id: user.id,
            business_name: profile?.full_name || null,
            is_verified: false,
          })
          .select("*")
          .single();

        if (createError || !newMerchant) {
          console.error("Error creating merchant profile:", createError);
          setErrorMessage("We could not create your merchant profile. Please try again.");
          setMerchant(null);
          setMetrics(null);
          setProducts([]);
          setOrders([]);
          setOrderItems([]);
          setNotifications([]);
          return null;
        }

        merchantRow = newMerchant;
      }

      const typedMerchant = (merchantRow ?? null) as MerchantProfile | null;
      if (!typedMerchant) {
        setErrorMessage("We could not locate your merchant record. Please try again after completing registration.");
        return null;
      }

      setMerchant(typedMerchant);

      const { data: metricsRow, error: metricsError } = await supabase
        .from("merchant_metrics")
        .select("*")
        .eq("merchant_id", typedMerchant.id)
        .maybeSingle();

      if (metricsError) {
        console.warn("merchant_metrics lookup failed, continuing without metrics", metricsError);
        setMetrics(null);
      } else {
        setMetrics((metricsRow ?? null) as MerchantMetrics | null);
      }

      const { data: productsRows, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("merchant_id", typedMerchant.id)
        .order("created_at", { ascending: false });

      if (productsError) {
        console.warn("products lookup failed, showing empty list", productsError);
        setProducts([]);
      } else {
        const typedProducts = (productsRows ?? []) as MerchantProduct[];
        setProducts(typedProducts);
      }

      const { data: ordersRows, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("merchant_id", typedMerchant.id)
        .order("created_at", { ascending: false })
        .limit(25);

      if (ordersError) {
        console.warn("orders lookup failed, skipping order dashboards", ordersError);
        setOrders([]);
        setOrderItems([]);
      } else {
        const resolvedOrders = (ordersRows ?? []) as MerchantOrder[];
        setOrders(resolvedOrders);

        if (resolvedOrders.length > 0) {
          const orderIds = resolvedOrders.map((order) => order.id);
          const { data: orderItemsData, error: orderItemsError } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds);

          if (orderItemsError) {
            console.warn("order_items lookup failed, skipping line items", orderItemsError);
            setOrderItems([]);
          } else {
            setOrderItems((orderItemsData ?? []) as MerchantOrderItem[]);
          }
        } else {
          setOrderItems([]);
        }
      }

      const { data: notificationsRows, error: notificationsError } = await supabase
        .from("merchant_notifications")
        .select("*")
        .eq("merchant_id", typedMerchant.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (notificationsError) {
        console.warn("merchant_notifications lookup failed, hiding notifications", notificationsError);
        setNotifications([]);
      } else {
        setNotifications((notificationsRows ?? []) as MerchantNotification[]);
      }
    } catch (error) {
      console.error("Error loading merchant dashboard:", error);
      setErrorMessage("We could not load your merchant data. Please try again.");
      return null;
    } finally {
      setIsRefreshing(false);
    }
    
    return merchant;
  };

  useEffect(() => {
    loadMerchantData();
    // The hook should resubscribe when merchant role changes.
  }, [isMerchant, user?.id]);

  const recentOrders = useMemo(() => {
    const lineItems = calculateLineItems(orders, orderItems);

    return lineItems.slice(0, 5);
  }, [orders, orderItems]);

  const totalRevenue = useMemo(() => {
    if (metrics) {
      return metrics.total_sales;
    }

    return calculateLineItems(orders, orderItems).reduce((accumulator, order) => accumulator + order.revenue, 0);
  }, [metrics, orders, orderItems]);

  const totalOrders = useMemo(() => metrics?.total_orders ?? orders.length, [metrics, orders.length]);
  const totalCustomers = useMemo(
    () => metrics?.total_customers ?? new Set(orders.map((order) => order.customer_id)).size,
    [metrics, orders]
  );
  const averageOrderValue = useMemo(() => {
    if (totalOrders === 0) {
      return 0;
    }
    return totalRevenue / totalOrders;
  }, [totalRevenue, totalOrders]);

  const lowInventoryProducts = useMemo(() => products.filter((product) => (product.stock_quantity ?? 0) < 10), [products]);
  const bestSellers = useMemo(() => products.slice(0, 5), [products]);

  if (loading || !user || !isMerchant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f4] text-[#111111]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-10 py-8 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">Preparing merchant dashboard&hellip;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f4] text-[#111111]">
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Store className="h-6 w-6" />
              <h1 className="text-2xl font-semibold">Merchant Command Center</h1>
            </div>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Track orders, manage catalogue, and monitor earnings in real time. Powered by Supabase.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={loadMerchantData}
              className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh data
            </button>
            <Link
              href="/profile#merchant"
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Settings className="h-4 w-4" />
              Merchant settings
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {errorMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#ffd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42323]">
            <AlertCircle className="h-5 w-5" />
            {errorMessage}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#999999]">Net revenue</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalRevenue)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-[#111111]" />
            </div>
            <p className="mt-3 text-xs text-[#6b6b6b]">Total revenue generated across all orders.</p>
          </article>

          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#999999]">Orders</p>
                <p className="mt-2 text-2xl font-semibold">{totalOrders}</p>
              </div>
              <ShoppingBag className="h-5 w-5 text-[#111111]" />
            </div>
            <p className="mt-3 text-xs text-[#6b6b6b]">Recent orders processed under your storefront.</p>
          </article>

          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#999999]">Customers</p>
                <p className="mt-2 text-2xl font-semibold">{totalCustomers}</p>
              </div>
              <Users className="h-5 w-5 text-[#111111]" />
            </div>
            <p className="mt-3 text-xs text-[#6b6b6b]">Unique customers across all orders.</p>
          </article>

          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#999999]">Avg. order value</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(averageOrderValue)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#111111]" />
            </div>
            <p className="mt-3 text-xs text-[#6b6b6b]">Average revenue per order placed in the last 25 orders.</p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent orders</h2>
                <p className="text-sm text-[#6b6b6b]">Latest orders across your catalogue with quick stats.</p>
              </div>
              <Link
                href="#orders"
                className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-3 py-1.5 text-xs font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white"
              >
                View all
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </header>
            <div className="mt-4 overflow-hidden rounded-xl border border-[#f0f0f0]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f9f9f9] text-xs uppercase text-[#6b6b6b]">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Placed</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#6b6b6b]">
                        No orders yet. Launch a promotion to boost traffic.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.orderId} className="border-t border-[#f0f0f0]">
                        <td className="px-4 py-3 text-[#111111]">#{order.orderId.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-[#6b6b6b]">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3 text-[#111111]">{order.totalItems}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[#111111] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#111111]">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#111111]">{formatCurrency(order.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="space-y-4">
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Payout status</h2>
                <Percent className="h-5 w-5 text-[#111111]" />
              </div>
              <p className="mt-1 text-sm text-[#6b6b6b]">Next payout arrives in 2 business days.</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Awaiting settlement</span>
                    <span className="font-semibold text-[#111111]">{formatCurrency(totalRevenue * 0.7)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6b6b6b]">70% of recent revenue available for payout.</p>
                </div>
                <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Processing</span>
                    <span className="font-semibold text-[#111111]">{formatCurrency(totalRevenue * 0.2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6b6b6b]">20% currently under review.</p>
                </div>
                <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Disbursed</span>
                    <span className="font-semibold text-[#111111]">{formatCurrency(totalRevenue * 0.1)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6b6b6b]">10% paid out this week.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Inventory health</h2>
                <Box className="h-5 w-5 text-[#111111]" />
              </div>
              {lowInventoryProducts.length === 0 ? (
                <p className="mt-4 text-sm text-[#6b6b6b]">
                  Stock levels look great. We will alert you when items dip below thresholds.
                </p>
              ) : (
                <ul className="mt-4 space-y-3 text-sm">
                  {lowInventoryProducts.map((product) => (
                    <li key={product.id} className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                      <div>
                        <p className="font-semibold text-[#111111]">{product.name}</p>
                        <p className="text-xs text-[#6b6b6b]">
                          {product.stock_quantity} units remaining · Updated {formatDate(product.updated_at)}
                        </p>
                      </div>
                      <Link
                        href={`/merchant/products/${product.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111] transition hover:opacity-80"
                      >
                        Restock
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Catalogue performance</h2>
                <p className="text-sm text-[#6b6b6b]">Stay on top of best sellers and slow movers.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                  <Filter className="h-3.5 w-3.5" /> Filter
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              </div>
            </header>
            <div className="mt-4 overflow-hidden rounded-xl border border-[#f0f0f0]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f9f9f9] text-xs uppercase text-[#6b6b6b]">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Inventory</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#6b6b6b]">
                        No products yet. Add your first SKU to go live.
                      </td>
                    </tr>
                  ) : (
                    bestSellers.map((product) => (
                      <tr key={product.id} className="border-t border-[#f0f0f0]">
                        <td className="px-4 py-3 text-[#111111]">{product.name}</td>
                        <td className="px-4 py-3 text-[#111111]">{formatCurrency(product.price)}</td>
                        <td className="px-4 py-3 text-[#111111]">{product.stock_quantity}</td>
                        <td className="px-4 py-3 text-[#6b6b6b]">{formatDate(product.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/merchant/products/${product.id}`}
                              className="inline-flex items-center gap-1 rounded-full border border-[#111111] px-3 py-1 text-xs font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white"
                            >
                              Edit
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                            <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                              <Megaphone className="h-3.5 w-3.5" /> Promote
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="space-y-4">
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Alerts</h2>
                <Bell className="h-5 w-5 text-[#111111]" />
              </div>
              <div className="mt-4 space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-sm text-[#6b6b6b]">All quiet for now. New alerts will appear here.</p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#111111]">{notification.title}</p>
                          <p className="mt-1 text-xs text-[#6b6b6b]">{notification.message}</p>
                        </div>
                        <span className="rounded-full border border-[#111111] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#111111]">
                          {notification.category}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#6b6b6b]">{formatDate(notification.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tasks</h2>
                <CheckCircle className="h-5 w-5 text-[#111111]" />
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                  <div>
                    <p className="font-semibold text-[#111111]">Upload GST documents</p>
                    <p className="text-xs text-[#6b6b6b]">Required for payouts above ₹50k</p>
                  </div>
                  <button className="inline-flex items-center gap-1 rounded-full border border-[#111111] px-3 py-1 text-xs font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white">
                    Upload
                  </button>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                  <div>
                    <p className="font-semibold text-[#111111]">Schedule product shoot</p>
                    <p className="text-xs text-[#6b6b6b]">Boost conversions by 20% with professional imagery</p>
                  </div>
                  <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                    Book slot
                  </button>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                  <div>
                    <p className="font-semibold text-[#111111]">Launch festive combo</p>
                    <p className="text-xs text-[#6b6b6b]">Curated bundles outperform solo pints by 35%</p>
                  </div>
                  <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                    Build combo
                  </button>
                </li>
              </ul>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <header className="space-y-2">
            <h2 className="text-lg font-semibold">Create a product</h2>
            <p className="text-sm text-[#6b6b6b]">
              Upload imagery, craft descriptions, and publish listings without leaving the dashboard.
            </p>
          </header>
          <form className="mt-6 grid gap-6 lg:grid-cols-[1.6fr,1fr]" onSubmit={handleCreateProduct}>
            <div className="space-y-4">
              {!uploadedImageDetails && (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#dcdcdc] bg-[#fdfdfd] p-6 text-center text-sm text-[#6b6b6b]">
                  Upload a product image to get started.
                </div>
              )}

              {uploadedImageDetails && productDetailsMode === null && (
                <div className="rounded-xl border border-[#f0f0f0] bg-[#fcfcfc] p-6">
                  <p className="text-sm font-semibold text-[#111111]">How would you like to complete the details?</p>
                  <p className="mt-1 text-xs text-[#6b6b6b]">
                    Generate copy with AI or continue entering the information yourself.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleGenerateProductDetails}
                      className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                      disabled={isGeneratingProductDetails}
                    >
                      {isGeneratingProductDetails && <Loader2 className="h-4 w-4 animate-spin" />}
                      Generate with AI
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProductDetailsMode("manual");
                        setAiHelperMessage(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#dcdcdc] bg-white px-5 py-2.5 text-sm font-semibold text-[#444444] transition hover:border-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                      disabled={isGeneratingProductDetails}
                    >
                      Enter manually
                    </button>
                  </div>
                  {aiHelperMessage && (
                    <p
                      className={`mt-3 text-xs ${
                        aiHelperMessage.type === "success" ? "text-[#216c27]" : "text-[#b42323]"
                      }`}
                    >
                      {aiHelperMessage.text}
                    </p>
                  )}
                </div>
              )}

              {uploadedImageDetails && productDetailsMode !== null && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-[#111111]" htmlFor="product-name">
                      Product name
                    </label>
                    <input
                      id="product-name"
                      value={newProductName}
                      onChange={(event) => setNewProductName(event.target.value)}
                      placeholder="E.g. Alphonso Mango Sorbet"
                      className="mt-1 w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                      disabled={isCreatingProduct}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#111111]" htmlFor="product-description">
                      Description
                    </label>
                    <textarea
                      id="product-description"
                      value={newProductDescription}
                      onChange={(event) => setNewProductDescription(event.target.value)}
                      placeholder="Share flavour notes, sourcing stories, or serving ideas."
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                      disabled={isCreatingProduct}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-[#111111]">Price (₹)</span>
                      <input
                        value={newProductPrice}
                        onChange={(event) => setNewProductPrice(event.target.value.replace(/[^0-9.]/g, ""))}
                        className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                        disabled={isCreatingProduct}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-[#111111]">Inventory</span>
                      <input
                        value={newProductStock}
                        onChange={(event) => setNewProductStock(event.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                        disabled={isCreatingProduct}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-[#111111]">Weight (grams)</span>
                      <input
                        value={newProductWeight}
                        onChange={(event) => setNewProductWeight(event.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                        disabled={isCreatingProduct}
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-[#111111]">Ingredients</span>
                      <input
                        value={newProductIngredients}
                        onChange={(event) => setNewProductIngredients(event.target.value)}
                        placeholder="Comma-separated list"
                        className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                        disabled={isCreatingProduct}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-[#111111]">Allergens</span>
                      <input
                        value={newProductAllergens}
                        onChange={(event) => setNewProductAllergens(event.target.value)}
                        placeholder="Comma-separated list"
                        className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                        disabled={isCreatingProduct}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
            <aside className="flex flex-col justify-between gap-4 rounded-2xl border border-[#f0f0f0] bg-[#fafafa] p-5 text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-white">
                    <Camera className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">Product image</p>
                    <p className="text-xs text-[#6b6b6b]">JPEG, PNG, or WebP up to 5MB.</p>
                  </div>
                </div>
                <input
                  key={productFormResetToken}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProductImageChange}
                  className="w-full cursor-pointer rounded-xl border border-dashed border-[#dcdcdc] bg-white px-4 py-10 text-center text-sm text-[#6b6b6b] transition hover:border-[#111111]"
                  disabled={isCreatingProduct}
                />
                {newProductImageFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {newProductImageFiles.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
                          <img src={previewUrl} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleConfirmImageUpload}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  disabled={isImageUploading || isCreatingProduct || newProductImageFiles.length === 0 || !merchant}
                >
                  {isImageUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {!merchant ? "Loading merchant profile..." : "Upload image"}
                </button>
                {imageUploadMessage && (
                  <div
                    className={`text-xs ${
                      imageUploadMessage.type === "success" ? "text-[#216c27]" : "text-[#b42323]"
                    }`}
                  >
                    {imageUploadMessage.text}
                    {imageUploadMessage.type === "error" && imageUploadMessage.text.includes("Complete your profile") && (
                      <Link href="/profile" className="ml-1 font-semibold underline hover:no-underline">
                        Go to Profile
                      </Link>
                    )}
                  </div>
                )}
                <p className="text-xs text-[#6b6b6b]">
                  Images are stored securely in Supabase Storage and served via public URLs for storefront consumption.
                </p>
              </div>
              {productFormMessage && (
                <div
                  className={`rounded-xl border px-4 py-3 text-xs ${
                    productFormMessage.type === "success"
                      ? "border-[#d6f5d8] bg-[#f2fff3] text-[#216c27]"
                      : "border-[#ffd7d7] bg-[#fff5f5] text-[#b42323]"
                  }`}
                >
                  {productFormMessage.text}
                </div>
              )}
              <button
                type="submit"
                disabled={isCreatingProduct}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {isCreatingProduct && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4" />
                Publish product
              </button>
            </aside>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Growth opportunities</h2>
                <p className="text-sm text-[#6b6b6b]">Data-backed recommendations tailored to your store.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-[#111111]" />
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <p className="font-semibold text-[#111111]">Introduce same-day delivery</p>
                <p className="text-xs text-[#6b6b6b]">Local competition has seen a 24% lift in orders.</p>
              </li>
              <li className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <p className="font-semibold text-[#111111]">Bundle popular pints into combos</p>
                <p className="text-xs text-[#6b6b6b]">Combos convert 1.8x better than single SKUs.</p>
              </li>
              <li className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <p className="font-semibold text-[#111111]">Enable WhatsApp notifications</p>
                <p className="text-xs text-[#6b6b6b]">Stay close to customers with post-order updates.</p>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Compliance center</h2>
                <p className="text-sm text-[#6b6b6b]">Keep documents updated to ensure smooth payouts.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-[#111111]" />
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111111]">FSSAI licence</p>
                  <p className="text-xs text-[#6b6b6b]">Expires in 45 days. Renew to avoid listing suspension.</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                  Renew
                </button>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111111]">GST registration</p>
                  <p className="text-xs text-[#6b6b6b]">View uploaded documents and status.</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                  View
                </button>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111111]">Bank verification</p>
                  <p className="text-xs text-[#6b6b6b]">Add beneficiary details to unlock payouts.</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#444444] transition hover:bg-[#f3f3f3]">
                  Complete
                </button>
              </li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

// Placeholder icon component to avoid using additional imports for camera icons.
function CameraIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
