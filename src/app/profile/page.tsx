"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  BookOpen,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  History,
  Home,
  Inbox,
  Loader2,
  LogOut,
  Percent,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Star,
  Store,
  Wallet,
  Heart,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/guest-cart";
import type { Database } from "@/lib/database.types";

// Section identifiers keep navigation and conditional rendering in sync.
type SectionKey =
  | "overview"
  | "orders"
  | "payments"
  | "giftCards"
  | "cashback"
  | "coupons"
  | "reviews"
  | "wishlist"
  | "notifications"
  | "faqs"
  | "merchant"
  | "logout";

// Order summaries hydrate the history rail without over-fetching nested data.
type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  merchantName: string | null;
};

// Local persistence keeps lightweight collections per user without new tables.
type StoredPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  nickname: string;
};

type StoredGiftCard = {
  id: string;
  code: string;
  balance: number;
  nickname: string;
};

type StoredCoupon = {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
};

type StoredNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type StoredReview = {
  id: string;
  productName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

// Utility for safely touching localStorage in a browser-only environment.
const withLocalStorage = <T,>(fn: (storage: Storage) => T, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    return fn(window.localStorage);
  } catch (error) {
    console.warn("Local storage access failed", error);
    return fallback;
  }
};

// Hook to persist per-user collections; ensures clean resets on logout.
function usePersistentCollection<T>(userId: string | null, key: string, initialValue: T[]) {
  const storageKey = userId ? `frostcart:${userId}:${key}` : null;
  const initialRef = useRef(initialValue);
  const [items, setItems] = useState<T[]>(() => initialRef.current);

  useEffect(() => {
    initialRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    if (!storageKey) {
      setItems(initialRef.current);
      return;
    }

    const stored = withLocalStorage((storage) => storage.getItem(storageKey), null);
    if (stored) {
      setItems(JSON.parse(stored) as T[]);
    } else {
      setItems(initialRef.current);
    }
  }, [storageKey]);

  const persist = (next: T[]) => {
    setItems(next);
    if (!storageKey) {
      return;
    }
    withLocalStorage((storage) => storage.setItem(storageKey, JSON.stringify(next)), undefined);
  };

  return { items, persist };
}

// Shared date formatter to keep copy consistent without extra dependencies.
const formatDateTime = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-IN", options ?? { dateStyle: "medium", timeStyle: "short" }).format(date);
};

