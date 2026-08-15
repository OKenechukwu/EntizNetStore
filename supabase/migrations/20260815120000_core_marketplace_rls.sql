-- Module 1C-4B4 — Core marketplace RLS policies.
-- Policies ONLY for the 9 approved tables. All other tables keep RLS enabled
-- with zero policies (deny-by-default). Writes to categories/brands and all
-- profile creation remain trusted-server (service role bypasses RLS).

-- 1. Categories: public read of active categories only.
create policy categories_public_select on public.categories
  for select to anon, authenticated
  using (is_active);

-- 2. Brands: public read.
create policy brands_public_select on public.brands
  for select to anon, authenticated
  using (true);

-- 3. Buyer profiles: owner read only.
create policy profiles_buyer_select_own on public.profiles_buyer
  for select to authenticated
  using (id = auth.uid());

-- 4. Seller profiles: owner read + public read of verified sellers only.
create policy profiles_seller_select_own on public.profiles_seller
  for select to authenticated
  using (id = auth.uid());

create policy profiles_seller_public_select_verified on public.profiles_seller
  for select to anon, authenticated
  using (verification_status = 'verified');

-- 5. Seller private profile: owner read only. No public access, no writes.
create policy profiles_seller_private_select_own on public.profiles_seller_private
  for select to authenticated
  using (seller_id = auth.uid());

-- 6. Products: public read only for active products of verified sellers.
--    NULL-seller products are explicitly excluded.
create policy products_public_select on public.products
  for select to anon, authenticated
  using (
    status = 'active'
    and seller_id is not null
    and exists (
      select 1 from public.profiles_seller s
      where s.id = products.seller_id
        and s.verification_status = 'verified'
    )
  );

-- 7. Products: seller ownership.
create policy products_seller_select_own on public.products
  for select to authenticated
  using (seller_id = auth.uid());

create policy products_seller_insert_own on public.products
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and exists (
      select 1 from public.profiles_seller s
      where s.id = auth.uid()
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  );

create policy products_seller_update_own on public.products
  for update to authenticated
  using (
    seller_id = auth.uid()
    and exists (
      select 1 from public.profiles_seller s
      where s.id = auth.uid()
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  )
  with check (
    seller_id = auth.uid()
    and exists (
      select 1 from public.profiles_seller s
      where s.id = auth.uid()
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  );

create policy products_seller_delete_own on public.products
  for delete to authenticated
  using (seller_id = auth.uid());

-- 8. Product children: visibility/ownership follows the parent product.

-- product_variants
create policy product_variants_public_select on public.product_variants
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );

create policy product_variants_seller_all on public.product_variants
  for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = auth.uid()
    )
  );

-- product_media
create policy product_media_public_select on public.product_media
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );

create policy product_media_seller_all on public.product_media
  for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id and p.seller_id = auth.uid()
    )
  );

-- product_categories
create policy product_categories_public_select on public.product_categories
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );

create policy product_categories_seller_all on public.product_categories
  for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id and p.seller_id = auth.uid()
    )
  );
