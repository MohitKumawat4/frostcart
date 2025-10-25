import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";

// Prepare the Plus Jakarta Sans font for clean, modern typography as per design standards.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "FrostCart - Premium Ice Cream Marketplace",
  description: "Discover artisanal ice creams, curated collections, and frozen delights from top creameries. Shop sundaes, pops, nitro scoops, and family packs with fast delivery.",
  keywords: ["ice cream", "gelato", "frozen desserts", "artisan", "delivery", "marketplace"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      {/* Apply the Plus Jakarta Sans font class so every page inherits the modern styling. */}
      <body className={`font-sans ${plusJakartaSans.className}`}>
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
