CREATE INDEX CONCURRENTLY "products_sku_trgm_idx" ON "products" USING gin ("sku" gin_trgm_ops);