// Helper to convert form strings into nullable payload values.
const optionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type MerchantInsert = Database["public"]["Tables"]["merchants"]["Insert"];

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, loading, signOut, updateProfile, refreshProfile } = useAuth();

  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  // Profile editing form captures mutable demographic details.
  const [fullName, setFullName] = useState<string>(profile?.full_name ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [phone, setPhone] = useState<string>(profile?.phone ?? "");
  const [addressLine1, setAddressLine1] = useState<string>(profile?.address_line1 ?? "");
  const [stateRegion, setStateRegion] = useState<string>(profile?.state ?? "");
  const [postalCode, setPostalCode] = useState<string>(profile?.postal_code ?? "");
  const [city, setCity] = useState<string>(profile?.city ?? "");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Server-backed collections are hydrated into local storage-backed rails to keep UI responsive between sessions.
  const {
    items: paymentMethods,
    persist: persistPaymentMethods
  } = usePersistentCollection<StoredPaymentMethod>(user?.id ?? null, "payment-methods", []);
  const {
    items: giftCards,
    persist: persistGiftCards
  } = usePersistentCollection<StoredGiftCard>(user?.id ?? null, "gift-cards", []);
  const {
    items: coupons,
    persist: persistCoupons
  } = usePersistentCollection<StoredCoupon>(user?.id ?? null, "coupons", []);
  const {
    items: notifications,
    persist: persistNotifications
  } = usePersistentCollection<StoredNotification>(user?.id ?? null, "notifications", []);
  const {
    items: reviews,
    persist: persistReviews
  } = usePersistentCollection<StoredReview>(user?.id ?? null, "reviews", []);

  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [newPaymentBrand, setNewPaymentBrand] = useState("Visa");
  const [newPaymentNickname, setNewPaymentNickname] = useState("");
  const [newPaymentLast4, setNewPaymentLast4] = useState("");
  const [newGiftCardCode, setNewGiftCardCode] = useState("");
  const [newGiftCardNickname, setNewGiftCardNickname] = useState("");
  const [newGiftCardBalance, setNewGiftCardBalance] = useState("100");
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDescription, setNewCouponDescription] = useState("");
  const [newReviewProduct, setNewReviewProduct] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState("");
  const [merchantStatus, setMerchantStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [merchantMessage, setMerchantMessage] = useState<string | null>(null);

  // Ensure that once the Supabase profile loads (or refreshes) we hydrate the form controls with persisted values.
  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setGender(profile?.gender ?? "");
    setPhone(profile?.phone ?? "");
    setAddressLine1(profile?.address_line1 ?? "");
    setStateRegion(profile?.state ?? "");
    setPostalCode(profile?.postal_code ?? "");
    setCity(profile?.city ?? "");
  }, [profile]);

  // Redirect unauthenticated visitors to the auth flow.
  useEffect(() => {
    if (!user) {
      router.push("/auth?mode=signin");
      return;
    }
  }, [user, router]);

  // Fetch orders including item counts and merchant display names.
  useEffect(() => {
    if (!user) {
      // Early exit ensures we only fetch order history once an authenticated user is present.
      // This prevents unnecessary requests when the user is not signed in.
      return;
    }

    const fetchOrders = async () => {
      setOrdersLoading(true);
      setOrdersError(null);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `id, order_number, status, total_amount, created_at, order_items(count), merchants:merchant_id(business_name)`
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading orders", error);
        setOrdersError("Unable to load order history right now. Please try again later.");
        setOrders([]);
      } else {
        const formatted = (data ?? []).map((order: any) => ({
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount: Number(order.total_amount ?? 0),
          createdAt: order.created_at,
          itemCount: Array.isArray(order.order_items) ? order.order_items.length : 0,
          merchantName: order.merchants?.business_name ?? null,
        }));
        setOrders(formatted);
      }

      setOrdersLoading(false);
    };

    fetchOrders();
  }, [user]);

  // Fetch wishlist entries with product context.
  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchWishlist = async () => {
      setWishlistLoading(true);
      const { data, error } = await supabase
        .from("wishlists")
        .select(`id, product_id, created_at, products:product_id(name, price, image_url)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading wishlist", error);
        setWishlistItems([]);
      } else {
        const formatted = (data ?? []).map((entry: any) => ({
          id: entry.id,
          productId: entry.product_id,
          productName: entry.products?.name ?? "Product",
          price: Number(entry.products?.price ?? 0),
          imageUrl: entry.products?.image_url ?? null,
          addedAt: entry.created_at,
        }));
        setWishlistItems(formatted);
      }

      setWishlistLoading(false);
    };

    fetchWishlist();
  }, [user]);

  // Ensure the notification rail is pre-populated with a welcome alert per user.
  useEffect(() => {
    if (!user || notifications.length > 0) {
      return;
    }

    const welcomeNotification: StoredNotification = {
      id: uuid(),
      title: "Welcome to your FrostCart account",
      message: "Track orders, manage rewards, and unlock merchant tools from one dashboard.",
      createdAt: new Date().toISOString(),
      read: false,
    };

    persistNotifications([welcomeNotification]);
  }, [user, notifications.length, persistNotifications]);

  // Derived cashback pulls 2% from delivered orders as a simple rewards model.
  const cashbackEarned = useMemo(() => {
    return orders
      .filter((order) => order.status === "delivered")
      .reduce((total, order) => total + order.totalAmount * 0.02, 0);
  }, [orders]);

  const outstandingCashback = useMemo(() => cashbackEarned.toFixed(2), [cashbackEarned]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f4] text-[#111111]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-10 py-8 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">Loading your account&hellip;</p>
        </div>
      </div>
    );
  }

  // Navigation configuration keeps the sidebar declarative.
  const sections: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Account overview", icon: Home },
    { key: "orders", label: "Order history", icon: History },
    { key: "payments", label: "Payment methods", icon: CreditCard },
    { key: "giftCards", label: "Gift cards", icon: Gift },
    { key: "cashback", label: "Cashback", icon: PiggyBank },
    { key: "coupons", label: "Coupons", icon: Percent },
    { key: "reviews", label: "Ratings & reviews", icon: Star },
    { key: "wishlist", label: "My wishlist", icon: Heart },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "faqs", label: "FAQs", icon: HelpCircle },
    { key: "merchant", label: "Register as merchant", icon: Store },
    { key: "logout", label: "Logout", icon: LogOut },
  ];

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMessage(null);

    const { error } = await updateProfile({
      full_name: optionalString(fullName),
      gender: optionalString(gender),
      phone: optionalString(phone),
      address_line1: optionalString(addressLine1),
      city: optionalString(city),
      state: optionalString(stateRegion),
      postal_code: optionalString(postalCode),
    });

    if (error) {
      console.error("Error updating profile", error);
      setProfileMessage("We could not save your information. Please try again.");
    } else {
      setProfileMessage("Profile updated successfully.");
      await refreshProfile();
    }

    setProfileSaving(false);
  };

  const handleAddPaymentMethod = () => {
    if (!newPaymentLast4 || newPaymentLast4.length !== 4) {
      return;
    }
    const method: StoredPaymentMethod = {
      id: uuid(),
      brand: newPaymentBrand,
      last4: newPaymentLast4,
      nickname: newPaymentNickname || `${newPaymentBrand} •••• ${newPaymentLast4}`,
    };
    persistPaymentMethods([method, ...paymentMethods]);
    setNewPaymentNickname("");
    setNewPaymentBrand("Visa");
    setNewPaymentLast4("");
  };

  const handleAddGiftCard = () => {
    if (!newGiftCardCode) {
      return;
    }
    const giftCard: StoredGiftCard = {
      id: uuid(),
      code: newGiftCardCode.toUpperCase(),
      balance: Number(newGiftCardBalance) || 0,
      nickname: newGiftCardNickname || `Gift card ${newGiftCardCode.toUpperCase()}`,
    };
    persistGiftCards([giftCard, ...giftCards]);
    setNewGiftCardCode("");
    setNewGiftCardNickname("");
    setNewGiftCardBalance("100");
  };

  const handleAddCoupon = () => {
    if (!newCouponCode) {
      return;
    }
    const coupon: StoredCoupon = {
      id: uuid(),
      code: newCouponCode.toUpperCase(),
      description: newCouponDescription || "Personal coupon",
      isActive: true,
    };
    persistCoupons([coupon, ...coupons]);
    setNewCouponCode("");
    setNewCouponDescription("");
  };

  const handleToggleCoupon = (id: string) => {
    const updated = coupons.map((coupon) =>
      coupon.id === id ? { ...coupon, isActive: !coupon.isActive } : coupon
    );
    persistCoupons(updated);
  };

  const handleAddReview = () => {
    if (!newReviewProduct || !newReviewComment) {
      return;
    }
    const review: StoredReview = {
      id: uuid(),
      productName: newReviewProduct,
      rating: newReviewRating,
      comment: newReviewComment,
      createdAt: new Date().toISOString(),
    };
    persistReviews([review, ...reviews]);
    setNewReviewProduct("");
    setNewReviewRating(5);
    setNewReviewComment("");
  };

  const handleMarkNotification = (id: string, read: boolean) => {
    const updated = notifications.map((notification) =>
      notification.id === id ? { ...notification, read } : notification
    );
    persistNotifications(updated);
  };

  const handleRegisterMerchant = async () => {
    if (!user) {
      return;
    }

    setMerchantStatus("loading");
    setMerchantMessage(null);

    const { error: roleError } = await updateProfile({ role: "merchant" });

    if (roleError) {
      console.error("Error updating user role", roleError);
      setMerchantStatus("error");
      setMerchantMessage("Could not update your account role. Please try again.");
      return;
    }

    const merchantPayload: MerchantInsert = { user_id: user.id, is_verified: false };
    const { error: merchantError } = await (supabase
      .from("merchants") as any)
      .upsert([merchantPayload], { onConflict: "user_id" });

    if (merchantError) {
      console.error("Error ensuring merchant record", merchantError);
      setMerchantStatus("error");
      setMerchantMessage("Merchant onboarding failed. Please contact support.");
      return;
    }

    await refreshProfile();
    setMerchantStatus("success");
    setMerchantMessage("You’re all set as a FrostCart merchant. Redirecting to your dashboard&hellip;");
    setTimeout(() => router.push("/merchant"), 800);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#111111]">Personal information</h2>
                  <p className="text-sm text-[#6b6b6b]">
                    Update your details so merchants can reach you for deliveries and support.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 text-[#111111]" />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Full name</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Gender</span>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  >
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Phone number</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Include country code"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Email</span>
                  <input
                    value={user.email ?? ""}
                    disabled
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f0f0f0] px-4 py-2.5 text-sm text-[#888888]"
                  />
                </label>
                <label className="md:col-span-2 space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Primary address</span>
                  <input
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    placeholder="Street and house number"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">City</span>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="City"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">State</span>
                  <input
                    value={stateRegion}
                    onChange={(event) => setStateRegion(event.target.value)}
                    placeholder="State / province"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#444444]">Postal code</span>
                  <input
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    placeholder="Postal code"
                    className="w-full rounded-xl border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-2.5 text-sm focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                  />
                </label>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save details
                </button>
                {profileMessage && <span className="text-sm text-[#444444]">{profileMessage}</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#111111]">Support & FAQs</h3>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                Need help with delivery slots, refunds, or storing desserts? Browse our FAQs or reach out directly.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {["How do I track my order?", "How can I update my subscription?", "Where can I manage saved addresses?", "What is the return policy for melted items?"].map((question) => (
                  <Link
                    key={question}
                    href="#faqs"
                    onClick={() => setActiveSection("faqs")}
                    className="group flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#f9f9f9] px-4 py-3 text-sm font-medium text-[#444444] transition hover:border-[#111111] hover:bg-white"
                  >
                    <span>{question}</span>
                    <ChevronRight className="h-4 w-4 text-[#888888] transition group-hover:text-[#111111]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      case "orders":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Order history</h2>
                <p className="text-sm text-[#6b6b6b]">Track past purchases and view delivery status in real time.</p>
              </div>
              <Receipt className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              {ordersLoading ? (
                <div className="flex items-center gap-3 text-sm text-[#6b6b6b]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading orders&hellip;
                </div>
              ) : ordersError ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#ffd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42323]">
                  <AlertCircle className="h-5 w-5" />
                  {ordersError}
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#6b6b6b]">
                  <Inbox className="h-6 w-6" />
                  No orders yet. Explore seasonal picks to start your collection.
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Browse treats
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  {orders.map((order) => (
                    <li key={order.id} className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">Order {order.orderNumber}</p>
                          <p className="text-xs text-[#6b6b6b]">
                            {formatDateTime(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                          </p>
                          {order.merchantName && (
                            <p className="text-xs text-[#6b6b6b]">Merchant: {order.merchantName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-[#111111] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#111111]">
                            {order.status}
                          </span>
                          <span className="text-sm font-semibold text-[#111111]">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case "payments":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Payment methods</h2>
                <p className="text-sm text-[#6b6b6b]">Securely store cards used for express checkout.</p>
              </div>
              <Wallet className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                  <h3 className="text-sm font-semibold text-[#111111]">Add a card</h3>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Issuer</span>
                    <select
                      value={newPaymentBrand}
                      onChange={(event) => setNewPaymentBrand(event.target.value)}
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    >
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Amex">American Express</option>
                      <option value="RuPay">RuPay</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Nickname</span>
                    <input
                      value={newPaymentNickname}
                      onChange={(event) => setNewPaymentNickname(event.target.value)}
                      placeholder="E.g. Personal card"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Last 4 digits</span>
                    <input
                      value={newPaymentLast4}
                      onChange={(event) => setNewPaymentLast4(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      placeholder="1234"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={handleAddPaymentMethod}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
                  >
                    Save card
                  </button>
                </div>
                <div className="space-y-3">
                  {paymentMethods.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dcdcdc] bg-[#f9f9f9] p-6 text-sm text-[#6b6b6b]">
                      <CreditCard className="h-6 w-6" />
                      No saved cards yet. Add your first card for one-tap checkout.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {paymentMethods.map((method) => (
                        <li key={method.id} className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[#111111]">{method.nickname}</p>
                            <p className="text-xs text-[#6b6b6b]">{method.brand} •••• {method.last4}</p>
                          </div>
                          <button
                            onClick={() =>
                              persistPaymentMethods(paymentMethods.filter((candidate) => candidate.id !== method.id))
                            }
                            className="text-xs font-semibold text-[#b42323] transition hover:text-[#7e1c1c]"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case "giftCards":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Gift cards</h2>
                <p className="text-sm text-[#6b6b6b]">Track balances from gifting sprees and seasonal campaigns.</p>
              </div>
              <Gift className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                  <h3 className="text-sm font-semibold text-[#111111]">Add a gift card</h3>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Code</span>
                    <input
                      value={newGiftCardCode}
                      onChange={(event) => setNewGiftCardCode(event.target.value.toUpperCase())}
                      placeholder="E.g. FROST100"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Nickname</span>
                    <input
                      value={newGiftCardNickname}
                      onChange={(event) => setNewGiftCardNickname(event.target.value)}
                      placeholder="Birthday surprise"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Balance (₹)</span>
                    <input
                      value={newGiftCardBalance}
                      onChange={(event) => setNewGiftCardBalance(event.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="100"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={handleAddGiftCard}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
                  >
                    Save gift card
                  </button>
                </div>
                <div className="space-y-3">
                  {giftCards.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dcdcdc] bg-[#f9f9f9] p-6 text-sm text-[#6b6b6b]">
                      <Gift className="h-6 w-6" />
                      No gift cards saved yet. Add codes to keep an eye on balances.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {giftCards.map((card) => (
                        <li key={card.id} className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[#111111]">{card.nickname}</p>
                            <p className="text-xs text-[#6b6b6b]">Code: {card.code}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-[#111111]">{formatCurrency(card.balance)}</span>
                            <button
                              onClick={() =>
                                persistGiftCards(giftCards.filter((candidate) => candidate.id !== card.id))
                              }
                              className="text-xs font-semibold text-[#b42323] transition hover:text-[#7e1c1c]"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case "cashback":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Cashback wallet</h2>
                <p className="text-sm text-[#6b6b6b]">Earn 2% on delivered orders. Redeem anytime.</p>
              </div>
              <PiggyBank className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#444444]">Available cashback</p>
                  <p className="mt-1 text-3xl font-semibold text-[#111111]">{formatCurrency(Number(outstandingCashback))}</p>
                  <p className="text-xs text-[#6b6b6b]">Based on delivered orders only.</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                  Redeem to cart
                </button>
              </div>
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-[#111111]">Recent contributions</h3>
                <ul className="space-y-2">
                  {orders
                    .filter((order) => order.status === "delivered")
                    .slice(0, 4)
                    .map((order) => (
                      <li key={order.id} className="flex items-center justify-between rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-xs text-[#444444]">
                        <span>
                          Order {order.orderNumber} · {formatDateTime(order.createdAt, { month: "short", day: "numeric" })}
                        </span>
                        <span>+{formatCurrency(order.totalAmount * 0.02)}</span>
                      </li>
                    ))}
                  {orders.filter((order) => order.status === "delivered").length === 0 && (
                    <li className="rounded-lg border border-dashed border-[#dcdcdc] px-3 py-2 text-xs text-[#6b6b6b]">
                      Complete a delivery to start earning cashback.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        );
      case "coupons":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Coupons</h2>
                <p className="text-sm text-[#6b6b6b]">Store marketplace and promo partner codes.</p>
              </div>
              <Percent className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                  <h3 className="text-sm font-semibold text-[#111111]">Add a coupon</h3>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Code</span>
                    <input
                      value={newCouponCode}
                      onChange={(event) => setNewCouponCode(event.target.value.toUpperCase())}
                      placeholder="FROST25"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Description</span>
                    <input
                      value={newCouponDescription}
                      onChange={(event) => setNewCouponDescription(event.target.value)}
                      placeholder="25% off gelato"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={handleAddCoupon}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
                  >
                    Save coupon
                  </button>
                </div>
                <div className="space-y-3">
                  {coupons.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dcdcdc] bg-[#f9f9f9] p-6 text-sm text-[#6b6b6b]">
                      <Percent className="h-6 w-6" />
                      Add a coupon code to keep it handy at checkout.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {coupons.map((coupon) => (
                        <li key={coupon.id} className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[#111111]">{coupon.code}</p>
                            <p className="text-xs text-[#6b6b6b]">{coupon.description}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleCoupon(coupon.id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                                coupon.isActive
                                  ? "bg-[#111111] text-white hover:opacity-90"
                                  : "border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white"
                              }`}
                            >
                              {coupon.isActive ? "Active" : "Inactive"}
                            </button>
                            <button
                              onClick={() => persistCoupons(coupons.filter((candidate) => candidate.id !== coupon.id))}
                              className="text-xs font-semibold text-[#b42323] transition hover:text-[#7e1c1c]"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case "reviews":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Ratings & reviews</h2>
                <p className="text-sm text-[#6b6b6b]">Capture thoughts on limited editions and repeat favorites.</p>
              </div>
              <Star className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                  <h3 className="text-sm font-semibold text-[#111111]">Add a review</h3>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Product name</span>
                    <input
                      value={newReviewProduct}
                      onChange={(event) => setNewReviewProduct(event.target.value)}
                      placeholder="Nitro Espresso Swirl"
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Rating</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={newReviewRating}
                      onChange={(event) => setNewReviewRating(Number(event.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-[#6b6b6b]">{newReviewRating} / 5</span>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-[#444444]">Comment</span>
                    <textarea
                      value={newReviewComment}
                      onChange={(event) => setNewReviewComment(event.target.value)}
                      rows={4}
                      placeholder="Describe the texture, sweetness, and how quickly it melts."
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:border-[#111111] focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={handleAddReview}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
                  >
                    Submit review
                  </button>
                </div>
                <div className="space-y-3">
                  {reviews.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dcdcdc] bg-[#f9f9f9] p-6 text-sm text-[#6b6b6b]">
                      <Star className="h-6 w-6" />
                      Review your first dessert to help others choose the best scoops.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {reviews.map((review) => (
                        <li key={review.id} className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                          <div className="flex items-center justify-between text-sm text-[#111111]">
                            <span className="font-semibold">{review.productName}</span>
                            <span>
                              {Array.from({ length: review.rating }).map((_, index) => (
                                <Star key={index} className="inline h-4 w-4 fill-[#ffc53d] text-[#ffc53d]" />
                              ))}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#444444]">{review.comment}</p>
                          <p className="mt-2 text-xs text-[#6b6b6b]">
                            {formatDateTime(review.createdAt)}
                          </p>
                          <button
                            onClick={() =>
                              persistReviews(reviews.filter((candidate) => candidate.id !== review.id))
                            }
                            className="mt-3 text-xs font-semibold text-[#b42323] transition hover:text-[#7e1c1c]"
                          >
                            Delete review
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case "wishlist":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Wishlist</h2>
                <p className="text-sm text-[#6b6b6b]">Favourite flavours synced across devices.</p>
              </div>
              <Heart className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              {wishlistLoading ? (
                <div className="flex items-center gap-3 text-sm text-[#6b6b6b]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading wishlist&hellip;
                </div>
              ) : wishlistItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#6b6b6b]">
                  <Heart className="h-6 w-6" />
                  No saved items yet. Tap the heart icon on any product to store it here.
                  <Link
                    href="/#featured"
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Explore featured
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {wishlistItems.map((item) => (
                    <li key={item.id} className="flex gap-4 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[#dcdcdc] bg-white text-xs text-[#6b6b6b]">
                          No image
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{item.productName}</p>
                          <p className="text-xs text-[#6b6b6b]">{formatDateTime(item.addedAt, { month: "short", day: "numeric" })}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#111111]">{formatCurrency(item.price)}</span>
                          <button
                            onClick={async () => {
                              await supabase.from("wishlists").delete().eq("id", item.id);
                              setWishlistItems(wishlistItems.filter((candidate) => candidate.id !== item.id));
                            }}
                            className="text-xs font-semibold text-[#b42323] transition hover:text-[#7e1c1c]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Notifications</h2>
                <p className="text-sm text-[#6b6b6b]">Mark updates as read or revisit them later.</p>
              </div>
              <Bell className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#6b6b6b]">
                  <Bell className="h-6 w-6" />
                  You are up to date. New alerts will appear here.
                </div>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`rounded-xl border px-4 py-3 text-sm transition ${
                        notification.read
                          ? "border-[#f0f0f0] bg-[#fafafa] text-[#6b6b6b]"
                          : "border-[#111111] bg-white text-[#111111]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{notification.title}</p>
                          <p className="mt-1 text-xs">{notification.message}</p>
                          <p className="mt-2 text-xs text-[#6b6b6b]">
                            {formatDateTime(notification.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleMarkNotification(notification.id, !notification.read)}
                          className="text-xs font-semibold text-[#111111] transition hover:opacity-80"
                        >
                          {notification.read ? "Mark unread" : "Mark read"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      case "faqs":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Frequently asked questions</h2>
                <p className="text-sm text-[#6b6b6b]">Quick answers to keep your freezer stocked without friction.</p>
              </div>
              <BookOpen className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <div className="space-y-3">
                {[
                  {
                    question: "How do I schedule a delivery window?",
                    answer:
                      "Choose a delivery slot during checkout. You can reschedule from the Orders section until the package leaves the cold chain.",
                  },
                  {
                    question: "What if my ice cream melts in transit?",
                    answer:
                      "Contact support within 24 hours with a photo. We will issue a refund or arrange a reshipment on the next available slot.",
                  },
                  {
                    question: "Can I gift subscriptions to friends?",
                    answer:
                      "Yes! Use the gift card tab to load credits and share the code. Recipients can redeem directly from their cart.",
                  },
                  {
                    question: "How do I become a FrostCart merchant?",
                    answer:
                      "Switch to the merchant tab to register, add products, and start managing orders right away.",
                  },
                ].map((faq) => (
                  <details key={faq.question} className="group rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4 text-sm">
                    <summary className="flex cursor-pointer items-center justify-between font-semibold text-[#111111]">
                      {faq.question}
                      <ChevronRight className="h-4 w-4 text-[#888888] transition group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-sm text-[#444444]">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        );
      case "merchant":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Register as a FrostCart merchant</h2>
                <p className="text-sm text-[#6b6b6b]">
                  Upgrade your account, publish inventory, and access the merchant dashboard.
                </p>
              </div>
              <Store className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              {profile?.role === "merchant" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#d6f5d8] bg-[#f2fff3] p-4 text-sm text-[#216c27]">
                    <p className="font-semibold text-[#0d5c1c]">Merchant tools unlocked</p>
                    <p className="mt-1">
                      Jump into your dashboard to track orders, update catalogue listings, and monitor payouts.
                    </p>
                  </div>
                  <Link
                    href="/merchant"
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    <Store className="h-4 w-4" />
                    Open merchant dashboard
                  </Link>
                  <p className="text-xs text-[#6b6b6b]">
                    Need to update GST, bank information, or support contacts? Manage them from the dashboard settings panel.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4 text-sm text-[#444444]">
                    <p className="font-semibold text-[#111111]">What happens next?</p>
                    <ul className="mt-2 space-y-2 text-sm text-[#444444]">
                      <li>• Your role switches to merchant so you can access seller tools.</li>
                      <li>• A merchant profile is created. Complete business details from the dashboard.</li>
                      <li>• You can still shop as a customer while managing storefront operations.</li>
                    </ul>
                  </div>
                  <button
                    onClick={handleRegisterMerchant}
                    disabled={merchantStatus === "loading"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {merchantStatus === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Register now
                  </button>
                  {merchantMessage && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        merchantStatus === "success"
                          ? "border-[#d6f5d8] bg-[#f2fff3] text-[#216c27]"
                          : "border-[#ffd7d7] bg-[#fff5f5] text-[#b42323]"
                      }`}
                    >
                      {merchantMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case "logout":
        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111111]">Sign out</h2>
                <p className="text-sm text-[#6b6b6b]">Come back anytime for more frozen delights.</p>
              </div>
              <LogOut className="h-6 w-6 text-[#111111]" />
            </header>
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#444444]">
                Logging out clears session-specific data but keeps your wishlist, saved cards, and merchant setup ready for the next visit.
              </p>
              <button
                onClick={handleLogout}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Log me out
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f4] text-[#111111]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-3 pb-16 pt-10 sm:px-4 lg:flex-row lg:pt-14">
        <aside className="lg:w-72">
          <div className="rounded-2xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white text-sm font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? profile?.email?.charAt(0)?.toUpperCase() ?? "F"}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{profile?.full_name ?? user.email}</p>
                <p className="text-xs text-[#6b6b6b]">{profile?.role === "merchant" ? "Merchant" : "Customer"}</p>
              </div>
            </div>
            <nav className="mt-6 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                      activeSection === section.key
                        ? "bg-[#111111] text-white"
                        : "text-[#444444] hover:bg-[#f3f3f3]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition ${activeSection === section.key ? "translate-x-2" : ""}`} />
                  </button>
                );
              })}
            </nav>
          </div>
          <footer className="mt-6 space-y-3 rounded-2xl border border-[#e5e5e5] bg-white p-6 text-xs text-[#6b6b6b] shadow-sm">
            <p className="text-sm font-semibold text-[#111111]">FrostCart HQ</p>
            <p>
              500 Ember Avenue,<br />
              Silicon Valley, CA 94043
            </p>
            <p className="text-xs text-[#6b6b6b]">© {new Date().getFullYear()} FrostCart Inc. All rights reserved.</p>
            <p className="text-xs text-[#6b6b6b]">GSTIN: 27AAACF1234J1ZV · CIN: U15549DL2025PTC123456</p>
          </footer>
        </aside>
        <main className="flex-1 space-y-6">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
