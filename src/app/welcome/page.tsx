'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { IceCream, ArrowRight, Sparkles, Heart, ShoppingBag } from 'lucide-react'

export default function WelcomePage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      router.push('/auth?mode=signin')
      return
    }

    // Show confetti after a short delay
    const timer = setTimeout(() => {
      setShowConfetti(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [user, router])

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#f6f5f4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111111] mx-auto mb-4"></div>
          <p className="text-[#6b6b6b]">Loading...</p>
        </div>
      </div>
    )
  }

  const displayName = profile.full_name || user.email?.split('@')[0] || 'Ice Cream Lover'
  const isMerchant = profile.role === 'merchant'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f5f4] via-white to-[#f0f0f0] relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(0,0,0,0.03),transparent_50%)]" />

      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/4 animate-bounce delay-100">🎉</div>
          <div className="absolute top-20 right-1/4 animate-bounce delay-300">✨</div>
          <div className="absolute top-16 left-1/3 animate-bounce delay-500">🍨</div>
          <div className="absolute top-24 right-1/3 animate-bounce delay-700">🍦</div>
          <div className="absolute top-12 left-1/2 animate-bounce delay-200">🎊</div>
          <div className="absolute top-28 right-1/2 animate-bounce delay-400">⭐</div>
        </div>
      )}

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 md:p-12 text-center space-y-8">
          {/* Welcome header */}
          <div className="space-y-4">
            <div className="mx-auto w-20 h-20 bg-[#111111] rounded-full flex items-center justify-center mb-6">
              <IceCream className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-[#111111] tracking-tight">
                Welcome to
              </h1>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#111111] to-[#333333] bg-clip-text text-transparent">
                FrostCart
              </h1>
            </div>

            <p className="text-xl text-[#6b6b6b] font-medium">
              {displayName}!
            </p>

            <div className="flex items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                isMerchant
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#f3f3f3] text-[#444444] border border-[#e4e4e4]'
              }`}>
                {isMerchant ? (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Merchant
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Ice Cream Lover
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Welcome message */}
          <div className="space-y-4 py-6">
            <div className="text-lg text-[#5f5f5f] leading-relaxed">
              {isMerchant ? (
                <>
                  <p className="mb-4">
                    🎯 Ready to share your delicious ice cream creations with the world?
                  </p>
                  <p>
                    Start building your ice cream empire and delight customers with your unique flavors!
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-4">
                    🍨 Get ready to discover the most amazing ice cream experience!
                  </p>
                  <p>
                    Browse our curated selection of premium ice creams, discover new flavors, and treat yourself to something special.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Continue button */}
          <div className="pt-4 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 w-full md:w-auto px-8 py-4 text-lg font-semibold bg-[#111111] text-white rounded-xl hover:bg-[#222222] transition-all duration-200 transform hover:scale-105"
            >
              Continue Exploring
              <ArrowRight className="w-5 h-5" />
            </Link>

            <div className="text-center">
              <Link
                href="/"
                className="text-sm text-[#6b6b6b] hover:text-[#111111] transition underline"
              >
                Skip and go to shopping →
              </Link>
            </div>
          </div>

          {/* Fun quote */}
          <div className="pt-6 border-t border-[#e4e4e4]">
            <p className="text-sm text-[#888888] italic">
              {isMerchant
                ? '"The best way to predict the future is to create it." - Peter Drucker'
                : '"Life is like an ice cream cone, you have to lick it one day at a time." - Charles M. Schulz'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
