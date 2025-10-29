'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './auth'
import { GuestCartManager, type CartItem } from './guest-cart'
import { supabase } from './supabase'
import type { Database } from './database.types'

export interface CartContextType {
  items: CartItem[]
  itemCount: number
  totalAmount: number
  loading: boolean
  addItem: (product: {
    id: string
    name: string
    price: number
    image: string
    variantId?: string | null
  }, quantity?: number) => void
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void
  removeItem: (productId: string, variantId: string | null) => void
  clearCart: () => void
  mergeGuestCart: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  type CartRow = Database['public']['Tables']['carts']['Row']
  type CartInsert = Database['public']['Tables']['carts']['Insert']
  type CartItemRow = Database['public']['Tables']['cart_items']['Row']
  type CartItemInsert = Database['public']['Tables']['cart_items']['Insert']
  type CartItemUpdate = Database['public']['Tables']['cart_items']['Update']
  type ProductRow = Database['public']['Tables']['products']['Row']

  // Helper accessors prevent TypeScript's generics from collapsing to `never`
  // when working with the Supabase query builder. We sacrifice some static
  // typing for now to keep the runtime logic straightforward.
  const cartsTable = () => supabase.from('carts') as any
  const cartItemsTable = () => supabase.from('cart_items') as any

  // Load cart data based on authentication state so the UI always reflects the right source.
  useEffect(() => {
    if (user) {
      loadUserCart()
    } else {
      loadGuestCart()
    }
  }, [user])

  const loadGuestCart = () => {
    const guestCart = GuestCartManager.getCart()
    setItems(guestCart.items)
    setLoading(false)
  }

