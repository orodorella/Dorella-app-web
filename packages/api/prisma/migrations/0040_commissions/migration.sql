-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('accrued', 'paid', 'voided');

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('pending', 'paid');

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tier" "Tier" NOT NULL,
    "user_id" UUID,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "tier" "Tier" NOT NULL,
    "base" DECIMAL(15,2) NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "rule_id" UUID,
    "status" "CommissionStatus" NOT NULL DEFAULT 'accrued',
    "accrued_at" TIMESTAMPTZ(3) NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "liquidation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_liquidations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "ajustes" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'pending',
    "notas" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),
    "paid_by" UUID,

    CONSTRAINT "commission_liquidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "entry_id" UUID,
    "liquidation_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_rules_tier_user_id_valid_from_idx" ON "commission_rules"("tier", "user_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "commission_entries_order_id_key" ON "commission_entries"("order_id");

-- CreateIndex
CREATE INDEX "commission_entries_seller_id_status_accrued_at_idx" ON "commission_entries"("seller_id", "status", "accrued_at");

-- CreateIndex
CREATE INDEX "commission_entries_liquidation_id_idx" ON "commission_entries"("liquidation_id");

-- CreateIndex
CREATE INDEX "commission_liquidations_seller_id_period_from_idx" ON "commission_liquidations"("seller_id", "period_from");

-- CreateIndex
CREATE INDEX "commission_liquidations_status_idx" ON "commission_liquidations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "commission_adjustments_entry_id_key" ON "commission_adjustments"("entry_id");

-- CreateIndex
CREATE INDEX "commission_adjustments_seller_id_liquidation_id_idx" ON "commission_adjustments"("seller_id", "liquidation_id");

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_liquidation_id_fkey" FOREIGN KEY ("liquidation_id") REFERENCES "commission_liquidations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_liquidations" ADD CONSTRAINT "commission_liquidations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "commission_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_liquidation_id_fkey" FOREIGN KEY ("liquidation_id") REFERENCES "commission_liquidations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integridad adicional (no representable en schema.prisma):
-- porcentaje entre 0 y 100 y una sola regla vigente por (modalidad, comercial/general).
-- Rollback: DROP de las cuatro tablas commission_* y de los tipos CommissionStatus / LiquidationStatus.
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_porcentaje_check" CHECK ("porcentaje" >= 0 AND "porcentaje" <= 100);
CREATE UNIQUE INDEX "commission_rules_one_open_rule_idx" ON "commission_rules"("tier", COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "valid_to" IS NULL;
