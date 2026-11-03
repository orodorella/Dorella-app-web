# Fase 2 — Ventas por comercial

## Definiciones (fórmulas)
- **Venta** = `SUM(order_items.subtotal)` de órdenes **no canceladas** (mercancía después de descuentos; excluye fletes y cualquier concepto que no sea mercancía). Con filtro de estado explícito se usa ese estado.
- **Pagado** = misma suma restringida a `payment_status = 'approved'`.
- **Ticket promedio** = venta / órdenes distintas.
- **Participación** = venta del comercial / venta total del filtro.
- **Variación** = (venta − venta del periodo anterior) / venta del periodo anterior; el periodo anterior tiene la misma duración y termina el día previo a `from`. Sin base de comparación se muestra "—".
- **Modalidad** = `orders.tier_at_purchase` (por orden; no hay modalidad por línea). Reutiliza la regla existente de nivel del cliente.
- **Vendedor** = `orders.seller_id`. Órdenes sin vendedor (tienda y anteriores a la Fase 1) = "Sin comercial asignado".
- Fechas en hora de Colombia (`America/Bogota`). Las sumas se calculan en SQL con `numeric`; solo se convierten a número al salir de la API.
- IVA: el esquema no lo desglosa; los totales son los de las líneas tal como están guardadas.

## API (permiso `finance:read`, solo admin)
- `GET /api/admin/sales/performance?from&to&sellerId&categoryId&tier&status&granularity=day|week|month` → totales, comparación con periodo anterior, filas por comercial (con matriz por modalidad), totales por modalidad y categoría, serie temporal por comercial.
- `GET /api/admin/sales/sellers` → comerciales para el filtro (rol `comercial` o con ventas).
- Filtros validados con lista cerrada/regex (sin interpolación de texto del usuario en SQL; consultas parametrizadas).

## Frontend
`/admin/rendimiento` (solo admin; en el menú "Rendimiento comercial"): filtros, tarjetas, tabla comercial × modalidad, comparación entre comerciales, ventas por modalidad, evolución y ventas por categoría con Recharts.

## Limitaciones
- Las consultas SQL se probaron por tipos y con la capa de datos simulada; **no se ejecutaron contra una base real** (no hay base aislada verificada). Validar en staging antes de producción.
- Una orden con varias categorías cuenta una vez por categoría en el desglose por categoría (el total por comercial no se duplica).
- Cantidades por categoría y modalidad se informan; la columna de unidades por modalidad está en la API (`byTier[].units`).
