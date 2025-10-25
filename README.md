# FrostCart - Premium Ice Cream Marketplace

A modern, responsive e-commerce platform for ice cream and frozen desserts, built with Next.js 16, React 19, Tailwind CSS, and Supabase. Features guest browsing, authentication, cart management, and multi-vendor support.

## Features Implemented

### Core E-commerce Flow (from flow.md)

**Guest Browsing Experience:**

- Browse products without signup required
- Search and filter functionality
- Category-based navigation
- Product detail views
- Guest cart (localStorage-based)

**Authentication System:**

- Role-based accounts (Customer/Merchant)
- Sign up with email/password
- Guest checkout conversion
- Authentication gates for protected actions

**Cart Management:**

- Guest cart persistence in localStorage
- Authenticated user cart sync
- Real-time cart updates
- Quantity management
- Cart merging on login

**Responsive Design:**

- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly interactions
- Modern UI with Plus Jakarta Sans typography

### Technical Architecture

Frontend: Next.js 16 + React 19 + TypeScript
Styling: Tailwind CSS 4.0
State Management: React Context + Zustand patterns
Database: Supabase (PostgreSQL)
Authentication: Supabase Auth
Cart: localStorage (guest) + Supabase (authenticated)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from Settings → API
3. Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Database Schema

Run the following SQL in your Supabase SQL editor to create the required tables:

````sql
-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('customer', 'merchant')) NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchants table
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  business_name TEXT,
  business_description TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('chocolate', 'ice_cream', 'combo')) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  name TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Carts table
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id) NOT NULL,
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  variant_id UUID REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  customer_id UUID REFERENCES users(id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Addresses table
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wishlists table
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

### 4. Enable Row Level Security (RLS)

In your Supabase dashboard, enable RLS on all tables and create policies for proper access control.

### 5. Start Development Server

#### Standard Next.js Development
```bash
npm run dev
````

#### Development with Nodemon (Auto-restart on file changes)

```bash
npm run dev:nodemon
```

Nodemon is configured to watch for changes in:

- `src/` directory (components, pages, styles)
- `public/` directory (static assets)
- Environment files (`.env.local`, `.env`)
- Configuration files (`.json`, `.js`, `.ts`, `.tsx`)

**Note:** Nodemon is particularly useful when working with environment variables or configuration files that require server restarts.

## User Flow Implementation

### **Guest User Flow (No Signup Required):**

1. **Browse Products** - View all products, search, filter by category
2. **Add to Cart** - Items saved in localStorage
3. **View Cart** - See guest cart with all items
4. **Checkout** - Redirected to sign up/sign in

### **Authenticated Customer Flow:**

1. **Sign Up/In** - Choose "Shop" role during signup
2. **Cart Sync** - Guest cart merges with user account
3. **Checkout** - Full checkout process (to be implemented)
4. **Order Tracking** - View order history and status

### **Merchant Flow:**

1. **Sign Up** - Choose "Sell" role during signup
2. **Dashboard Access** - Dedicated merchant dashboard (to be implemented)
3. **Product Management** - Add/edit products, manage inventory
4. **Order Management** - Process incoming orders

## Responsive Design

The application is fully responsive with breakpoints for:

- **Mobile** (320px - 768px)
- **Tablet** (768px - 1024px)
- **Desktop** (1024px - 1440px)
- **Large screens** (1440px+)

## Key Components

- **Authentication** - Role-based auth with Supabase
- **Cart Management** - Guest + authenticated cart handling
- **Product Display** - Responsive product cards with ratings
- **Navigation** - Dynamic nav based on auth state
- **Search & Filter** - Real-time product filtering

## Next Steps (TODO)

- [ ] Product detail pages with variants
- [ ] Checkout flow implementation
- [ ] Payment integration
- [ ] Merchant dashboard
- [ ] Order management
- [ ] Email notifications
- [ ] Admin panel

## Implementation Status

✅ **Completed:**

- Responsive landing page
- Authentication system (signup/signin)
- Guest cart functionality
- Cart page with management
- Navigation integration
- Database schema setup

🚧 **In Progress:**

- Checkout flow
- Product detail pages

📋 **Planned:**

- Merchant dashboard
- Order management
- Payment processing
- Review system
