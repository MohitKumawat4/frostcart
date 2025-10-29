export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string
          user_id: string
          full_name: string
          phone: string
          address_line1: string
          city: string
          state: string
          postal_code: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          phone: string
          address_line1: string
          city: string
          state: string
          postal_code: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          phone?: string
          address_line1?: string
          city?: string
          state?: string
          postal_code?: string
          is_default?: boolean
          created_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          product_id: string
          variant_id?: string | null
          quantity: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          price?: number
          created_at?: string
        }
      }
      carts: {
        Row: {
          id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          gender: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          gender?: string | null
          phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          gender?: string | null
          phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string
          role: 'customer' | 'merchant'
          full_name: string | null
          avatar_url: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          role?: 'customer' | 'merchant'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'customer' | 'merchant'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      merchants: {
        Row: {
          id: string
          user_id: string
          business_name: string | null
          business_description: string | null
          logo_url: string | null
          is_verified: boolean
          created_at: string
          storefront_url: string | null
          support_email: string | null
          support_phone: string | null
        }
        Insert: {
          id?: string
          user_id: string
          business_name?: string | null
          business_description?: string | null
          logo_url?: string | null
          is_verified?: boolean
          created_at?: string
          storefront_url?: string | null
          support_email?: string | null
          support_phone?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          business_name?: string | null
          business_description?: string | null
          logo_url?: string | null
          is_verified?: boolean
          created_at?: string
          storefront_url?: string | null
          support_email?: string | null
          support_phone?: string | null
        }
      }
      merchant_metrics: {
        Row: {
          id: string
          merchant_id: string
          total_sales: number
          total_orders: number
          total_customers: number
          inventory_value: number
          last_updated: string
        }
        Insert: {
          id?: string
          merchant_id: string
          total_sales?: number
          total_orders?: number
          total_customers?: number
          inventory_value?: number
          last_updated?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          total_sales?: number
          total_orders?: number
          total_customers?: number
          inventory_value?: number
          last_updated?: string
        }
      }
      merchant_notifications: {
        Row: {
          id: string
          merchant_id: string
          title: string
          message: string
          category: 'order' | 'inventory' | 'payout' | 'system'
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          title: string
          message: string
          category?: 'order' | 'inventory' | 'payout' | 'system'
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          title?: string
          message?: string
          category?: 'order' | 'inventory' | 'payout' | 'system'
          is_read?: boolean
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          product_name: string
          variant_name: string | null
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          variant_id?: string | null
          product_name: string
          variant_name?: string | null
          quantity: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          variant_id?: string | null
          product_name?: string
          variant_name?: string | null
          quantity?: number
          price?: number
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string
          merchant_id: string
          status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          total_amount: number
          shipping_address_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          customer_id: string
          merchant_id: string
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          total_amount: number
          shipping_address_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          customer_id?: string
          merchant_id?: string
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      cart: {
        Row: {
          id: string
          user_id: string
          product_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          merchant_id: string | null
          price: number
          stock_quantity: number
          category_id: string | null
          image_url: string | null
          weight_grams: number | null
          ingredients: string[] | null
          allergens: string[] | null
          is_available: boolean | null
          is_featured: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          merchant_id?: string | null
          price: number
          stock_quantity?: number
          category_id?: string | null
          image_url?: string | null
          weight_grams?: number | null
          ingredients?: string[] | null
          allergens?: string[] | null
          is_available?: boolean | null
          is_featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          merchant_id?: string | null
          price?: number
          stock_quantity?: number
          category_id?: string | null
          image_url?: string | null
          weight_grams?: number | null
          ingredients?: string[] | null
          allergens?: string[] | null
          is_available?: boolean | null
          is_featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
