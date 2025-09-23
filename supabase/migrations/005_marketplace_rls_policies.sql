-- 005_marketplace_rls_policies.sql
-- RLS policies for marketplace tables

-- Profiles - users can only see/edit their own
CREATE POLICY "Users can view their own buyer profile" ON profiles_buyer
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own buyer profile" ON profiles_buyer
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own buyer profile" ON profiles_buyer
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own seller profile" ON profiles_seller
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own seller profile" ON profiles_seller
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own seller profile" ON profiles_seller
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Public can view verified seller profiles
CREATE POLICY "Public can view verified seller profiles" ON profiles_seller
  FOR SELECT USING (verification_status = 'verified');

-- Addresses - users can only manage their own
CREATE POLICY "Users can manage their own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

-- Categories - public read access
CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT USING (is_active = true);

-- Brands - public read access
CREATE POLICY "Public can view brands" ON brands
  FOR SELECT USING (true);

-- Products - sellers can manage their own, public can view active
CREATE POLICY "Sellers can manage their own products" ON products
  FOR ALL USING (auth.uid() = seller_id);

CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (status = 'active');

-- Product categories - public read access
CREATE POLICY "Public can view product categories" ON product_categories
  FOR SELECT USING (true);

-- Product variants - sellers can manage their own, public can view active
CREATE POLICY "Sellers can manage their own variants" ON product_variants
  FOR ALL USING (auth.uid() = (SELECT seller_id FROM products WHERE id = product_id));

CREATE POLICY "Public can view active variants" ON product_variants
  FOR SELECT USING (is_active = true AND EXISTS (
    SELECT 1 FROM products WHERE id = product_id AND status = 'active'
  ));

-- Product media - sellers can manage their own, public can view
CREATE POLICY "Sellers can manage their own product media" ON product_media
  FOR ALL USING (auth.uid() = (SELECT seller_id FROM products WHERE id = product_id));

CREATE POLICY "Public can view product media" ON product_media
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM products WHERE id = product_id AND status = 'active'
  ));

-- Reviews - buyers can manage their own, public can view approved
CREATE POLICY "Buyers can manage their own reviews" ON reviews
  FOR ALL USING (auth.uid() = buyer_id);

CREATE POLICY "Public can view approved reviews" ON reviews
  FOR SELECT USING (status = 'approved');

-- Wishlists - users can only manage their own
CREATE POLICY "Users can manage their own wishlists" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- Recently viewed - users can only manage their own
CREATE POLICY "Users can manage their own recently viewed" ON recently_viewed
  FOR ALL USING (auth.uid() = user_id);

-- Digital assets - sellers can manage their own
CREATE POLICY "Sellers can manage their own digital assets" ON digital_assets
  FOR ALL USING (auth.uid() = (SELECT seller_id FROM products WHERE id = product_id));

-- Orders - buyers and sellers can view relevant orders
CREATE POLICY "Buyers can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their orders" ON orders
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update their orders" ON orders
  FOR UPDATE USING (auth.uid() = buyer_id);

-- Order items - same as orders
CREATE POLICY "Order participants can view order items" ON order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_id 
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  ));

-- Escrow - admin and participants can view
CREATE POLICY "Order participants can view escrow" ON escrow_transactions
  FOR SELECT USING (auth.uid() = seller_id OR EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_id AND o.buyer_id = auth.uid()
  ));

-- Shipping profiles - sellers can manage their own
CREATE POLICY "Sellers can manage their shipping profiles" ON shipping_profiles
  FOR ALL USING (auth.uid() = seller_id);

-- Conversations - participants can view
CREATE POLICY "Participants can view their conversations" ON conversations
  FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

-- Messages - conversation participants can view/create
CREATE POLICY "Participants can view conversation messages" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id 
    AND auth.uid() = ANY(c.participants)
  ));

CREATE POLICY "Participants can create messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = conversation_id 
    AND auth.uid() = ANY(c.participants)
  ));

-- Inventory - sellers can manage their own
CREATE POLICY "Sellers can manage inventory" ON inventory_levels
  FOR ALL USING (EXISTS (
    SELECT 1 FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = variant_id AND p.seller_id = auth.uid()
  ));