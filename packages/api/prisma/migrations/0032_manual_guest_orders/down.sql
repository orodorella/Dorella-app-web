DROP INDEX IF EXISTS "orders_created_by_admin_id_idx";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_created_by_admin_id_fkey";
DELETE FROM "orders" WHERE "user_id" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "orders"
  DROP COLUMN "created_by_admin_id",
  DROP COLUMN "origen",
  DROP COLUMN "comprador_email",
  DROP COLUMN "comprador_telefono",
  DROP COLUMN "comprador_apellido",
  DROP COLUMN "comprador_nombre";
