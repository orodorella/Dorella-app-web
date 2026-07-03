ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_stock_reservado_le_stock";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_descuento_aplicado_range";
