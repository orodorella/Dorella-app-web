-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "costo_unitario_snapshot" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "product_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "costo_adquisicion" DECIMAL(12,2) NOT NULL,
    "costo_adicional" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_total" DECIMAL(12,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "notas" VARCHAR(500),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_costs_product_id_valid_from_idx" ON "product_costs"("product_id", "valid_from" DESC);

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integridad adicional: costos no negativos y total coherente.
-- Rollback: quitar la columna order_items.costo_unitario_snapshot y eliminar la tabla product_costs.
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_nonnegative_check" CHECK ("costo_adquisicion" >= 0 AND "costo_adicional" >= 0 AND "costo_total" = "costo_adquisicion" + "costo_adicional");
