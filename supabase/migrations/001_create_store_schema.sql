
-- Create products table
CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id uuid REFERENCES auth.users(id),
    title text NOT NULL,
    description text NOT NULL,
    price numeric NOT NULL,
    images text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id uuid REFERENCES auth.users(id),
    product_id uuid REFERENCES products(id),
    quantity int DEFAULT 1,
    total_price numeric NOT NULL,
    status text CHECK (status IN ('pending', 'paid', 'delivered', 'disputed', 'refunded')) DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

-- Create escrow table
CREATE TABLE escrow (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id uuid REFERENCES orders(id),
    held_amount numeric NOT NULL,
    released boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
