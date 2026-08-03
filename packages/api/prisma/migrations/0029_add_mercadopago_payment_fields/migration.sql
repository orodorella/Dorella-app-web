CREATE TYPE "PaymentProvider" AS ENUM ('mercadopago');

CREATE TYPE "PaymentStatus" AS ENUM (
  'pending',
  'in_process',
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back'
);

ALTER TABLE "orders"
ADD COLUMN "payment_provider" "PaymentProvider",
ADD COLUMN "payment_status" "PaymentStatus",
ADD COLUMN "payment_preference_id" VARCHAR(100),
ADD COLUMN "payment_id" VARCHAR(100),
ADD COLUMN "payment_external_reference" VARCHAR(100),
ADD COLUMN "payment_init_point" VARCHAR(1000),
ADD COLUMN "payment_sandbox_init_point" VARCHAR(1000);

CREATE UNIQUE INDEX "orders_payment_preference_id_key" ON "orders"("payment_preference_id");
CREATE UNIQUE INDEX "orders_payment_id_key" ON "orders"("payment_id");
CREATE UNIQUE INDEX "orders_payment_external_reference_key" ON "orders"("payment_external_reference");
CREATE INDEX "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");
