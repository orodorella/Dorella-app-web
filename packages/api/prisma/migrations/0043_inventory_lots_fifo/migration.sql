-- CreateEnum
CREATE TYPE "LotType" AS ENUM ('compra', 'valoracion_inicial');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('compra', 'valoracion_inicial', 'venta', 'devolucion', 'ajuste');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "costo_metodo" VARCHAR(12),
ADD COLUMN     "costo_total_snapshot" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "tipo" "LotType" NOT NULL DEFAULT 'compra',
    "cantidad" INTEGER NOT NULL,
    "cantidad_restante" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "gastos_adicionales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_unitario_efectivo" DECIMAL(14,4) NOT NULL,
    "proveedor" VARCHAR(255),
    "fecha_compra" DATE NOT NULL,
    "referencia" VARCHAR(120),
    "observaciones" TEXT,
    "clave_idempotencia" VARCHAR(80),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_consumptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "costo_total" DECIMAL(15,2) NOT NULL,
    "reversed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "lot_id" UUID,
    "order_item_id" UUID,
    "tipo" "MovementType" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(14,4),
    "motivo" VARCHAR(500),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_clave_idempotencia_key" ON "inventory_lots"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "inventory_lots_product_id_fecha_compra_created_at_idx" ON "inventory_lots"("product_id", "fecha_compra", "created_at");

-- CreateIndex
CREATE INDEX "lot_consumptions_order_item_id_idx" ON "lot_consumptions"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "lot_consumptions_lot_id_order_item_id_key" ON "lot_consumptions"("lot_id", "order_item_id");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_lot_id_idx" ON "inventory_movements"("lot_id");

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integridad adicional (no representable en schema.prisma).
-- Rollback: eliminar lot_consumptions, inventory_movements, inventory_lots y los tipos LotType/MovementType;
-- quitar order_items.costo_total_snapshot y order_items.costo_metodo.
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_cantidades_check" CHECK ("cantidad" > 0 AND "cantidad_restante" >= 0 AND "cantidad_restante" <= "cantidad");
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_costos_check" CHECK ("costo_unitario" >= 0 AND "gastos_adicionales" >= 0 AND "costo_unitario_efectivo" >= 0);
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_cantidad_check" CHECK ("cantidad" > 0);
