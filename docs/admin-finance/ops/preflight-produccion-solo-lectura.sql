-- PRE-VUELO DE MIGRACIONES 0037–0044 — SOLO LECTURA (ningún INSERT/UPDATE/DELETE/DDL).
-- Ejecutar contra PRODUCCIÓN (con autorización) ANTES de migrar:  psql "$DIRECT_URL" -f preflight-produccion-solo-lectura.sql
-- Criterio: todas las comprobaciones marcadas OK; si alguna dice REVISAR, NO migrar.
\set ON_ERROR_STOP on
BEGIN READ ONLY;

\echo '== 1. Estado de migraciones (esperado: última aplicada = 0036_order_items_descuento_adicional, ninguna sin terminar)'
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 6;
SELECT CASE WHEN count(*) = 0 THEN 'OK: ninguna migración sin terminar' ELSE 'REVISAR: hay migraciones sin terminar' END AS sin_terminar
  FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
SELECT CASE WHEN max(migration_name) FILTER (WHERE migration_name ~ '^00') = '0036_order_items_descuento_adicional'
            THEN 'OK: la última migración numerada es la 0036' ELSE 'REVISAR: última migración numerada = ' || coalesce(max(migration_name) FILTER (WHERE migration_name ~ '^00'), 'ninguna') END AS ultima
  FROM _prisma_migrations WHERE finished_at IS NOT NULL;
\echo '-- Migraciones aplicadas fuera del repo (p. ej. 20260803011539_sync_mercadopago_payment_fields, citada en la 0030); informativo:'
SELECT migration_name FROM _prisma_migrations WHERE migration_name !~ '^00' ORDER BY started_at;

\echo '== 2. El esquema aún NO tiene lo de 0037–0044 (esperado: todo NULL / false)'
SELECT to_regclass('public.audit_log') AS audit_log, to_regclass('public.commission_entries') AS commission_entries,
       to_regclass('public.product_costs') AS product_costs, to_regclass('public.expenses') AS expenses,
       to_regclass('public.inventory_lots') AS inventory_lots, to_regclass('public.app_settings') AS app_settings;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('seller_id', 'seller_role')) AS orders_ya_tiene_columnas_nuevas;
SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) AS enum_role_actual FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role';

\echo '== 3. Línea base de conteos (guardar; tras migrar deben ser idénticos)'
SELECT 'users' AS tabla, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items UNION ALL SELECT 'categories', count(*) FROM categories;
SELECT 'stock_total' AS metrica, coalesce(sum(stock), 0) AS valor FROM products UNION ALL SELECT 'stock_reservado', coalesce(sum(stock_reservado), 0) FROM products;
SELECT role::text AS rol, count(*) FROM users GROUP BY 1 ORDER BY 1;

\echo '== 4. Versión y tamaño (informativo para la ventana de migración)'
SELECT version();
SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano_bd;

ROLLBACK;
