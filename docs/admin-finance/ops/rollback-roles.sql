-- ROLLBACK DE CÓDIGO: neutraliza los roles nuevos para que el backend anterior (sin 'comercial'/'bodega' en el enum Role)
-- no falle al leer esas filas (ver docs/admin-finance/11-plan-publicacion-y-rollback.md §5).
-- Es idempotente, transaccional y REVERSIBLE: guarda el rol original en role_rollback_snapshot y los pasa a 'cliente'
-- (mínimo privilegio). El backend anterior lee el rol desde la BD en cada petición, por lo que surte efecto al instante.
-- Ejecutar SOLO contra la base que corresponda y tras un respaldo. No altera pedidos, comisiones ni ningún otro dato.
BEGIN;
CREATE TABLE IF NOT EXISTS role_rollback_snapshot (
  user_id     uuid PRIMARY KEY,
  role_before text NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO role_rollback_snapshot (user_id, role_before)
  SELECT id, role::text FROM users WHERE role::text IN ('comercial', 'bodega')
  ON CONFLICT (user_id) DO NOTHING;
UPDATE users SET role = 'cliente' WHERE role::text IN ('comercial', 'bodega');
-- Comprobación: no debe quedar ningún usuario con roles nuevos
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role::text IN ('comercial', 'bodega')) THEN
    RAISE EXCEPTION 'Quedan usuarios con roles nuevos';
  END IF;
END $$;
COMMIT;
