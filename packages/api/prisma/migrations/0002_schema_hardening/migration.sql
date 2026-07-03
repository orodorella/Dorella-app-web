-- CHECK constraints: guard against corrupt order/inventory data reaching the DB
-- even if application-layer validation is ever bypassed.
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cantidad_positive" CHECK ("cantidad" > 0) NOT VALID;
ALTER TABLE "order_items" VALIDATE CONSTRAINT "order_items_cantidad_positive";

ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonneg" CHECK ("stock" >= 0) NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_stock_nonneg";

ALTER TABLE "products" ADD CONSTRAINT "products_stock_reservado_nonneg" CHECK ("stock_reservado" >= 0) NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_stock_reservado_nonneg";

-- Missing FK-supporting indexes
CREATE INDEX CONCURRENTLY "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX CONCURRENTLY "tier_change_log_changed_by_idx" ON "tier_change_log"("changed_by");
CREATE INDEX CONCURRENTLY "users_tier_changed_by_idx" ON "users"("tier_changed_by");
CREATE INDEX CONCURRENTLY "user_rewards_milestone_id_idx" ON "user_rewards"("milestone_id");

-- Remove duplicate indexes (the @unique constraint already provides one)
DROP INDEX CONCURRENTLY IF EXISTS "products_sku_idx";
DROP INDEX CONCURRENTLY IF EXISTS "refresh_tokens_token_idx";

-- New FK relations for audit-trail actor columns
ALTER TABLE "tier_change_log" ADD CONSTRAINT "tier_change_log_changed_by_fkey"
  FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "tier_change_log" VALIDATE CONSTRAINT "tier_change_log_changed_by_fkey";

ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_delivered_by_fkey"
  FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "user_rewards" VALIDATE CONSTRAINT "user_rewards_delivered_by_fkey";
