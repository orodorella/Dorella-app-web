ALTER TABLE "user_rewards" DROP CONSTRAINT IF EXISTS "user_rewards_delivered_by_fkey";
ALTER TABLE "tier_change_log" DROP CONSTRAINT IF EXISTS "tier_change_log_changed_by_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_stock_reservado_nonneg";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_stock_nonneg";
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_cantidad_positive";
