DROP TABLE IF EXISTS "payment_attempts";
DROP TABLE IF EXISTS "inventory_reservations";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "purchase_credited_at";
DROP TYPE IF EXISTS "InventoryReservationStatus";
