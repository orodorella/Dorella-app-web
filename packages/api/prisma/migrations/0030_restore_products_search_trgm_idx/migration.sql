-- Restores the trigram search indexes on products that were dropped in error
-- by an out-of-band migration (20260803011539_sync_mercadopago_payment_fields,
-- generated against a stale local dev DB on a long-lived feature branch and
-- applied directly to production). Recreated exactly as they were originally
-- defined in 0018_products_nombre_trgm_idx / 0019_products_sku_trgm_idx.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "products_nombre_trgm_idx" ON "products" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "products_sku_trgm_idx" ON "products" USING gin ("sku" gin_trgm_ops);
