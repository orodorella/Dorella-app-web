# Fase 6 — Dashboard financiero (solo administrador)

`/admin/finanzas` ("Resumen financiero") consume `GET /api/admin/finance/summary?from&to` (permiso `finance:read`) y `GET /api/admin/finance/summary/export` (CSV). El dashboard operativo/ventas existente (`/admin`) no se modificó.

## Qué responde
1. **Cuánto vendió D'ORELLA**: ventas = mercancía de órdenes no canceladas (Fase 2).
2. **Cuánto vendió cada comercial** y 3. **por modalidad**: tablas/gráficas de la Fase 2.
4. **Costo de mercancía vendida**, 7. **utilidad bruta** y margen: Fase 4, sobre ingreso **cobrado** (pago aprobado) y costeado.
5. **Comisiones por pagar**: comisiones `accrued` no anuladas (incluye las de liquidaciones aún pendientes de pago) + ajustes sin aplicar; se muestra aparte lo causado en el periodo.
6. **Gastos operativos** del periodo (Fase 5) y 8. **resultado operativo estimado** = utilidad bruta − comisiones causadas − gastos de categorías que afectan el resultado.

## Consistencia y anti doble conteo
- El dashboard no recalcula métricas: consolida los servicios de cada módulo; el resultado operativo se calcula una sola vez (en rentabilidad).
- "Ventas" (no canceladas, cobradas o no) y "ingreso cobrado" (pago aprobado) son bases distintas y se rotulan por separado.
- Mercancía → costo (snapshots); comisiones → `commission_entries`; gastos → `expenses`. Un mismo concepto no entra por dos vías (categorías `afecta_resultado=false` para lo ya capitalizado en el costo).
- Advertencias visibles: no es utilidad neta; hay ventas pendientes de costeo; sin desglose de IVA.

## Pruebas
`finance-dashboard.test.ts` (consolidación, CSV con negativos numéricos, 403 para comercial/bodega/cliente sin invocar servicios, 400 por fechas inválidas).
