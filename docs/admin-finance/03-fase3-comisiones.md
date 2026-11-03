# Fase 3 — Comisiones configurables

## Política inicial (aprobada; validar como decisión de negocio)
| Concepto | Regla |
|---|---|
| **Estimada** | Orden de un comercial con pago pendiente/en proceso y no cancelada. No se guarda; se calcula con el porcentaje vigente hoy. Informativa. |
| **Causada** | Orden con `payment_status = approved` y no cancelada. Se guarda una **instantánea** (base, porcentaje, monto, regla) con el porcentaje vigente en la **fecha de pago** (`paid_at`). |
| **Pagada** | La entrada pertenece a una liquidación marcada como pagada. |
| **Anulada** | Orden cancelada o con pago `refunded / charged_back / cancelled / rejected`: si la entrada no está liquidada se anula; si ya está en una liquidación se crea **un** ajuste negativo (único por entrada) que se descuenta en la siguiente liquidación. Lo liquidado nunca se reescribe. |
| **Base** | `SUM(order_items.subtotal)` de la orden (mercancía después de descuentos; sin flete ni otros conceptos). |
| **Quién genera** | Solo vendedores con rol `comercial`. Órdenes de tienda o sin vendedor: nunca. |
| **Sin regla definida** | Se causa con 0% (no se inventan porcentajes). Las reglas se configuran en `/admin/comisiones`. No se siembran datos. |

Fórmula: `comisión = ROUND_HALF_UP(base × porcentaje / 100, 2)` con `Prisma.Decimal` (sin float). Ejemplo: $10.000.000 × 2% = $200.000; $20.000.000 × 1% = $200.000; total $400.000.

## Porcentajes con vigencia
`commission_rules(tier, user_id NULL|comercial, porcentaje 0–100 con 4 decimales, valid_from, valid_to)`. Cambiar un porcentaje **cierra** la regla vigente (`valid_to = ahora`) y crea otra; nunca se edita. Una regla específica de un comercial prevalece sobre la general de la modalidad. Índice único parcial: una sola regla abierta por (modalidad, comercial). Restricción `CHECK 0 ≤ porcentaje ≤ 100`.

## Causación perezosa e idempotente
`syncCommissionEntries()` corre al consultar el resumen y al liquidar. No hay ganchos en los flujos de pago existentes (no se tocaron Mercado Pago ni `mark-paid`). La regla se resuelve por fecha de pago, así que el momento del sync no cambia el resultado. `UNIQUE(order_id)` impide duplicados; `P2002` se trata como "ya causada".

## Liquidaciones
Por comercial y periodo (fechas en hora de Colombia, UTC−05:00 fijo): suma entradas `accrued` sin liquidar + ajustes pendientes; crea la liquidación `pending` y reclama las filas atómicamente (si otra liquidación las tomó, se aborta con 409). `Marcar pagada` es idempotente y pasa las entradas a `paid`. Exportación CSV (UTF-8 con BOM, neutraliza celdas que empiezan con `= + - @`). El total puede ser negativo si los reversos superan lo causado (no hay arrastre automático).

## API (`commissions:manage`, solo admin)
`GET/PUT /api/admin/commissions/rules` · `GET /summary?from&to` · `GET/POST /liquidations` · `GET /liquidations/:id` · `GET /liquidations/:id/export` · `POST /liquidations/:id/pay` · `POST /adjustments`. Toda mutación queda en `audit_log`.

## Migración 0040 (aditiva; sin aplicar)
Crea los tipos `CommissionStatus`, `LiquidationStatus` y las tablas `commission_rules`, `commission_entries`, `commission_liquidations`, `commission_adjustments` (solo `CREATE`, sin `DROP`). Rollback: eliminar esas cuatro tablas y los dos tipos (no contienen datos de negocio previos).

## Limitaciones conocidas
- Consultas SQL y transacciones probadas con la capa de datos simulada, no contra Postgres real; validar en staging.
- No hay arrastre de saldos negativos entre liquidaciones.
- Si un comercial cambia de rol, sus entradas ya causadas se conservan.
