
-- Function to create orders and escrow
CREATE OR REPLACE FUNCTION create_order(product_id uuid, quantity int)
RETURNS void AS $$
BEGIN
    -- Insert into orders
    INSERT INTO orders (id, buyer_id, product_id, quantity, total_price, status, created_at)
    VALUES (uuid_generate_v4(), auth.uid(), product_id, quantity, NULL, 'pending', now());

    -- Logic to calculate the total price and hold amount in escrow can be added
END;
$$ LANGUAGE plpgsql;

-- Function to mark orders as delivered
CREATE OR REPLACE FUNCTION mark_delivered(order_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE orders SET status = 'delivered' WHERE id = order_id AND buyer_id = auth.uid();
    -- Logic to release escrow
END;
$$ LANGUAGE plpgsql;

-- Function to raise disputes
CREATE OR REPLACE FUNCTION raise_dispute(order_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE orders SET status = 'disputed' WHERE id = order_id AND buyer_id = auth.uid();
END;
$$ LANGUAGE plpgsql;
