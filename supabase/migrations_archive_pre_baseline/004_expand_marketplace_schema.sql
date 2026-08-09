-- 004_expand_marketplace_schema.sql
-- Comprehensive marketplace schema for EntizNetStore

-- User profiles (extend auth.users with buyer/seller info)
CREATE TABLE profiles_buyer (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  first_name text,
  last_name text,
  gender text CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say')),
  date_of_birth date,
  country text,
  phone text,
  communication_preferences jsonb DEFAULT '{}',
  interests text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE profiles_seller (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  storefront_name text NOT NULL,
  bio text,
  logo_url text,
  banner_url text,
  business_type text CHECK (business_type IN ('individual', 'business', 'creator')),
  tax_id text,
  verification_status text CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  verification_documents jsonb,
  payout_method jsonb,
  return_policy text,
  shipping_policy text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Addresses for buyers
CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  is_default boolean DEFAULT false,
  type text CHECK (type IN ('shipping', 'billing', 'both')) DEFAULT 'shipping',
  first_name text NOT NULL,
  last_name text NOT NULL,
  company text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state_province text,
  postal_code text NOT NULL,
  country text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Categories and subcategories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  image_url text,
  is_adult boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Brands/Creators
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  banner_url text,
  website text,
  is_verified boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Expanded products table (rebuild with new structure)
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  short_description text,
  type text CHECK (type IN ('physical', 'digital')) DEFAULT 'physical',
  status text CHECK (status IN ('draft', 'active', 'inactive', 'archived')) DEFAULT 'draft',
  base_price numeric NOT NULL,
  compare_at_price numeric,
  cost_per_item numeric,
  track_inventory boolean DEFAULT true,
  continue_selling boolean DEFAULT false, -- sell when out of stock
  requires_shipping boolean DEFAULT true,
  is_taxable boolean DEFAULT true,
  weight_grams integer,
  material text,
  age_restriction integer DEFAULT 18,
  tags text[],
  search_keywords text[],
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product categories (many-to-many)
CREATE TABLE product_categories (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- Product variants (sizes, colors, etc.)
CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  title text NOT NULL,
  option1 text, -- e.g., Size
  option2 text, -- e.g., Color
  option3 text, -- e.g., Material
  sku text UNIQUE,
  barcode text,
  price numeric NOT NULL,
  compare_at_price numeric,
  cost_per_item numeric,
  track_inventory boolean DEFAULT true,
  inventory_quantity integer DEFAULT 0,
  inventory_policy text CHECK (inventory_policy IN ('deny', 'continue')) DEFAULT 'deny',
  weight_grams integer,
  requires_shipping boolean DEFAULT true,
  is_active boolean DEFAULT true,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product media (images, videos)
CREATE TABLE product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  type text CHECK (type IN ('image', 'video')) NOT NULL,
  url text NOT NULL,
  alt_text text,
  caption text,
  position integer DEFAULT 0,
  metadata jsonb DEFAULT '{}', -- dimensions, duration, etc.
  created_at timestamptz DEFAULT now()
);

-- Inventory tracking
CREATE TABLE inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES inventory_locations(id) ON DELETE CASCADE,
  available integer DEFAULT 0,
  committed integer DEFAULT 0, -- reserved for orders
  on_hand integer DEFAULT 0,
  UNIQUE(variant_id, location_id)
);

-- Reviews and ratings
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid, -- will reference orders table
  rating integer CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  title text,
  content text,
  is_verified_purchase boolean DEFAULT false,
  is_anonymous boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Wishlists
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id, variant_id)
);

