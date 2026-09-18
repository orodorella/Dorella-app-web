-- Descuento adicional por línea de un pedido manual, en porcentaje. Se aplica
-- encima del descuento del nivel del cliente (detal / por mayor / gran mayor);
-- 0 significa que la línea va al precio del nivel, sin descuento extra.
ALTER TABLE "order_items"
  ADD COLUMN "descuento_adicional" DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_descuento_adicional_range"
  CHECK ("descuento_adicional" >= 0 AND "descuento_adicional" <= 100);
