DROP INDEX IF EXISTS "orders_payment_marked_paid_by_idx";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_payment_marked_paid_by_fkey";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_marked_paid_by";
