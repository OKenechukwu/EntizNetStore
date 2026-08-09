-- Add marketplace_brand field to products table for dual brand architecture
-- This allows products to be categorized under EntizNetStore or PrimeDiscreet

ALTER TABLE products 
ADD COLUMN marketplace_brand text CHECK (marketplace_brand IN ('entiznetstore', 'primediscreet')) DEFAULT 'entiznetstore';

-- Add index for faster querying by marketplace brand
CREATE INDEX idx_products_marketplace_brand ON products(marketplace_brand);

-- Update existing products to have default brand
UPDATE products SET marketplace_brand = 'entiznetstore' WHERE marketplace_brand IS NULL;

-- Make the field NOT NULL after setting defaults
ALTER TABLE products ALTER COLUMN marketplace_brand SET NOT NULL;