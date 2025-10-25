'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { IceCream, Eye, EyeOff, Loader2 } from 'lucide-react'

type AuthMode = 'signin' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, signIn, signUp } = useAuth()

  const [mode, setMode] = useState<AuthMode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/welcome')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, 'customer', fullName)
        if (error) {
          setError(error.message)
        } else {
          // Success message and redirect
          alert('Account created successfully! Please check your email to verify your account.')
          router.push('/welcome')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          router.push('/welcome')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError('')
    setEmail('')
    setPassword('')
    setFullName('')
  }

  return (
    <div className="min-h-screen bg-[#f6f5f4] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-[#111111] rounded-full flex items-center justify-center">
            <IceCream className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-semibold text-[#111111]">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">
            {mode === 'signin'
              ? 'Sign in to your FrostCart account'
              : 'Join FrostCart to start shopping'
            }
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white rounded-2xl shadow-sm border border-[#e4e4e4] p-8" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-[#111111] mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-[#dcdcdc] rounded-xl focus:border-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111]/10 transition"
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#111111] mb-2">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[#dcdcdc] rounded-xl focus:border-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111]/10 transition"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#111111] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-[#dcdcdc] rounded-xl focus:border-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111]/10 transition"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-[#6b6b6b]" />
                ) : (
                  <Eye className="h-5 w-5 text-[#6b6b6b]" />
                )}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#111111] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111111] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-[#6b6b6b]">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-[#111111] hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-[#6b6b6b] hover:text-[#111111] transition"
          >
            ← Back to shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
