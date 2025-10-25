"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronRight,
  IceCream,
  Menu,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/guest-cart";

// Shared product definition ensures cards, spotlights, and recommendation rails stay in sync.
type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  badge?: string;
  description: string;
};

// Collections capture bundled experiences such as combos or freezer-friendly sets.
type Collection = {
  id: string;
  title: string;
  description: string;
  image: string;
  linkLabel: string;
};

// Editorial highlights tease long-form content, recipes, or store announcements.
type EditorialHighlight = {
  id: string;
  title: string;
  summary: string;
  image: string;
};

// Customer-facing categories; merchant-specific navigation will be introduced later.
const categories = [
  { label: "All", value: "all" },
  { label: "Signature Sundaes", value: "sundaes" },
  { label: "Artisan Pops", value: "pops" },
  { label: "Nitro Scoops", value: "nitro" },
  { label: "Vegan Delights", value: "vegan" },
  { label: "Family Packs", value: "packs" },
  { label: "Limited Editions", value: "limited" },
];

// Prominent hero banners inspired by marketplaces such as Amazon and Flipkart.
const heroBanners = [
  {
    id: "berry-bliss",
    headline: "Berry Bliss Festival",
    subhead: "Save 20% on farm-picked blueberry swirls this weekend only.",
    ctaLabel: "Shop Berry Specials",
    image:
      "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "nitro-launch",
    headline: "Nitro Launch Party",
    subhead:
      "Experience micro-batch nitro scoops with doorstep delivery in under 30 minutes.",
    ctaLabel: "Explore Nitro Picks",
    image:
      "https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "family-pack",
    headline: "Family Pack Combos",
    subhead: "Bundle pints, pops, and bars for movie nights and celebrations.",
    ctaLabel: "Browse Combo Boxes",
    image:
      "https://images.unsplash.com/photo-1497051788611-2c64812349da?auto=format&fit=crop&w=1600&q=80",
  },
];

// Hardcoded catalog data stands in for future dynamic queries.
const catalog: Product[] = [
  {
    id: "sundae-01",
    name: "Midnight Berry Sundae",
    category: "sundaes",
    price: 349,
    rating: 4.8,
    reviews: 128,
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
    badge: "Top rated",
    description: "Layered blueberry compote with Madagascar vanilla soft serve.",
  },
  {
    id: "nitro-01",
    name: "Nitro Espresso Swirl",
    category: "nitro",
    price: 399,
    rating: 4.9,
    reviews: 96,
    image:
      "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80",
    badge: "30-min delivery",
    description: "Silky coffee mousse infused with nitrogen for a pillowy finish.",
  },
  {
    id: "vegan-01",
    name: "Vegan Pistachio Gelato",
    category: "vegan",
    price: 329,
    rating: 4.7,
    reviews: 82,
    image:
      "https://images.unsplash.com/photo-1508736793122-f516e3ba5569?auto=format&fit=crop&w=800&q=80",
    description: "Stone-churned pistachio with oat-milk crema and roasted nibs.",
  },
  {
    id: "pops-01",
    name: "Choco-Hazelnut Pop Bar",
    category: "pops",
    price: 199,
    rating: 4.6,
    reviews: 210,
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    description: "Crunchy gianduja shell with salted caramel ripples inside.",
  },
  {
    id: "limited-01",
    name: "Mango Alphonso Sorbet",
    category: "limited",
    price: 289,
    rating: 4.9,
    reviews: 64,
    image:
      "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80",
    badge: "Seasonal",
    description: "Sun-ripened Alphonso mangoes cold-pressed for tropical sweetness.",
  },
  {
    id: "packs-01",
    name: "Family Movie Night Pack",
    category: "packs",
    price: 1199,
    rating: 4.5,
    reviews: 44,
    image:
      "https://images.unsplash.com/photo-1523293182086-7651a899d37e?auto=format&fit=crop&w=800&q=80",
    description: "Four pints, two pop boxes, and premium waffle cone sleeves.",
  },
  {
    id: "sundae-02",
    name: "Toasted Marshmallow Sundae",
    category: "sundaes",
    price: 359,
    rating: 4.6,
    reviews: 152,
    image:
      "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80",
    description: "Campfire-style ganache, torched fluff, and brownie crumble base.",
  },
  {
    id: "nitro-02",
    name: "Cookies & Cream Nitro Pint",
    category: "nitro",
    price: 419,
    rating: 4.8,
    reviews: 187,
    image:
      "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=800&q=80",
    description: "Nitro-whipped cream base loaded with house-baked cookie shards.",
  },
  {
    id: "pops-02",
    name: "Strawberry Cheesecake Bar",
    category: "pops",
    price: 209,
    rating: 4.4,
    reviews: 133,
    image:
      "https://images.unsplash.com/photo-1549407134-89554c0b74be?auto=format&fit=crop&w=800&q=80",
    description: "Cream-cheese gelato coated with strawberry shards and biscuit dust.",
  },
  {
    id: "vegan-02",
    name: "Dark Cocoa Sorbet",
    category: "vegan",
    price: 319,
    rating: 4.5,
    reviews: 71,
    image:
      "https://images.unsplash.com/photo-1464306076886-da185f6a9d05?auto=format&fit=crop&w=800&q=80",
    description: "Single-origin cocoa blended with coconut water and citrus zest.",
  },
];

