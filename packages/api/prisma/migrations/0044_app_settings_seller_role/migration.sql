-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "seller_role" VARCHAR(20);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);


-- Índice parcial: el trabajador de costeo busca cada minuto líneas aún no evaluadas (costo_metodo IS NULL).
-- No representable en schema.prisma. Rollback: eliminar el índice.
CREATE INDEX "order_items_costo_metodo_pendiente_idx" ON "order_items"("order_id") WHERE "costo_metodo" IS NULL;

-- Rollback: quitar orders.seller_role y eliminar app_settings. Aditiva: no altera datos existentes.
