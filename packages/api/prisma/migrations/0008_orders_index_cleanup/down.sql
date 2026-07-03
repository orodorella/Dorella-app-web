CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_order_number_idx" ON "orders"("order_number");
