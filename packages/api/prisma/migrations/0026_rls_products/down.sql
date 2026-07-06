REVOKE SELECT ON products_public FROM anon, authenticated;
DROP VIEW IF EXISTS products_public;

GRANT SELECT ON products TO anon, authenticated;

DROP POLICY IF EXISTS "products_public_read" ON products;
ALTER TABLE products NO FORCE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
