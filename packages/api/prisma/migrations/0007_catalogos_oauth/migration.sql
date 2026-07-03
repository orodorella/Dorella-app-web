-- PASO 1: Migración pendiente — tablas Catalogo/CatalogoProducto + OAuth en users
-- Estas tablas y columnas existen en schema.prisma pero nunca se aplicaron a la DB real
-- (drift detectado en el audit: M6.schema_drift_no_migration_for_new_models).

-- 1. Tabla catalogos (catálogos white-label por distribuidor)
CREATE TABLE "catalogos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "nombre" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "configuracion" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "catalogos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogos_slug_key" ON "catalogos"("slug");
CREATE INDEX "catalogos_user_id_idx" ON "catalogos"("user_id");

ALTER TABLE "catalogos" ADD CONSTRAINT "catalogos_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Tabla catalogo_productos (productos dentro de cada catálogo, con precio personalizado)
CREATE TABLE "catalogo_productos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "catalogo_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "precio_personalizado" DECIMAL(12,2),
  "orden" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "catalogo_productos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogo_productos_catalogo_id_product_id_key" ON "catalogo_productos"("catalogo_id", "product_id");
CREATE INDEX "catalogo_productos_catalogo_id_idx" ON "catalogo_productos"("catalogo_id");
CREATE INDEX "catalogo_productos_product_id_idx" ON "catalogo_productos"("product_id");

ALTER TABLE "catalogo_productos" ADD CONSTRAINT "catalogo_productos_catalogo_id_fkey"
  FOREIGN KEY ("catalogo_id") REFERENCES "catalogos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalogo_productos" ADD CONSTRAINT "catalogo_productos_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Columna provider en users (soporte OAuth, default 'email' para usuarios existentes)
ALTER TABLE "users" ADD COLUMN "provider" VARCHAR(20) NOT NULL DEFAULT 'email';

-- 4. password_hash nullable (usuarios OAuth no tienen password propio)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