const curatedCollections: Collection[] = [
  {
    id: "collection-berry",
    title: "Weekend Berry Crate",
    description: "Six seasonal berry pints plus freeze-dried toppings for garnish.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    linkLabel: "Shop berry crate",
  },
  {
    id: "collection-vegan",
    title: "Plant-Based Party Pack",
    description: "A vegan-friendly mix with nut creams, sorbets, and coconut pops.",
    image:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
    linkLabel: "Explore vegan pack",
  },
  {
    id: "collection-celebration",
    title: "Celebration Cake Alternatives",
    description: "Layered ice-cream cakes ready to slice and serve for birthdays.",
    image:
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
    linkLabel: "Browse celebration picks",
  },
];

const editorialHighlights: EditorialHighlight[] = [
  {
    id: "editorial-nitro",
    title: "How nitro churn keeps scoops silky",
    summary:
      "Discover the science behind our micro-batch nitrogen churn and why it locks in flavor while cutting ice crystals.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "editorial-pairing",
    title: "Pairing pints with movie genres",
    summary:
      "From rom-com raspberry swirls to thriller-grade dark cocoa, match your next binge night with a perfect pint.",
    image:
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
  },
];


export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeBanner, setActiveBanner] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { itemCount, addItem, loading: cartLoading } = useCart();

  // Auto-rotate hero banners to keep the landing page fresh.
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % heroBanners.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  // Marketplace-style filtering so shoppers can pivot between categories and search terms.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return catalog.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.category === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const spotlightProducts = useMemo(() => catalog.slice(0, 4), []);

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image
    }, 1);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    // Suppress form submission; the list reacts live to the query string.
    event.preventDefault();
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f4] text-[#111111]">
      <header className="sticky top-0 z-40 shadow-sm">
        {/* Customer navigation; merchant-specific controls will slot in later. */}
        <div className="border-b border-[#e5e5e5] bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 lg:gap-6">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5e5] text-[#444444] transition hover:bg-[#f2f2f2] lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-white flex-shrink-0">
                <IceCream className="h-5 w-5" />
              </span>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-semibold tracking-tight sm:text-base">FrostCart</span>
                <span className="text-xs text-[#6b6b6b] hidden sm:block">Ice cream superstore</span>
              </div>
            </Link>
            <form
              onSubmit={handleSearch}
              className="relative hidden flex-1 items-center max-w-md mx-4 lg:flex"
            >
              <Search className="pointer-events-none absolute left-4 h-5 w-5 text-[#888888]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search for pints, sorbets, toppings..."
                aria-label="Search products"
                className="w-full rounded-full border border-[#dcdcdc] bg-[#f8f8f8] py-2.5 pl-12 pr-4 text-sm transition focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
              />
            </form>
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Link
                href="#orders"
                className="hidden text-sm font-medium text-[#444444] transition hover:text-[#111111] lg:inline"
              >
                Orders
              </Link>
              <Link
                href="#deals"
                className="hidden text-sm font-medium text-[#444444] transition hover:text-[#111111] lg:inline"
              >
                Deals
              </Link>
              <Link
                href="/cart"
                className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white sm:px-4 relative"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Cart</span>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#111111] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden lg:flex items-center gap-2 text-sm">
                    <span className="text-[#444444]">Hi, {profile?.full_name || user.email}</span>
                    {profile?.role === 'merchant' && (
                      <Link
                        href="/merchant"
                        className="text-[#111111] font-medium hover:underline"
                      >
                        Dashboard
                      </Link>
                    )}
                  </div>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] px-3 py-2 text-sm font-medium text-[#444444] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Profile</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] px-3 py-2 text-sm font-medium text-[#444444] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/auth?mode=signup"
                    className="hidden text-sm font-medium text-[#444444] transition hover:text-[#111111] lg:inline"
                  >
                    Sign up
                  </Link>
                  <Link
                    href="/auth?mode=signin"
                    className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white sm:px-4"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign in</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Mobile search mirrors the main nav without altering desktop layout. */}
        <div className="border-b border-[#eaeaea] bg-white px-3 py-3 sm:px-4 lg:hidden">
          <form onSubmit={handleSearch} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#888888]" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search for pints, sorbets, toppings..."
              aria-label="Search products"
              className="w-full rounded-full border border-[#dcdcdc] bg-[#f8f8f8] py-3 pl-12 pr-4 text-sm transition focus:border-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
            />
          </form>
        </div>
        <div className="border-b border-[#eaeaea] bg-white">
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            <div className="flex gap-2 overflow-x-auto py-3 text-sm scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setActiveCategory(category.value)}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 font-medium transition min-w-fit ${
                    activeCategory === category.value
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-transparent bg-[#f3f3f3] text-[#444444] hover:bg-[#e8e8e8] active:bg-[#ddd]"
                  }`}
                  aria-pressed={activeCategory === category.value}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-3 pb-16 pt-6 sm:gap-12 sm:px-4 sm:pt-8 lg:px-6">
        <section
          aria-label="Featured promotions"
          className="relative overflow-hidden rounded-2xl bg-[#111111] text-white shadow-lg sm:rounded-3xl"
        >
          <div className="relative aspect-[16/7] w-full sm:aspect-[16/6]">
            {heroBanners.map((banner, index) => (
              <article
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                  index === activeBanner ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Image
                  src={banner.image}
                  alt={banner.headline}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
                <div className="relative flex h-full flex-col justify-center gap-3 px-4 py-8 sm:gap-4 sm:px-6 sm:py-10 md:px-8 lg:px-12">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] w-fit">
                    <Sparkles className="h-4 w-4" />
                    Spotlight
                  </span>
                  <h1 className="text-xl font-semibold leading-tight sm:text-2xl md:text-4xl lg:text-5xl">
                    {banner.headline}
                  </h1>
                  <p className="max-w-2xl text-sm text-white/80 sm:text-base">
                    {banner.subhead}
                  </p>
                  <Link
                    href="#suggested"
                    className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#ffd8ec] sm:px-6 sm:py-3"
                  >
                    {banner.ctaLabel}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-4 sm:bottom-6 sm:px-6 md:px-8">
            <div className="flex gap-2">
              {heroBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setActiveBanner(index)}
                  className={`h-2.5 rounded-full transition ${
                    index === activeBanner
                      ? "w-8 bg-white"
                      : "w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Show banner ${banner.headline}`}
                />
              ))}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() =>
                  setActiveBanner((prev) =>
                    prev === 0 ? heroBanners.length - 1 : prev - 1
                  )
                }
                className="rounded-full border border-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveBanner((prev) => (prev + 1) % heroBanners.length)
                }
                className="rounded-full border border-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section
          id="suggested"
          aria-labelledby="suggested-heading"
          className="flex flex-col gap-4 sm:gap-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 id="suggested-heading" className="text-lg font-semibold sm:text-xl">
                Ice cream picks just for you
              </h2>
              <p className="text-sm text-[#5f5f5f] sm:text-base">
                Browse curated batches across categories and price points.
              </p>
            </div>
            <Link
              href="#deals"
              className="hidden text-sm font-semibold text-[#111111] hover:underline sm:inline"
            >
              View all deals
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredProducts.length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-[#dcdcdc] bg-white px-6 py-12 text-center text-sm text-[#666666]">
                No matches yet. Try a different search term or switch categories.
              </p>
            )}
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        </section>

        <section
          id="collections"
          aria-labelledby="collections-heading"
          className="flex flex-col gap-4 sm:gap-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 id="collections-heading" className="text-lg font-semibold sm:text-xl">
                Curated freezers & combo boxes
              </h2>
              <p className="text-sm text-[#5f5f5f] sm:text-base">
                Stock up on themed boxes designed by our gelato chefs.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {curatedCollections.map((collection) => (
              <article
                key={collection.id}
                className="overflow-hidden rounded-2xl border border-[#e4e4e4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl"
              >
                <div className="relative h-40 w-full sm:h-48">
                  <Image
                    src={collection.image}
                    alt={collection.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col gap-3 p-4 sm:p-6">
                  <h3 className="text-base font-semibold sm:text-lg">{collection.title}</h3>
                  <p className="text-sm text-[#5f5f5f]">{collection.description}</p>
                  <Link
                    href="#"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111] hover:underline"
                  >
                    {collection.linkLabel}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="story"
          aria-labelledby="story-heading"
          className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr,1fr]"
        >
          <div className="overflow-hidden rounded-2xl border border-[#e4e4e4] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <h2 id="story-heading" className="text-lg font-semibold sm:text-xl">
              Trending batches today
            </h2>
            <p className="mt-2 text-sm text-[#5f5f5f] sm:text-base">
              Freshly churned combos with limited-time toppings and sauces.
            </p>
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
              {spotlightProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex gap-3 rounded-xl border border-[#f0f0f0] bg-[#fbfbfb] p-3 sm:gap-4 sm:rounded-2xl sm:p-4"
                >
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col justify-between gap-2 min-w-0 flex-1">
                    <div>
                      <h3 className="text-sm font-semibold line-clamp-1 sm:text-base">{product.name}</h3>
                      <p className="text-xs text-[#777777] line-clamp-2 sm:text-sm">
                        {product.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold sm:text-base">
                        {formatCurrency(product.price)}
                      </span>
                      <Link
                        href="#"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]"
                      >
                        Details
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:gap-4">
            {editorialHighlights.map((highlight) => (
              <article
                key={highlight.id}
                className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#e4e4e4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl"
              >
                <div className="relative h-32 w-full sm:h-40">
                  <Image
                    src={highlight.image}
                    alt={highlight.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-3 sm:p-5">
                  <h3 className="text-base font-semibold sm:text-lg">{highlight.title}</h3>
                  <p className="text-sm text-[#5f5f5f]">{highlight.summary}</p>
                  <Link
                    href="#"
                    className="mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#111111] hover:underline"
                  >
                    Read more
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#eaeaea] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-6 text-sm text-[#6b6b6b] sm:px-4 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} FrostCart Labs. Crafted for dessert lovers.</p>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <Link href="#privacy" className="hover:text-[#111111]">
              Privacy
            </Link>
            <Link href="#terms" className="hover:text-[#111111]">
              Terms
            </Link>
            <Link href="#support" className="hover:text-[#111111]">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Product card mirrors Amazon-style tiles with rating, price, and quick actions.
function ProductCard({ product, onAddToCart }: { product: Product; onAddToCart: (product: Product) => void }) {
  return (
    <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#e4e4e4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl">
      <div className="relative h-40 w-full sm:h-52">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover"
        />
        {product.badge && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#111111] px-2 py-1 text-xs font-semibold text-white sm:left-4 sm:top-4 sm:px-3">
            <Sparkles className="h-3 w-3" />
            {product.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:gap-3 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <Star className="h-4 w-4 fill-current" />
          <span>{product.rating.toFixed(1)}</span>
          <span className="text-xs text-[#6b6b6b]">({product.reviews})</span>
        </div>
        <h3 className="text-sm font-semibold leading-tight sm:text-base">{product.name}</h3>
        <p className="text-xs text-[#6b6b6b] line-clamp-2 sm:text-sm">{product.description}</p>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-base font-semibold sm:text-lg">{formatCurrency(product.price)}</span>
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white sm:px-4"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
        <Link
          href="#"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111] hover:underline"
        >
          View details
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
