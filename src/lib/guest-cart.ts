import { v4 as uuidv4 } from 'uuid'

export interface CartItem {
  id: string
  productId: string
  variantId: string | null
  name: string
  price: number
  image: string
  quantity: number
}

export interface GuestCart {
  id: string
  items: CartItem[]
  expiresAt: number
}

// Guest cart management using localStorage
export class GuestCartManager {
  private static readonly STORAGE_KEY = 'frostcart_guest_cart'
  private static readonly EXPIRY_HOURS = 24

  static getCart(): GuestCart {
    if (typeof window === 'undefined') {
      return this.createEmptyCart()
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        return this.createEmptyCart()
      }

      const cart: GuestCart = JSON.parse(stored)

      // Check if cart has expired
      if (Date.now() > cart.expiresAt) {
        this.clearCart()
        return this.createEmptyCart()
      }

      return cart
    } catch (error) {
      console.error('Error loading guest cart:', error)
      return this.createEmptyCart()
    }
  }

  static addItem(product: {
    id: string
    name: string
    price: number
    image: string
    variantId?: string | null
  }, quantity: number = 1): void {
    if (typeof window === 'undefined') return

    const cart = this.getCart()
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === product.id && item.variantId === product.variantId
    )

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += quantity
    } else {
      cart.items.push({
        id: uuidv4(),
        productId: product.id,
        variantId: product.variantId || null,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity
      })
    }

    this.saveCart(cart)
  }

  static updateItem(productId: string, variantId: string | null, quantity: number): void {
    if (typeof window === 'undefined') return

    const cart = this.getCart()
    const itemIndex = cart.items.findIndex(
      item => item.productId === productId && item.variantId === variantId
    )

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1)
      } else {
        cart.items[itemIndex].quantity = quantity
      }
    }

    this.saveCart(cart)
  }

  static removeItem(productId: string, variantId: string | null): void {
    if (typeof window === 'undefined') return

    const cart = this.getCart()
    cart.items = cart.items.filter(
      item => !(item.productId === productId && item.variantId === variantId)
    )

    this.saveCart(cart)
  }

  static clearCart(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem(this.STORAGE_KEY)
  }

  static getTotalAmount(): number {
    const cart = this.getCart()
    return cart.items.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  static mergeWithUserCart(userId: string): CartItem[] {
    const guestCart = this.getCart()
    const guestItems = [...guestCart.items]

    // Clear guest cart after merging
    this.clearCart()

    return guestItems
  }

  private static createEmptyCart(): GuestCart {
    return {
      id: uuidv4(),
      items: [],
      expiresAt: Date.now() + (this.EXPIRY_HOURS * 60 * 60 * 1000)
    }
  }

  private static saveCart(cart: GuestCart): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart))
    } catch (error) {
      console.error('Error saving guest cart:', error)
    }
  }
}

// Format price points in INR until locale-driven currency is wired in via Supabase data.
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