-- Recently viewed
CREATE TABLE recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Digital assets for digital products
CREATE TABLE digital_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  storage_path text NOT NULL,
  download_limit integer, -- null = unlimited
  expires_at timestamptz,
  watermark_enabled boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enhanced orders table
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')) DEFAULT 'pending',
  
  -- Pricing
  subtotal_cents bigint NOT NULL, -- in cents, USD
  tax_cents bigint DEFAULT 0,
  shipping_cents bigint DEFAULT 0,
  discount_cents bigint DEFAULT 0,
  total_cents bigint NOT NULL,
  
  -- Shipping
  shipping_address jsonb,
  billing_address jsonb,
  shipping_method text,
  tracking_number text,
  shipping_carrier text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  -- Payment
  payment_status text CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')) DEFAULT 'pending',
  payment_method text,
  payment_intent_id text, -- Stripe payment intent
  
  -- Fulfillment
  fulfillment_status text CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')) DEFAULT 'unfulfilled',
  
  -- Metadata
  notes text,
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order line items
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  quantity integer NOT NULL DEFAULT 1,
  price_cents bigint NOT NULL, -- price per item in cents
  total_cents bigint NOT NULL, -- quantity * price_cents
  product_title text NOT NULL, -- snapshot at time of order
  variant_title text,
  sku text,
  requires_shipping boolean DEFAULT true,
  is_digital boolean DEFAULT false,
  fulfillment_status text CHECK (fulfillment_status IN ('unfulfilled', 'fulfilled')) DEFAULT 'unfulfilled',
  created_at timestamptz DEFAULT now()
);

-- Enhanced escrow table
DROP TABLE IF EXISTS escrow CASCADE;
CREATE TABLE escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id),
  amount_cents bigint NOT NULL,
  status text CHECK (status IN ('held', 'released', 'refunded')) DEFAULT 'held',
  released_at timestamptz,
  release_reason text,
  dispute_id uuid, -- will reference disputes table
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Shipping profiles
CREATE TABLE shipping_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  processing_time_min integer DEFAULT 1, -- days
  processing_time_max integer DEFAULT 3, -- days
  domestic_rates jsonb DEFAULT '[]', -- array of shipping rates
  international_rates jsonb DEFAULT '[]',
  free_shipping_threshold_cents bigint,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages system
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text CHECK (type IN ('order_chat', 'support', 'general')) NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  participants uuid[] NOT NULL, -- array of user IDs
  subject text,
  status text CHECK (status IN ('active', 'closed', 'archived')) DEFAULT 'active',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  attachments jsonb DEFAULT '[]', -- array of file URLs
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Insert default categories for adult marketplace
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES 
('Vibrators', 'vibrators', 'Vibrating pleasure devices', null, 1),
('Dildos & Toys', 'dildos-toys', 'Non-vibrating intimate toys', null, 2),
('Men''s Toys', 'mens-toys', 'Pleasure products for men', null, 3),
('Anal Toys', 'anal-toys', 'Anal pleasure products', null, 4),
('Couples'' Toys', 'couples-toys', 'Products for couples', null, 5),
('BDSM & Fetish', 'bdsm-fetish', 'Bondage and fetish items', null, 6),
('Lubes & Essentials', 'lubes-essentials', 'Lubricants and care products', null, 7),
('Lingerie & Apparel', 'lingerie-apparel', 'Intimate clothing and costumes', null, 8),
('Gift Sets & Bundles', 'gift-sets-bundles', 'Curated product collections', null, 9),
('Digital & Virtual', 'digital-virtual', 'Digital content and experiences', null, 10);

-- Subcategories for Vibrators
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES 
('Clitoral Vibrators', 'clitoral-vibrators', 'Targeted clitoral stimulation', (SELECT id FROM categories WHERE slug = 'vibrators'), 1),
('G-Spot Vibrators', 'g-spot-vibrators', 'Internal G-spot stimulation', (SELECT id FROM categories WHERE slug = 'vibrators'), 2),
('Rabbit Vibrators', 'rabbit-vibrators', 'Dual stimulation toys', (SELECT id FROM categories WHERE slug = 'vibrators'), 3),
('Wand Massagers', 'wand-massagers', 'Powerful wand-style massagers', (SELECT id FROM categories WHERE slug = 'vibrators'), 4),
('Bullet Vibrators', 'bullet-vibrators', 'Compact bullet-style toys', (SELECT id FROM categories WHERE slug = 'vibrators'), 5),
('Remote Control', 'remote-control', 'App and remote controlled toys', (SELECT id FROM categories WHERE slug = 'vibrators'), 6);

-- Enable RLS on all new tables
ALTER TABLE profiles_buyer ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_seller ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;