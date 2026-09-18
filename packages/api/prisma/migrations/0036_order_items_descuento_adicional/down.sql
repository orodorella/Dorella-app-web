ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_descuento_adicional_range";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "descuento_adicional";
