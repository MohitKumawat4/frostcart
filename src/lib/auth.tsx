'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError, type PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { GuestCartManager } from './guest-cart'
import type { Database } from './database.types'

export type UserRole = 'customer' | 'merchant'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name?: string | null
  avatar_url?: string
  gender?: string | null
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, role: UserRole, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: AuthError | PostgrestError | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  type UsersRow = Database['public']['Tables']['users']['Row']
  type UsersUpdate = Database['public']['Tables']['users']['Update']
  type ProfilesRow = Database['public']['Tables']['profiles']['Row']
  type ProfilesInsert = Database['public']['Tables']['profiles']['Insert']
  type ProfilesUpdate = Database['public']['Tables']['profiles']['Update']

  const usersTable = () => supabase.from('users') as any
  const profilesTable = () => supabase.from('profiles') as any

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error fetching initial session:', error)
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await loadUserProfile(session.user.id)
        }
      } catch (error) {
        console.error('getInitialSession failed:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        try {
          if (session?.user) {
            await loadUserProfile(session.user.id)
            // Merge guest cart with user cart
            await mergeGuestCart(session.user.id)
          } else {
            setProfile(null)
          }
        } catch (error) {
          console.error('Auth state change handler failed:', error)
        } finally {
          setLoading(false)
        }
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
      const { data: userData, error: userError } = await usersTable()
        .select('id, email, role, full_name, avatar_url')
        .eq('id', userId)
        .maybeSingle()

      if (userError) {
        console.error('Error loading user row:', userError)
        return
      }

      const typedUserRow = userData as UsersRow | null
      if (!typedUserRow) {
        console.error('User row is null')
        return
      }

      const { data: profileData, error: profileError } = await profilesTable()
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile row:', profileError)
        return
      }

      let ensuredProfile = profileData as ProfilesRow | null

      if (!ensuredProfile) {
        const emptyProfile: ProfilesInsert = { id: userId }
        const { data: createdProfile, error: createProfileError } = await profilesTable()
          .insert(emptyProfile as ProfilesInsert)
          .select('*')
          .single()

        if (createProfileError) {
          console.error('Error creating empty profile row:', createProfileError)
        } else {
          ensuredProfile = createdProfile as ProfilesRow | null
        }
      }

      setProfile({
        id: typedUserRow.id,
        email: typedUserRow.email,
        role: (typedUserRow.role as UserRole) ?? 'customer',
        full_name: typedUserRow.full_name ?? null,
        avatar_url: typedUserRow.avatar_url || undefined,
        gender: ensuredProfile?.gender ?? null,
        phone: ensuredProfile?.phone ?? null,
        address_line1: ensuredProfile?.address_line1 ?? null,
        address_line2: ensuredProfile?.address_line2 ?? null,
        city: ensuredProfile?.city ?? null,
        state: ensuredProfile?.state ?? null,
        postal_code: ensuredProfile?.postal_code ?? null,
        country: ensuredProfile?.country ?? null
      })
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const refreshProfile = async () => {
    if (!user) {
      return
    }

    await loadUserProfile(user.id)
  }

  const signUp = async (email: string, password: string, role: UserRole, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role
        }
      }
    })

    if (error) {
      return { error }
    }

    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (authUser) {
      const ensureProfile: ProfilesInsert = { id: authUser.id }
      const { error: ensureProfileError } = await profilesTable()
        .upsert(ensureProfile, { onConflict: 'id' })

      if (ensureProfileError) {
        console.error('Error ensuring profile row exists:', ensureProfileError)
      }

      await loadUserProfile(authUser.id)
    }

    return { error: null }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (!error && data.session?.user) {
      setUser(data.session.user)
      await loadUserProfile(data.session.user.id)
      await mergeGuestCart(data.session.user.id)
    }

    return { error, user: data.session?.user ?? null }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        return { error }
      }

      // Immediately clear client state so the UI reacts without waiting for the listener callback.
      setSession(null)
      setUser(null)
      setProfile(null)

      return { error: null }
    } catch (error) {
      console.error('Sign out failed:', error)
      // If sign out fails, return the error to the caller for toast handling.
      return { error: error as AuthError }
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      console.warn('updateProfile called without an authenticated user')
      return { error: null }
    }

    const userPayload: UsersUpdate = {}
    const profilePayload: ProfilesUpdate = {}

    if ('full_name' in updates) {
      userPayload.full_name = updates.full_name ?? null
    }

    if ('avatar_url' in updates) {
      userPayload.avatar_url = updates.avatar_url ?? null
    }

    if ('role' in updates && updates.role) {
      userPayload.role = updates.role
    }

    const profileFields: Array<keyof UserProfile> = ['gender', 'phone', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country']
    let hasProfileUpdates = false

    for (const field of profileFields) {
      if (field in updates) {
        hasProfileUpdates = true
        profilePayload[field as keyof ProfilesUpdate] = (updates as any)[field] ?? null
      }
    }

    let combinedError: PostgrestError | null = null

    if (Object.keys(userPayload).length > 0) {
      const { error: usersError } = await usersTable()
        .update(userPayload)
        .eq('id', user.id)

      if (usersError) {
        combinedError = usersError
      }
    }

    if (hasProfileUpdates) {
      // Upsert the profile row so new users without an existing profile record are handled gracefully,
      // and stamp the update with the current timestamp for auditing in Supabase.
      const profileUpsertPayload: ProfilesInsert = {
        id: user.id,
        ...profilePayload,
        updated_at: new Date().toISOString()
      }

      const { error: profileError } = await profilesTable()
        .upsert(profileUpsertPayload, { onConflict: 'id' })

      if (profileError) {
        combinedError = profileError
      }
    }

    if (!combinedError) {
      // Optimistically update the profile state with the new values
      setProfile(prev => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    }

    return { error: combinedError }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile
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
