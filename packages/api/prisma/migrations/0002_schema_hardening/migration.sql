-- CHECK constraints: guard against corrupt order/inventory data reaching the DB
-- even if application-layer validation is ever bypassed.
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cantidad_positive" CHECK ("cantidad" > 0) NOT VALID;
ALTER TABLE "order_items" VALIDATE CONSTRAINT "order_items_cantidad_positive";

ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonneg" CHECK ("stock" >= 0) NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_stock_nonneg";

ALTER TABLE "products" ADD CONSTRAINT "products_stock_reservado_nonneg" CHECK ("stock_reservado" >= 0) NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_stock_reservado_nonneg";

-- New FK relations for audit-trail actor columns
ALTER TABLE "tier_change_log" ADD CONSTRAINT "tier_change_log_changed_by_fkey"
  FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "tier_change_log" VALIDATE CONSTRAINT "tier_change_log_changed_by_fkey";

ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_delivered_by_fkey"
  FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "user_rewards" VALIDATE CONSTRAINT "user_rewards_delivered_by_fkey";
