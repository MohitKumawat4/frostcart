'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { GuestCartManager } from './guest-cart'

export type UserRole = 'customer' | 'merchant'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name?: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, role: UserRole, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadUserProfile(session.user.id)
      }

      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await loadUserProfile(session.user.id)
          // Merge guest cart with user cart
          await mergeGuestCart(session.user.id)
        } else {
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const mergeGuestCart = async (userId: string) => {
    try {
      // Get guest cart items
      const guestItems = GuestCartManager.mergeWithUserCart(userId)

      if (guestItems.length > 0) {
        // Get or create user cart
        let { data: cart, error: cartError }: { data: { id: string } | null, error: any } = await supabase
          .from('carts')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (cartError && cartError.code === 'PGRST116') {
          // Cart doesn't exist, create one
          const { data: newCart, error: createError } = await supabase
            .from('carts')
            .insert({ user_id: userId } as any)
            .select('id')
            .single()

          if (createError) {
            console.error('Error creating user cart:', createError)
            return
          }
          cart = newCart
        } else if (cartError) {
          console.error('Error fetching user cart:', cartError)
          return
        }

        if (!cart || !cart.id) {
          console.error('Cart is null or has no id')
          return
        }

        // Add guest items to user cart
        const cartItems = guestItems.map(item => ({
          cart_id: cart.id,
          product_id: item.productId,
          quantity: item.quantity
        }))

        const { error: insertError } = await supabase
          .from('cart_items')
          .insert(cartItems as any)

        if (insertError) {
          console.error('Error merging guest cart:', insertError)
        }
      }
    } catch (error) {
      console.error('Error merging guest cart:', error)
    }
  }

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error }: { data: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null, error: any } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
        return
      }

      if (!data) {
        console.error('Profile data is null')
        return
      }

      setProfile({
        id: data.id,
        email: data.email,
        role: 'customer', // Default role since profiles table doesn't have role field
        full_name: data.full_name || undefined,
        avatar_url: data.avatar_url || undefined
      })
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const signUp = async (email: string, password: string, role: UserRole, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role
        }
      }
    })

    if (!error) {
      // Create user profile in database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: fullName || undefined,
          } as any)

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      }
    }

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return { error }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        return { error }
      }
      // Note: Auth state will be cleared by the auth state change listener
      // No need to manually clear local state here to avoid race conditions
      return { error: null }
    } catch (error) {
      console.error('Sign out failed:', error)
      // If sign out fails, return the error
      return { error: error as AuthError }
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'No user logged in' }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: updates.full_name })
      .eq('id', user.id)

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null)
    }

    return { error }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for checking if user needs to authenticate for certain actions
export function useAuthGate() {
  const { user, profile } = useAuth()

  const requiresAuth = (action: 'checkout' | 'wishlist' | 'review' | 'orders') => {
    switch (action) {
      case 'checkout':
      case 'wishlist':
      case 'review':
      case 'orders':
        return !user
      default:
        return false
    }
  }

  const getAuthPrompt = (action: 'checkout' | 'wishlist' | 'review' | 'orders') => {
    switch (action) {
      case 'checkout':
        return 'Sign up or login to complete your order'
      case 'wishlist':
        return 'Sign up or login to save items to your wishlist'
      case 'review':
        return 'Sign up or login to write a review'
      case 'orders':
        return 'Sign up or login to track your orders'
      default:
        return 'Please sign up or login to continue'
    }
  }

  return {
    requiresAuth,
    getAuthPrompt,
    isAuthenticated: !!user,
    isCustomer: profile?.role === 'customer',
    isMerchant: profile?.role === 'merchant'
  }
}
