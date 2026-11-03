-- Aditiva: vendedor responsable de la orden. Nullable; las órdenes anteriores
-- quedan "Sin comercial asignado" (no se infiere ni se rellena).
-- Rollback: quitar el índice y la columna seller_id de orders.
ALTER TABLE "orders" ADD COLUMN "seller_id" UUID;
CREATE INDEX "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at");
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
