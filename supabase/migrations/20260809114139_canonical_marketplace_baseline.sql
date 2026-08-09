-- ============================================================================
-- EntizNetStore — Canonical Supabase Marketplace Baseline (Module 1C-1A draft)
-- Source of truth: verified live schema of the Replit-managed database
-- (backup replit_database_20260809T114139Z.dump), NOT obsolete migrations
-- 001–003.
--
-- Scope of this migration (per approved Module 1C plan):
--   INCLUDED : all 23 application tables, PKs, unique constraints, check
--              constraints, non-user foreign keys, indexes, defaults,
--              canonical seller_id ownership model, RLS ENABLED on all tables.
--   DEFERRED : RLS policies (designed separately, applied in a later step);
--              user-related FKs to auth.users / profiles (until the 11
--              historical auth identities are created);
--              products.seller_id NOT NULL (3 live products have NULL);
--              storage buckets; auth users; data.
--   EXCLUDED : obsolete provider_id / owner ownership fields;
--              obsolete products.price / products.images columns;
--              stale functions and the legacy notifications JWT policies;
--              duplicate singular buyer_profile / seller_profile tables;
--              Replit/Neon roles and system schemas.
--
-- DO NOT APPLY until the draft is approved. No data is inserted here.
--
-- DEPLOYMENT WARNING: this file must NOT be applied through the existing
-- ordered migration history (001–006, 20250926...). Those legacy migrations
-- create overlapping tables/policies and do not match the live schema; running
-- them first would break this baseline and violate the "RLS enabled, zero
-- policies" target. Apply this as the SOLE initial migration against the empty
-- Supabase project (clean history), with the legacy files retained only as
-- archived reference. Legacy migrations are intentionally NOT deleted or
-- rewritten in this task.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reference / catalog tables
-- ---------------------------------------------------------------------------

