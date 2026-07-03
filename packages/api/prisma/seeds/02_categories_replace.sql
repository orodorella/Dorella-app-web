-- PASO 2: Reemplaza las 8 categorías placeholder (Aretes, Cadenas, Anillos, Pulseras,
-- Dijes, Conjuntos, Tobilleras, Broches del seed.ts original) por las 8 categorías
-- reales del negocio. Slugs compartidos (dijes, pulseras, tobilleras) se actualizan
-- in-place vía ON CONFLICT en vez de duplicarse.

-- Elimina las categorías incorrectas SOLO si no tienen productos asociados
DELETE FROM categories
WHERE slug IN ('aretes', 'cadenas', 'anillos', 'conjuntos', 'broches')
  AND NOT EXISTS (SELECT 1 FROM products WHERE products.category_id = categories.id);

-- Inserta (o actualiza si el slug ya existía) las 8 categorías reales
INSERT INTO categories (id, nombre, slug, orden, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Topos y Candongas', 'topos-y-candongas', 1, true, now(), now()),
  (gen_random_uuid(), 'Herrajes',          'herrajes',          2, true, now(), now()),
  (gen_random_uuid(), 'Balinería',         'balineria',         3, true, now(), now()),
  (gen_random_uuid(), 'Dijes',             'dijes',             4, true, now(), now()),
  (gen_random_uuid(), 'Cadenería',         'cadeneria',         5, true, now(), now()),
  (gen_random_uuid(), 'Pulseras',          'pulseras',          6, true, now(), now()),
  (gen_random_uuid(), 'Tobilleras',        'tobilleras',        7, true, now(), now()),
  (gen_random_uuid(), 'Insumos',           'insumos',           8, true, now(), now())
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  orden = EXCLUDED.orden,
  is_active = true,
  updated_at = now();

-- Verificación rápida (opcional, para correr después manualmente):
-- SELECT id, nombre, slug, orden FROM categories ORDER BY orden;
