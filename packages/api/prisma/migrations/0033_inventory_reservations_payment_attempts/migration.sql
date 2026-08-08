CREATE TYPE "InventoryReservationStatus" AS ENUM ('active', 'consumed', 'released');

ALTER TABLE "orders" ADD COLUMN "purchase_credited_at" TIMESTAMPTZ(3);

CREATE TABLE "inventory_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "order_id" UUID NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'active', "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3), "released_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "inventory_reservations_order_id_key" ON "inventory_reservations"("order_id");
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");

CREATE TABLE "payment_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "order_id" UUID NOT NULL, "attempt_number" INTEGER NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'mercadopago', "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "preference_id" VARCHAR(100), "payment_id" VARCHAR(100), "external_reference" VARCHAR(100) NOT NULL,
  "init_point" VARCHAR(1000), "sandbox_init_point" VARCHAR(1000), "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "paid_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "payment_attempts_preference_id_key" ON "payment_attempts"("preference_id");
CREATE UNIQUE INDEX "payment_attempts_payment_id_key" ON "payment_attempts"("payment_id");
CREATE UNIQUE INDEX "payment_attempts_external_reference_key" ON "payment_attempts"("external_reference");
CREATE UNIQUE INDEX "payment_attempts_order_id_attempt_number_key" ON "payment_attempts"("order_id", "attempt_number");
CREATE INDEX "payment_attempts_order_id_created_at_idx" ON "payment_attempts"("order_id", "created_at");
CREATE INDEX "payment_attempts_status_expires_at_idx" ON "payment_attempts"("status", "expires_at");

INSERT INTO payment_attempts (
  order_id, attempt_number, provider, status, preference_id, payment_id,
  external_reference, init_point, sandbox_init_point, expires_at, paid_at, created_at, updated_at
)
SELECT
  o.id, 1, 'mercadopago', COALESCE(o.payment_status, 'pending'),
  o.payment_preference_id, o.payment_id, COALESCE(o.payment_external_reference, o.id::text),
  o.payment_init_point, o.payment_sandbox_init_point,
  CASE WHEN o.payment_status = 'approved' THEN COALESCE(o.paid_at, o.updated_at) ELSE CURRENT_TIMESTAMP END,
  o.paid_at, o.created_at, o.updated_at
FROM orders o
WHERE o.origen = 'tienda'
  AND (o.payment_preference_id IS NOT NULL OR o.payment_id IS NOT NULL OR o.payment_external_reference IS NOT NULL);

-- Normalize legacy online orders. Before this migration they reduced `stock`
-- at order creation. Pending orders are converted to an expired reservation:
-- restoring physical stock and marking the same units reserved lets the
-- idempotent cleanup release them without changing availability twice.
WITH pending_items AS (
  SELECT oi.product_id, SUM(oi.cantidad)::INTEGER AS quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.origen = 'tienda' AND o.status = 'pending' AND COALESCE(o.payment_status::text, 'pending') <> 'approved'
  GROUP BY oi.product_id
)
UPDATE products p
SET stock = p.stock + pi.quantity,
    stock_reservado = p.stock_reservado + pi.quantity
FROM pending_items pi
WHERE p.id = pi.product_id;

INSERT INTO inventory_reservations (order_id, status, expires_at)
SELECT o.id, 'active', CURRENT_TIMESTAMP
FROM orders o
WHERE o.origen = 'tienda' AND o.status = 'pending' AND COALESCE(o.payment_status::text, 'pending') <> 'approved'
ON CONFLICT (order_id) DO NOTHING;

-- Paid legacy orders already consumed stock and already affected accumulated
-- purchases under the old code. Record both facts to preserve idempotency.
INSERT INTO inventory_reservations (order_id, status, expires_at, consumed_at)
SELECT o.id, 'consumed', COALESCE(o.paid_at, o.created_at), COALESCE(o.paid_at, o.created_at)
FROM orders o
WHERE o.origen = 'tienda' AND (o.payment_status = 'approved' OR o.paid_at IS NOT NULL)
ON CONFLICT (order_id) DO NOTHING;

UPDATE orders
SET purchase_credited_at = COALESCE(paid_at, created_at)
WHERE origen = 'tienda' AND (payment_status = 'approved' OR paid_at IS NOT NULL);
