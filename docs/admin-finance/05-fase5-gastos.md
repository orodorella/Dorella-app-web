# Fase 5 — Gastos operativos

## Modelo (migración 0042, aditiva, sin aplicar)
- `expense_categories(nombre único, afecta_resultado, is_active, orden)` — administrables desde `/admin/gastos` (crear, renombrar, activar/desactivar). La migración siembra las 9 categorías iniciales de forma idempotente (`ON CONFLICT DO NOTHING`).
- `expenses(fecha date, descripcion, valor numeric(15,2) CHECK > 0, category_id, proveedor, medio_pago, observaciones, soporte_referencia, created_by, voided_at, void_reason)`.
- Rollback: eliminar `expenses` y `expense_categories`.

## Reglas
- Un gasto **no se borra**: se anula con motivo (idempotente, auditado); los anulados no suman en totales y no se pueden editar.
- **Sin doble conteo**: `afecta_resultado = false` marca conceptos ya contabilizados en otro lado (p. ej. flete de compra incluido en el "costo adicional" del producto, Fase 4). Se registran y aparecen en listados, pero no restan del resultado operativo. Las comisiones salen de `commission_entries` y nunca de gastos; el costo de mercancía sale de los snapshots de costo.
- Resultado operativo estimado = utilidad bruta − comisiones causadas − gastos operativos (vigentes, de categorías que afectan el resultado) del periodo. Excluye lo pendiente de costeo, impuestos y gastos no registrados.
- Soporte: campo de referencia (n.º de factura o enlace). **La carga de archivos no se implementó**: requeriría crear un bucket privado en Supabase Storage (cambio de configuración remota que necesita autorización). Cuando se autorice, se añade subida con URL firmada.

## API (`expenses:manage`, solo admin)
`GET/POST /api/admin/expenses/categories`, `PATCH /categories/:id`, `GET /summary`, `GET /export` (CSV), `GET /`, `POST /`, `PUT /:id`, `POST /:id/void`. Toda mutación queda en `audit_log`.

## Panel
Gastos del periodo, por categoría (con participación), comparativo mensual (6 meses), historial con filtros (fecha, categoría, texto) y exportación CSV (neutraliza fórmulas).
