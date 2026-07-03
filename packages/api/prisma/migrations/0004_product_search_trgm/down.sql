DROP INDEX CONCURRENTLY IF EXISTS "products_sku_trgm_idx";
DROP INDEX CONCURRENTLY IF EXISTS "products_nombre_trgm_idx";
-- No se hace DROP EXTENSION pg_trgm: otra migración/objeto podría depender de ella.
