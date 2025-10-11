-- Create buyer_profile table
create table if not exists public.buyer_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  first_name text,
  last_name text,
  gender text,
  date_of_birth date,
  country char(2),                 -- ISO alpha-2 code (e.g., 'DE', 'PH')
  phone text,
  interests text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Constraint: enforce ISO alpha-2 (or NULL)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'buyer_profile_country_alpha2_check'
  ) then
    alter table public.buyer_profile
      add constraint buyer_profile_country_alpha2_check
      check (country is null or country ~ '^[A-Z]{2}$');
  end if;
end$$;

-- Index for fast filtering
create index if not exists idx_buyer_profile_country
  on public.buyer_profile (country);

-- Trigger: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_buyer_profile_updated_at on public.buyer_profile;
create trigger trg_buyer_profile_updated_at
before update on public.buyer_profile
for each row execute procedure public.set_updated_at();

---------------------------------------------------

-- Create seller_profile table
create table if not exists public.seller_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  storefront_name text,
  bio text,
  business_type text,              -- 'individual' | 'business' | 'creator'
  return_policy text,
  shipping_policy text,
  tax_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_seller_profile_updated_at on public.seller_profile;
create trigger trg_seller_profile_updated_at
before update on public.seller_profile
for each row execute procedure public.set_updated_at();

---------------------------------------------------

-- Enable Row Level Security
alter table public.buyer_profile enable row level security;
alter table public.seller_profile enable row level security;

-- Policies for buyer_profile
do $$
begin
  if not exists (select 1 from pg_policies where polname = 'buyer_self_select') then
    create policy buyer_self_select on public.buyer_profile
      for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'buyer_self_insert') then
    create policy buyer_self_insert on public.buyer_profile
      for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'buyer_self_update') then
    create policy buyer_self_update on public.buyer_profile
      for update using (auth.uid() = id);
  end if;
end$$;

-- Policies for seller_profile
do $$
begin
  if not exists (select 1 from pg_policies where polname = 'seller_self_select') then
    create policy seller_self_select on public.seller_profile
      for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'seller_self_insert') then
    create policy seller_self_insert on public.seller_profile
      for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'seller_self_update') then
    create policy seller_self_update on public.seller_profile
      for update using (auth.uid() = id);
  end if;
end$$;
