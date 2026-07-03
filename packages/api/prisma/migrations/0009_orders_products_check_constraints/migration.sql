ALTER TABLE "orders" ADD CONSTRAINT "orders_descuento_aplicado_range"
  CHECK ("descuento_aplicado" >= 0 AND "descuento_aplicado" <= 1) NOT VALID;
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_descuento_aplicado_range";

ALTER TABLE "products" ADD CONSTRAINT "products_stock_reservado_le_stock"
  CHECK ("stock_reservado" <= "stock") NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_stock_reservado_le_stock";