create table public.brands (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text not null unique,
    description text,
    logo_url text,
    banner_url text,
    website text,
    is_verified boolean default false,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.categories (
    id uuid default gen_random_uuid() primary key,
    parent_id uuid references public.categories(id),
    name text not null,
    slug text not null unique,
    description text,
    image_url text,
    is_adult boolean default true,
    sort_order integer default 0,
    is_active boolean default true,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (ids will later reference auth.users(id) — FK deferred)
-- ---------------------------------------------------------------------------

create table public.profiles_seller (
    id uuid primary key,  -- deferred FK -> auth.users(id)
    storefront_name text not null,
    bio text,
    logo_url text,
    banner_url text,
    business_type text default 'individual'
        constraint profiles_seller_business_type_check
        check (business_type in ('individual', 'business', 'creator')),
    tax_id text,
    verification_status text default 'pending'
        constraint profiles_seller_verification_status_check
        check (verification_status in ('pending', 'verified', 'rejected')),
    verification_documents jsonb default '{}'::jsonb,
    payout_method jsonb default '{}'::jsonb,
    return_policy text,
    shipping_policy text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.profiles_buyer (
    id uuid primary key,  -- deferred FK -> auth.users(id)
    display_name text,
    first_name text,
    last_name text,
    gender text
        constraint profiles_buyer_gender_check
        check (gender in ('male', 'female', 'non-binary', 'prefer-not-to-say')),
    date_of_birth date,
    country text,
    phone text,
    communication_preferences jsonb default '{}'::jsonb,
    interests text[] default '{}'::text[],
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Catalog: products and children (canonical ownership = products.seller_id)
-- ---------------------------------------------------------------------------

create table public.products (
    id uuid default gen_random_uuid() primary key,
    seller_id uuid,  -- canonical ownership; NOT NULL + FK deferred (3 live NULLs)
    brand_id uuid references public.brands(id),
    title text not null,
    slug text not null unique,
    description text,
    short_description text,
    type text default 'physical'
        constraint products_type_check check (type in ('physical', 'digital')),
    status text default 'draft'
        constraint products_status_check
        check (status in ('draft', 'active', 'inactive', 'archived')),
    base_price numeric not null,
    compare_at_price numeric,
    cost_per_item numeric,
    track_inventory boolean default true,
    continue_selling boolean default false,
    requires_shipping boolean default true,
    is_taxable boolean default true,
    weight_grams integer,
    material text,
    age_restriction integer default 18,
    tags text[],
    search_keywords text[],
    metadata jsonb default '{}'::jsonb,
    marketplace_brand varchar(20) default 'entiznetstore'
        constraint products_marketplace_brand_check
        check (marketplace_brand in ('entiznetstore', 'primediscreet')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.product_variants (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade,
    title text not null,
    option1 text,
    option2 text,
    option3 text,
    sku text unique,
    barcode text,
    price numeric not null,
    compare_at_price numeric,
    cost_per_item numeric,
    track_inventory boolean default true,
    inventory_quantity integer default 0,
    inventory_policy text default 'deny'
        constraint product_variants_inventory_policy_check
        check (inventory_policy in ('deny', 'continue')),
    weight_grams integer,
    requires_shipping boolean default true,
    is_active boolean default true,
    "position" integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.product_media (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade,
    variant_id uuid references public.product_variants(id) on delete set null,
    type text not null
        constraint product_media_type_check check (type in ('image', 'video')),
    url text not null,
    alt_text text,
    caption text,
    "position" integer default 0,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table public.product_categories (
    product_id uuid not null references public.products(id) on delete cascade,
    category_id uuid not null references public.categories(id) on delete cascade,
    primary key (product_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Orders / escrow / reviews
-- ---------------------------------------------------------------------------

create table public.orders (
    id uuid default gen_random_uuid() primary key,
    order_number text not null unique,
    buyer_id uuid not null,   -- deferred FK -> profiles_buyer(id)
    seller_id uuid not null,  -- deferred FK -> profiles_seller(id)
    status text default 'pending'
        constraint orders_status_check
        check (status in ('pending', 'confirmed', 'processing', 'shipped',
                          'delivered', 'cancelled', 'refunded')),
    subtotal_cents bigint not null,
    tax_cents bigint default 0,
    shipping_cents bigint default 0,
    discount_cents bigint default 0,
    total_cents bigint not null,
    shipping_address jsonb,
    billing_address jsonb,
    shipping_method text,
    tracking_number text,
    shipping_carrier text,
    shipped_at timestamptz,
    delivered_at timestamptz,
    payment_status text default 'pending'
        constraint orders_payment_status_check
        check (payment_status in ('pending', 'paid', 'failed', 'refunded',
                                  'partially_refunded')),
    payment_method text,
    payment_intent_id text,
    fulfillment_status text default 'unfulfilled'
        constraint orders_fulfillment_status_check
        check (fulfillment_status in ('unfulfilled', 'partial', 'fulfilled')),
    notes text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade,
    product_id uuid references public.products(id),
    variant_id uuid references public.product_variants(id),
    quantity integer not null default 1,
    price_cents bigint not null,
    total_cents bigint not null,
    product_title text not null,
    variant_title text,
    sku text,
    requires_shipping boolean default true,
    is_digital boolean default false,
    fulfillment_status text default 'unfulfilled'
        constraint order_items_fulfillment_status_check
        check (fulfillment_status in ('unfulfilled', 'fulfilled')),
    created_at timestamptz default now()
);

create table public.escrow_transactions (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade,
    seller_id uuid not null,  -- deferred FK -> profiles_seller(id)
    amount_cents bigint not null,
    status text default 'held'
        constraint escrow_transactions_status_check
        check (status in ('held', 'released', 'refunded')),
    released_at timestamptz,
    release_reason text,
    dispute_id uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.reviews (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade,
    buyer_id uuid not null,  -- deferred FK -> profiles_buyer(id)
    order_id uuid,           -- live schema has no FK here; kept as-is
    rating integer not null
        constraint reviews_rating_check check (rating >= 1 and rating <= 5),
    title text,
    content text,
    is_verified_purchase boolean default false,
    is_anonymous boolean default false,
    helpful_count integer default 0,
    status text default 'approved'
        constraint reviews_status_check
        check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table public.conversations (
    id uuid default gen_random_uuid() primary key,
    type varchar(50) not null default 'general',
    subject varchar(255),
    participants uuid[] not null,
    last_message_at timestamptz default now(),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.conversation_keys (
    id varchar(255) primary key,
    participant1_id uuid not null,
    participant2_id uuid not null,
    encrypted_key text not null,
    created_at timestamptz default now()
);

create table public.messages (
    id uuid default gen_random_uuid() primary key,
    sender_id uuid not null,     -- deferred FK -> auth.users(id)
    recipient_id uuid not null,  -- deferred FK -> auth.users(id)
    content text not null,
    message_type text default 'text'
        constraint messages_message_type_check
        check (message_type in ('text', 'image', 'order_inquiry', 'system')),
    order_id uuid,
    read_at timestamptz,
    is_encrypted boolean default false,
    encryption_iv text,
    conversation_key_id varchar(255),
    conversation_id uuid references public.conversations(id),
    is_read boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.message_attachments (
    id uuid default gen_random_uuid() primary key,
    message_id uuid not null references public.messages(id) on delete cascade,
    file_path text not null,
    file_name text not null,
    file_size bigint,
    mime_type text,
    created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- User support tables
-- ---------------------------------------------------------------------------

create table public.addresses (
    id uuid default gen_random_uuid() primary key,
    user_id uuid,  -- deferred FK -> auth.users(id)
    nickname text,
    is_default boolean default false,
    type text default 'shipping'
        constraint addresses_type_check
        check (type in ('shipping', 'billing', 'both')),
    first_name text not null,
    last_name text not null,
    company text,
    address_line1 text not null,
    address_line2 text,
    city text not null,
    state_province text,
    postal_code text not null,
    country text not null,
    phone text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- NOTE: live schema stores notifications ids/user_id as varchar (legacy).
-- Preserved as-is so the data migration is lossless; uuid conversion is a
-- flagged architectural-review item.
create table public.notifications (
    id varchar default gen_random_uuid() primary key,
    user_id varchar not null,
    type varchar not null
        constraint notifications_type_check
        check (type in ('message', 'order', 'promo', 'system', 'payment', 'shipping')),
    title varchar not null,
    message text not null,
    read boolean default false,
    action_url varchar,
    metadata jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- KYC
-- ---------------------------------------------------------------------------

create table public.kyc_documents (
    id uuid default gen_random_uuid() primary key,
    seller_id uuid not null,  -- deferred FK -> profiles_seller(id)
    document_type text not null
        constraint kyc_documents_document_type_check
        check (document_type in ('identity', 'business_license', 'tax_document',
                                 'address_proof', 'bank_statement')),
    file_path text not null,
    file_name text not null,
    file_size bigint,
    mime_type text,
    verification_status text default 'pending'
        constraint kyc_documents_verification_status_check
        check (verification_status in ('pending', 'approved', 'rejected')),
    rejection_reason text,
    uploaded_at timestamptz default now(),
    reviewed_at timestamptz,
    reviewed_by uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.kyc_verification_requests (
    id uuid default gen_random_uuid() primary key,
    seller_id uuid not null unique,  -- deferred FK -> profiles_seller(id)
    verification_status text default 'pending'
        constraint kyc_verification_requests_verification_status_check
        check (verification_status in ('pending', 'under_review', 'approved',
                                       'rejected', 'incomplete')),
    submission_date timestamptz default now(),
    review_date timestamptz,
    reviewer_notes text,
    required_documents text[] default array['identity'::text, 'business_license'::text],
    submitted_documents text[] default array[]::text[],
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Marketing / CMS / admin
-- ---------------------------------------------------------------------------

create table public.featured_products (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade,
    marketplace_brand text not null
        constraint featured_products_marketplace_brand_check
        check (marketplace_brand in ('entiznetstore', 'primediscreet')),
    feature_type text not null
        constraint featured_products_feature_type_check
        check (feature_type in ('hero', 'spotlight', 'sale', 'new_arrival', 'trending')),
    title text,
    description text,
    image_url text,
    link_url text,
    sort_order integer default 0,
    is_active boolean default true,
    starts_at timestamptz default now(),
    ends_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.content_pages (
    id uuid default gen_random_uuid() primary key,
    marketplace_brand text not null
        constraint content_pages_marketplace_brand_check
        check (marketplace_brand in ('entiznetstore', 'primediscreet')),
    page_key text not null,
    title text not null,
    content text,
    metadata jsonb default '{}'::jsonb,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (marketplace_brand, page_key)
);

create table public.admin_audit_logs (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid not null,  -- deferred FK -> auth.users(id)
    action varchar(100) not null,
    target_type varchar(50) not null,
    target_id varchar(255) not null,
    metadata jsonb,
    "timestamp" timestamptz not null default now(),
    created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (carried over from the verified live schema)
-- ---------------------------------------------------------------------------

create index idx_admin_audit_logs_action on public.admin_audit_logs (action);
create index idx_admin_audit_logs_admin_id on public.admin_audit_logs (admin_id);
create index idx_admin_audit_logs_timestamp on public.admin_audit_logs ("timestamp");
create index idx_content_pages_active on public.content_pages (is_active);
create index idx_content_pages_brand on public.content_pages (marketplace_brand);
create index idx_content_pages_key on public.content_pages (page_key);
create index idx_conversation_keys_participants on public.conversation_keys (participant1_id, participant2_id);
create index idx_escrow_order_id on public.escrow_transactions (order_id);
create index idx_escrow_seller_id on public.escrow_transactions (seller_id);
create index idx_featured_products_active on public.featured_products (is_active);
create index idx_featured_products_brand on public.featured_products (marketplace_brand);
create index idx_featured_products_dates on public.featured_products (starts_at, ends_at);
create index idx_featured_products_type on public.featured_products (feature_type);
create index idx_kyc_documents_seller_id on public.kyc_documents (seller_id);
create index idx_kyc_documents_status on public.kyc_documents (verification_status);
create index idx_kyc_verification_seller_id on public.kyc_verification_requests (seller_id);
create index idx_kyc_verification_status on public.kyc_verification_requests (verification_status);
create index idx_message_attachments_message_id on public.message_attachments (message_id);
create index idx_messages_conversation_key on public.messages (conversation_key_id);
create index idx_messages_created_at on public.messages (created_at);
create index idx_messages_recipient_id on public.messages (recipient_id);
create index idx_messages_sender_id on public.messages (sender_id);
create index idx_notifications_created_at on public.notifications (created_at desc);
create index idx_notifications_read on public.notifications (read);
create index idx_notifications_type on public.notifications (type);
create index idx_notifications_user_id on public.notifications (user_id);
create index idx_order_items_order_id on public.order_items (order_id);
create index idx_order_items_product_id on public.order_items (product_id);
create index idx_orders_buyer_id on public.orders (buyer_id);
create index idx_orders_payment_intent_id on public.orders (payment_intent_id);
create index idx_orders_seller_id on public.orders (seller_id);
create index idx_orders_status on public.orders (status);
create index idx_reviews_product_id on public.reviews (product_id);
create index idx_reviews_rating on public.reviews (rating);
create index idx_reviews_status on public.reviews (status);
-- Ownership index added for the canonical seller_id model (missing in live schema)
create index idx_products_seller_id on public.products (seller_id);
create index idx_products_status on public.products (status);

-- ---------------------------------------------------------------------------
-- Row Level Security: ENABLED on every application table.
-- No policies are created here (policy design applied in a later migration).
-- With RLS enabled and zero policies, anon/authenticated roles have NO access;
-- only the service role bypasses RLS. This is the intended locked-down default.
-- ---------------------------------------------------------------------------

alter table public.addresses enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.content_pages enable row level security;
alter table public.conversation_keys enable row level security;
alter table public.conversations enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.featured_products enable row level security;
alter table public.kyc_documents enable row level security;
alter table public.kyc_verification_requests enable row level security;
alter table public.message_attachments enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_media enable row level security;
alter table public.product_variants enable row level security;
alter table public.products enable row level security;
alter table public.profiles_buyer enable row level security;
alter table public.profiles_seller enable row level security;
alter table public.reviews enable row level security;
