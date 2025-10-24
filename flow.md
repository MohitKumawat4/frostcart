Perfect! Here's a simplified schema for a showcase project:

## **Simplified Database Schema**

### **users (profiles)**

- id (UUID, primary key)
- email (text, unique)
- role (enum: customer/merchant)
- full_name (text, nullable)
- avatar_url (text, nullable)
- created_at (timestamp)

### **merchants**

- id (UUID, primary key)
- user_id (UUID, foreign key → users.id, unique)
- business_name (text, nullable)
- business_description (text, nullable)
- logo_url (text, nullable)
- is_verified (boolean, default: false)
- created_at (timestamp)

### **products**

- id (UUID, primary key)
- merchant_id (UUID, foreign key → merchants.id)
- name (text)
- description (text, nullable)
- category (enum: chocolate/ice_cream/combo)
- price (decimal)
- stock_quantity (integer, default: 0)
- images (text array, default: [])
- is_featured (boolean, default: false)
- status (enum: active/inactive, default: active)
- created_at (timestamp)
- updated_at (timestamp)

### **product_variants**

- id (UUID, primary key)
- product_id (UUID, foreign key → products.id)
- name (text) - e.g., "Small - 250g", "Vanilla Flavor"
- price_adjustment (decimal, default: 0)
- stock_quantity (integer, default: 0)
- created_at (timestamp)

### **carts**

- id (UUID, primary key)
- user_id (UUID, foreign key → users.id, unique)
- created_at (timestamp)
- updated_at (timestamp)

### **cart_items**

- id (UUID, primary key)
- cart_id (UUID, foreign key → carts.id)
- product_id (UUID, foreign key → products.id)
- variant_id (UUID, foreign key → product_variants.id, nullable)
- quantity (integer)
- created_at (timestamp)

### **addresses**

- id (UUID, primary key)
- user_id (UUID, foreign key → users.id)
- full_name (text)
- phone (text)
- address_line1 (text)
- city (text)
- state (text)
- postal_code (text)
- is_default (boolean, default: false)
- created_at (timestamp)

### **orders**

- id (UUID, primary key)
- order_number (text, unique) - e.g., "ORD-001234"
- customer_id (UUID, foreign key → users.id)
- merchant_id (UUID, foreign key → merchants.id)
- status (enum: pending/confirmed/shipped/delivered/cancelled, default: pending)
- total_amount (decimal)
- shipping_address_id (UUID, foreign key → addresses.id)
- created_at (timestamp)
- updated_at (timestamp)

### **order_items**

- id (UUID, primary key)
- order_id (UUID, foreign key → orders.id)
- product_id (UUID, foreign key → products.id)
- variant_id (UUID, foreign key → product_variants.id, nullable)
- product_name (text) - snapshot
- variant_name (text, nullable) - snapshot
- quantity (integer)
- price (decimal)
- created_at (timestamp)

### **reviews**

- id (UUID, primary key)
- product_id (UUID, foreign key → products.id)
- customer_id (UUID, foreign key → users.id)
- rating (integer, 1-5)
- comment (text, nullable)
- created_at (timestamp)

### **wishlists** (optional)

- id (UUID, primary key)
- user_id (UUID, foreign key → users.id)
- product_id (UUID, foreign key → products.id)
- created_at (timestamp)
- UNIQUE constraint: (user_id, product_id)

---

## **Key Simplifications Made:**

1. ✅ **Removed payment fields** - No payment_status, payment_method, transaction_ids
2. ✅ **Simplified orders** - Just basic status tracking (pending → delivered)
3. ✅ **Removed financial tracking** - No taxes, discounts, shipping costs breakdown
4. ✅ **No coupons table** - Can add later if needed
5. ✅ **Simplified addresses** - Just essential shipping info
6. ✅ **No complex inventory tracking** - Just basic stock quantity
7. ✅ **Removed merchant metrics** - No sales tracking, ratings aggregation
8. ✅ **Basic product fields** - No SEO, nutritional info, cold shipping flags
9. ✅ **Simplified reviews** - Just rating and comment, no images or helpful votes

This schema is **clean, functional, and perfect for showcasing**:

- User authentication & role management
- Product CRUD operations
- Shopping cart functionality
- Order placement & tracking
- Review system
- Multi-vendor support

You can easily demo all core e-commerce features without the complexity of payment processing!
