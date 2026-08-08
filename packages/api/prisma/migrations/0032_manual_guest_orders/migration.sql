ALTER TABLE "orders"
  ADD COLUMN "comprador_nombre" VARCHAR(255),
  ADD COLUMN "comprador_apellido" VARCHAR(255),
  ADD COLUMN "comprador_telefono" VARCHAR(20),
  ADD COLUMN "comprador_email" VARCHAR(255),
  ADD COLUMN "origen" VARCHAR(20) NOT NULL DEFAULT 'tienda',
  ADD COLUMN "created_by_admin_id" UUID;

UPDATE "orders" AS o
SET
  "comprador_nombre" = u."nombre",
  "comprador_apellido" = u."apellido",
  "comprador_telefono" = COALESCE(u."telefono", ''),
  "comprador_email" = u."email"
FROM "users" AS u
WHERE o."user_id" = u."id";

ALTER TABLE "orders"
  ALTER COLUMN "comprador_nombre" SET NOT NULL,
  ALTER COLUMN "comprador_apellido" SET NOT NULL,
  ALTER COLUMN "comprador_telefono" SET NOT NULL,
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_created_by_admin_id_idx" ON "orders"("created_by_admin_id");
