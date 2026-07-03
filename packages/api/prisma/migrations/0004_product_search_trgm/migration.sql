-- Habilita búsqueda por similitud de texto (soporta ILIKE '%term%' con índice)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY "products_nombre_trgm_idx" ON "products" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX CONCURRENTLY "products_sku_trgm_idx" ON "products" USING gin ("sku" gin_trgm_ops);