  const ensureUserCart = async (): Promise<string | null> => {
    if (!user) return null

    try {
      const { data: existingCart, error: existingError } = await cartsTable()
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError
      }

      const typedExistingCart = existingCart as Pick<CartRow, 'id'> | null

      if (typedExistingCart?.id) {
        return typedExistingCart.id
      }

      const cartPayload: CartInsert = { user_id: user.id }

      const { data: upsertedCart, error: upsertError } = await cartsTable()
        .upsert(cartPayload, { onConflict: 'user_id' })
        .select('id')
        .single()

      if (upsertError) {
        throw upsertError
      }

      const typedNewCart = upsertedCart as Pick<CartRow, 'id'> | null

      return typedNewCart?.id ?? null
    } catch (error) {
      if (error && typeof error === 'object') {
        const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string }
        console.error('Error ensuring user cart:', {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code
        })
      } else {
        console.error('Error ensuring user cart:', error)
      }
      return null
    }
  }

  const loadUserCart = async () => {
    if (!user) return

    try {
      setLoading(true)

      const cartId = await ensureUserCart()
      if (!cartId) {
        setItems([])
        return
      }

      const { data: cartItems, error: itemsError } = await cartItemsTable()
        .select(`
          id,
          cart_id,
          product_id,
          variant_id,
          quantity,
          price,
          products(name, image_url, price)
        `)
        .eq('cart_id', cartId)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      const itemsArray = (cartItems ?? []) as (CartItemRow & { products: ProductRow | null })[]

      const formattedItems: CartItem[] = itemsArray.map(item => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        name: item.products?.name ?? 'Unknown product',
        price: Number(item.price ?? item.products?.price ?? 0),
        image: item.products?.image_url ?? '',
        quantity: item.quantity
      }))

      setItems(formattedItems)
    } catch (error) {
      console.error('Error loading user cart:', error)
      loadGuestCart()
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (product: {
    id: string
    name: string
    price: number
    image: string
    variantId?: string | null
  }, quantity: number = 1) => {
    if (user) {
      await addItemToUserCart(product, quantity)
    } else {
      GuestCartManager.addItem(product, quantity)
      loadGuestCart()
    }
  }

  const addItemToUserCart = async (product: {
    id: string
    name: string
    price: number
    image: string
    variantId?: string | null
  }, quantity: number) => {
    if (!user) return

    try {
      const cartId = await ensureUserCart()
      if (!cartId) return

      let existingQuery = cartItemsTable()
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', product.id)

      if (product.variantId) {
        existingQuery = existingQuery.eq('variant_id', product.variantId)
      } else {
        existingQuery = existingQuery.is('variant_id', null)
      }

      const { data: existingItem, error: existingError } = await existingQuery.maybeSingle()

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError
      }

      const typedExistingItem = existingItem as Pick<CartItemRow, 'id' | 'quantity'> | null

      if (typedExistingItem?.id) {
        const updatePayload: CartItemUpdate = {
          quantity: typedExistingItem.quantity + quantity
        }

        const { error: updateError } = await cartItemsTable()
          .update(updatePayload)
          .eq('id', typedExistingItem.id)

        if (updateError) throw updateError
      } else {
        const insertPayload: CartItemInsert = {
          cart_id: cartId,
          product_id: product.id,
          variant_id: product.variantId ?? null,
          quantity,
          price: product.price
        }

        const { error: insertError } = await cartItemsTable()
          .insert(insertPayload)

        if (insertError) throw insertError
      }

      await loadUserCart()
    } catch (error) {
      console.error('Error adding item to cart:', error)
      // Persist to guest cart so the shopper still sees their selection client-side.
      GuestCartManager.addItem(product, quantity)
      loadGuestCart()
    }
  }

  const updateQuantity = async (productId: string, variantId: string | null, quantity: number) => {
    if (user) {
      await updateUserCartItem(productId, variantId, quantity)
    } else {
      GuestCartManager.updateItem(productId, variantId, quantity)
      loadGuestCart()
    }
  }

  const updateUserCartItem = async (productId: string, variantId: string | null, quantity: number) => {
    if (!user) return

    try {
      const cartId = await ensureUserCart()
      if (!cartId) return

      let itemQuery = cartItemsTable()
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', productId)

      if (variantId) {
        itemQuery = itemQuery.eq('variant_id', variantId)
      } else {
        itemQuery = itemQuery.is('variant_id', null)
      }

      const { data: item, error: itemError } = await itemQuery.maybeSingle()

      if (itemError && itemError.code !== 'PGRST116') {
        throw itemError
      }

      const typedItem = item as Pick<CartItemRow, 'id'> | null

      if (typedItem?.id) {
        if (quantity <= 0) {
          const { error: deleteError } = await cartItemsTable()
            .delete()
            .eq('id', typedItem.id)

          if (deleteError) throw deleteError
        } else {
          const updatePayload: CartItemUpdate = { quantity }

          const { error: updateError } = await cartItemsTable()
            .update(updatePayload)
            .eq('id', typedItem.id)

          if (updateError) throw updateError
        }
      }

      await loadUserCart()
    } catch (error) {
      console.error('Error updating cart item:', error)
    }
  }

  const removeItem = async (productId: string, variantId: string | null) => {
    if (user) {
      await removeUserCartItem(productId, variantId)
    } else {
      GuestCartManager.removeItem(productId, variantId)
      loadGuestCart()
    }
  }

  const removeUserCartItem = async (productId: string, variantId: string | null) => {
    if (!user) return

    try {
      const cartId = await ensureUserCart()
      if (!cartId) return

      const deleteBuilder = cartItemsTable()
        .delete()
        .eq('cart_id', cartId)
        .eq('product_id', productId)

      const { error: deleteError } = await (
        variantId
          ? deleteBuilder.eq('variant_id', variantId)
          : deleteBuilder.is('variant_id', null)
      )

      if (deleteError) throw deleteError

      await loadUserCart()
    } catch (error) {
      console.error('Error removing cart item:', error)
    }
  }

  const clearCart = async () => {
    if (user) {
      await clearUserCart()
    } else {
      GuestCartManager.clearCart()
      setItems([])
    }
  }

  const clearUserCart = async () => {
    if (!user) return

    try {
      const cartId = await ensureUserCart()
      if (!cartId) return

      const { error: deleteError } = await cartItemsTable()
        .delete()
        .eq('cart_id', cartId)

      if (deleteError) throw deleteError

      setItems([])
    } catch (error) {
      console.error('Error clearing cart:', error)
    }
  }

  const mergeGuestCart = async () => {
    if (!user) return

    try {
      const guestItems = GuestCartManager.mergeWithUserCart(user.id)

      // Replay guest selections against the authenticated cart.
      for (const item of guestItems) {
        await addItemToUserCart(
          {
            id: item.productId,
            name: item.name,
            price: item.price,
            image: item.image,
            variantId: item.variantId
          },
          item.quantity
        )
      }

      await loadUserCart()
    } catch (error) {
      console.error('Error merging guest cart:', error)
    }
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const totalAmount = items.reduce((total, item) => total + (item.price * item.quantity), 0)

  const value = {
    items,
    itemCount,
    totalAmount,
    loading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    mergeGuestCart
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
