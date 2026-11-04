-- Aditiva: agrega el estado "preparado" (bodega empacó el pedido, aún no se
-- despachó) entre "confirmed" y "shipped". No altera filas existentes; las
-- órdenes ya creadas conservan su estado actual.
-- Rollback: Postgres no permite quitar valores de un enum; un valor sin uso
-- es inocuo, así que no hay down.sql (mismo criterio que 0037_role_comercial_bodega).
--
-- NO EJECUTAR CONTRA PRODUCCIÓN SIN AUTORIZACIÓN EXPLÍCITA.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'preparado';
