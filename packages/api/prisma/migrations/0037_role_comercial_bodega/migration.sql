-- Aditiva: agrega los roles de personal. No altera filas existentes.
-- Rollback: Postgres no permite quitar valores de un enum; los valores sin uso son inocuos.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'comercial';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'bodega';
