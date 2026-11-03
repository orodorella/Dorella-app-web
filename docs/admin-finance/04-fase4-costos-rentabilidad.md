# Fase 4 — Costos y rentabilidad

## Modelo (migración 0041, aditiva, sin aplicar)
- `product_costs(product_id, costo_adquisicion, costo_adicional, costo_total, valid_from, notas, created_by)`: historial; nunca se edita, cada cambio es una fila. Costo vigente = la fila más reciente con `valid_from ≤ ahora`. `CHECK`: montos ≥ 0 y `costo_total = adquisición + adicional`.
- `order_items.costo_unitario_snapshot` (nullable): costo vigente congelado al crear la orden (se lee en la misma consulta de productos, sin viajes extra a la base). `NULL` = **pendiente de costeo**; nunca se trata como 0.
- Rollback: quitar la columna `costo_unitario_snapshot` y eliminar `product_costs`.

## Reglas y fórmulas
- Cambiar un costo o el precio **no** altera la rentabilidad de órdenes ya creadas (usan su snapshot). Editar un costo no modifica `precio_base`.
- Ingreso = `SUM(order_items.subtotal)` de órdenes con pago aprobado y no canceladas (sin IVA desglosado: el esquema no lo tiene).
- Utilidad bruta = ingreso costeado − Σ(cantidad × costo snapshot). **No es utilidad neta.**
- Margen sobre ventas = utilidad / ingreso. Recargo sobre costo = utilidad / costo. Ej.: venta 100.000, costo 60.000 → utilidad 40.000, margen 40 %, recargo 66,67 %.
- Las líneas sin costo se informan aparte (ingreso y unidades pendientes) y no entran al margen.
- Costeo retroactivo (acción explícita del admin): para líneas con snapshot NULL usa el costo vigente en la fecha de la orden, solo si el admin cargó costos con fecha pasada. No toca líneas ya costeadas; queda auditado.
- Comisiones causadas del periodo se muestran junto a la utilidad bruta (fuente: `commission_entries`, sin duplicar el costo de mercancía). Gastos operativos se integran en la Fase 5/6.

## Acceso
Todo bajo `/api/admin/finance/*` con permiso `finance:read` (solo admin). Bodega y comercial no ven costos ni márgenes (pruebas 403). Las respuestas de órdenes no incluyen `costo_unitario_snapshot` (selects explícitos).

## API / UI
`GET /costs/products`, `PUT /costs/products/:id`, `GET /costs/products/:id/history`, `POST /costs/backfill`, `GET /profitability`. Páginas `/admin/costos` y `/admin/rentabilidad`.

## Limitaciones
- El costo de órdenes anteriores a esta migración queda pendiente hasta cargar costos y ejecutar el costeo retroactivo.
- Consultas SQL no ejecutadas contra Postgres real (validar en staging).
- Fletes de compra: si ya se incluyeron en "costo adicional", no deben registrarse otra vez como gasto (ver Fase 5).
