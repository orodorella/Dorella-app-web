CREATE INDEX CONCURRENTLY "products_nombre_trgm_idx" ON "products" USING gin ("nombre" gin_trgm_ops);
