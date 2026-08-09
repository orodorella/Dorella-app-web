ALTER TABLE "orders" ADD COLUMN "payment_marked_paid_by" UUID;

ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_marked_paid_by_fkey"
  FOREIGN KEY ("payment_marked_paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_payment_marked_paid_by_idx" ON "orders"("payment_marked_paid_by");
