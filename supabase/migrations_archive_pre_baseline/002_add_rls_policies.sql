
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow ENABLE ROW LEVEL SECURITY;

-- Policies for products
CREATE POLICY select_products ON products
    FOR SELECT
    USING (auth.uid() = provider_id);

CREATE POLICY modify_own_products ON products
    FOR ALL
    USING (auth.uid() = provider_id);

-- Policies for orders
CREATE POLICY select_orders ON orders
    FOR SELECT
    USING (auth.uid() = buyer_id);

CREATE POLICY modify_own_orders ON orders
    FOR ALL
    USING (auth.uid() = buyer_id);

-- Policy for escrow updates
CREATE POLICY update_escrow ON escrow
    FOR UPDATE
    USING (auth.role() = 'admin');
