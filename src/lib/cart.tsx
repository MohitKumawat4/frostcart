'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './auth'
import { GuestCartManager, type CartItem } from './guest-cart'
import { supabase } from './supabase'

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

  // Load cart data based on authentication state
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

  const loadUserCart = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load cart items with product details
      const { data: cartItems, error: itemsError } = await supabase
        .from('cart')
        .select(`
          id,
          product_id,
          quantity,
          created_at,
          products (
            name,
            image_url,
            price
          )
        `)
        .eq('user_id', user.id)

      if (itemsError) {
        console.error('Error fetching cart items:', itemsError)
        throw itemsError
      }

      // Format items for display
      const formattedItems: CartItem[] = (cartItems || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        variantId: null,
        name: item.products?.name || 'Unknown Product',
        price: Number(item.products?.price || 0),
        image: item.products?.image_url || '',
        quantity: item.quantity
      }))

      setItems(formattedItems)
    } catch (error) {
      console.error('Error loading user cart:', error)
      // Fallback to guest cart
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
      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()

      if (existingItem) {
        // Update quantity
        await supabase
          .from('cart')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id)
      } else {
        // Add new item
        await supabase
          .from('cart')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity
          })
      }

      loadUserCart()
    } catch (error) {
      console.error('Error adding item to cart:', error)
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
      const { data: item } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle()

      if (item) {
        if (quantity <= 0) {
          await supabase
            .from('cart')
            .delete()
            .eq('id', item.id)
        } else {
          await supabase
            .from('cart')
            .update({ quantity })
            .eq('id', item.id)
        }
      }

      loadUserCart()
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
      await supabase
        .from('cart')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)

      loadUserCart()
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
      await supabase
        .from('cart')
        .delete()
        .eq('user_id', user.id)

      setItems([])
    } catch (error) {
      console.error('Error clearing cart:', error)
    }
  }

  const mergeGuestCart = async () => {
    if (!user) return

    try {
      const guestItems = GuestCartManager.mergeWithUserCart(user.id)

      // Add guest items to user cart
      for (const item of guestItems) {
        await addItemToUserCart({
          id: item.productId,
          name: item.name,
          price: item.price,
          image: item.image,
          variantId: item.variantId
        }, item.quantity)
      }
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
