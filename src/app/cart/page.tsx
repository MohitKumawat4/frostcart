'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  IceCream,
  Loader2
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCart } from '@/lib/cart'
import { formatCurrency } from '@/lib/guest-cart'

export default function CartPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const {
    items,
    itemCount,
    totalAmount,
    updateQuantity,
    removeItem,
    clearCart,
    loading
  } = useCart()

  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  // Redirect to auth if trying to checkout without being logged in
  const handleCheckout = () => {
    if (!user) {
      router.push('/auth?mode=signin&redirect=/cart')
      return
    }
    // TODO: Implement checkout flow
    alert('Checkout functionality will be implemented next!')
  }

  const handleQuantityChange = async (productId: string, variantId: string | null, newQuantity: number) => {
    setIsUpdating(`${productId}-${variantId || 'null'}`)
    await updateQuantity(productId, variantId, newQuantity)
    setIsUpdating(null)
  }

  const deliveryFee = totalAmount > 500 ? 0 : 49
  const finalTotal = totalAmount + deliveryFee

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f5f4] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading your cart...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f5f4]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#6b6b6b] hover:text-[#111111] transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </Link>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#111111]" />
              <h1 className="text-lg font-semibold">Shopping Cart</h1>
              {itemCount > 0 && (
                <span className="bg-[#111111] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-24 w-24 bg-[#f3f3f3] rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="h-12 w-12 text-[#6b6b6b]" />
            </div>
            <h2 className="text-2xl font-semibold text-[#111111] mb-2">
              Your cart is empty
            </h2>
            <p className="text-[#6b6b6b] mb-8">
              Add some delicious ice cream to get started!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#111111] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#222222] transition"
            >
              <IceCream className="h-5 w-5" />
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
            {/* Cart Items */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">
                    Cart items ({itemCount})
                  </h2>
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-600 hover:text-red-700 font-medium transition"
                  >
                    Clear cart
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.variantId || 'null'}`} className="flex gap-4 p-4 border border-[#f0f0f0] rounded-xl">
                      <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-[#f8f8f8]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#111111] line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="text-sm text-[#6b6b6b] mt-1">
                          {formatCurrency(item.price)} each
                        </p>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity - 1)}
                              disabled={isUpdating === `${item.productId}-${item.variantId || 'null'}`}
                              className="h-8 w-8 rounded-full border border-[#e4e4e4] flex items-center justify-center hover:bg-[#f8f8f8] disabled:opacity-50 transition"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-medium">
                              {isUpdating === `${item.productId}-${item.variantId || 'null'}` ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity + 1)}
                              disabled={isUpdating === `${item.productId}-${item.variantId || 'null'}`}
                              className="h-8 w-8 rounded-full border border-[#e4e4e4] flex items-center justify-center hover:bg-[#f8f8f8] disabled:opacity-50 transition"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#111111]">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="p-2 text-[#6b6b6b] hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6">
                <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">Subtotal ({itemCount} items)</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">Delivery</span>
                    <span className={deliveryFee === 0 ? 'text-green-600' : ''}>
                      {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                    </span>
                  </div>

                  {deliveryFee === 0 && totalAmount < 500 && (
                    <p className="text-xs text-green-600">
                      🎉 Free delivery unlocked! Add {formatCurrency(500 - totalAmount)} more for free delivery.
                    </p>
                  )}

                  <div className="border-t border-[#e4e4e4] pt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full mt-6 bg-[#111111] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#222222] transition"
                >
                  {user ? 'Proceed to Checkout' : 'Sign in to Checkout'}
                </button>

                {!user && (
                  <p className="text-xs text-[#6b6b6b] text-center mt-2">
                    Sign in required to complete your order
                  </p>
                )}

                <div className="mt-4 text-center">
                  <Link
                    href="/"
                    className="text-sm text-[#6b6b6b] hover:text-[#111111] transition"
                  >
                    Continue shopping →
                  </Link>
                </div>
              </div>

              {/* Guest cart notice */}
              {!user && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    🛒 Guest Cart
                  </h4>
                  <p className="text-sm text-blue-700">
                    Your items are saved in your browser. Sign in to sync across devices and never lose your cart!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
