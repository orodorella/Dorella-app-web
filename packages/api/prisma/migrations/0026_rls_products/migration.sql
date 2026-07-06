-- Enable Row Level Security on products table
-- precio_base is protected: only service_role (and the Express API's connection role,
-- which bypasses RLS) can see it.
-- anon and authenticated roles see all columns except precio_base, via products_public.

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read" ON products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- RLS policies filter ROWS, not COLUMNS. Without revoking direct table access,
-- anon/authenticated (reachable via the public NEXT_PUBLIC_SUPABASE_ANON_KEY exposed
-- client-side in packages/web/src/lib/supabase.ts) could still SELECT precio_base
-- straight off products. Route them through the column-restricted view instead.
REVOKE SELECT ON products FROM anon, authenticated;

CREATE OR REPLACE VIEW products_public AS
  SELECT
    id, sku, nombre, descripcion, category_id,
    imagenes, peso_gramos, material, stock,
    is_active, is_featured, tags,
    alegra_item_id, created_at, updated_at
  FROM products;

GRANT SELECT ON products_public TO anon, authenticated;
