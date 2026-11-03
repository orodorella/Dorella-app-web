-- ROLL-FORWARD: devuelve a cada usuario el rol que tenía antes de rollback-roles.sql (solo si sigue siendo 'cliente',
-- para no pisar cambios hechos entre tanto). Requiere que el código nuevo ya esté desplegado. Idempotente.
BEGIN;
UPDATE users u SET role = s.role_before::"Role"
  FROM role_rollback_snapshot s
  WHERE s.user_id = u.id AND u.role::text = 'cliente';
COMMIT;
