import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getCommercialPerformance, parseSalesFilters } from './sales-report.service.js';
import { getProfitability } from './cost.service.js';
import { getExpenseSummary } from './expense.service.js';
import { assertDay } from './commission.service.js';
import { getInventoryValuation } from './lot.service.js';

/**
 * Dashboard financiero del administrador (ver docs/admin-finance/06-fase6-dashboard-financiero.md).
 * No redefine métricas: consolida las de cada módulo.
 * - "Ventas" (Fase 2): mercancía de órdenes no canceladas, cobradas o no.
 * - "Ingreso cobrado" (Fase 4): mercancía de órdenes con pago aprobado y no canceladas.
 * - Utilidad bruta, comisiones y gastos se calculan sobre el ingreso cobrado y el mismo periodo.
 */

export async function getFinancialDashboard(from: string, to: string) {
  assertDay(from, 'La fecha inicial');
  assertDay(to, 'La fecha final');

  const [sales, profit, expenses, payable, inventory] = await Promise.all([
    getCommercialPerformance(parseSalesFilters({ from, to, granularity: 'day' })),
    getProfitability({ from, to }),
    getExpenseSummary(from, to),
    prisma.$queryRaw<Array<{ causadaSinPagar: unknown; ajustesPendientes: unknown }>>`
      SELECT
        COALESCE((SELECT SUM(monto) FROM commission_entries WHERE status::text = 'accrued' AND (voided_at IS NULL OR liquidation_id IS NOT NULL)), 0) AS "causadaSinPagar",
        COALESCE((SELECT SUM(monto) FROM commission_adjustments WHERE liquidation_id IS NULL), 0) AS "ajustesPendientes"
    `,
    getInventoryValuation(from, to),
  ]);

  const pendingCommission = new Prisma.Decimal(String(payable[0]?.causadaSinPagar ?? 0)).add(String(payable[0]?.ajustesPendientes ?? 0));

  return {
    from, to,
    ventas: {
      total: sales.totals.revenue,
      ordenes: sales.totals.orders,
      ticketPromedio: sales.totals.ticketPromedio,
      variacionPct: sales.totals.variacionPct,
      porComercial: sales.sellers.map((s) => ({ sellerId: s.sellerId, nombre: s.nombre, ventas: s.revenue, ordenes: s.orders, participacionPct: s.participacionPct })),
      porModalidad: sales.byTier,
    },
    rentabilidad: {
      ingresoCobradoCosteado: profit.resumen.ingreso,
      costoMercanciaVendida: profit.resumen.costo,
      utilidadBruta: profit.resumen.utilidad,
      margenBrutoPct: profit.resumen.margenPct,
      ingresoPendienteCosteo: profit.resumen.ingresoPendienteCosteo,
    },
    comisiones: {
      causadasEnPeriodo: profit.resumen.comisionesCausadas,
      // Todo lo causado y aún no pagado (de cualquier periodo) más ajustes sin aplicar: lo que hay que pagar.
      porPagar: Number(pendingCommission),
    },
    gastos: {
      total: expenses.total,
      porCategoria: expenses.porCategoria.slice(0, 5),
      comparativoMensual: expenses.comparativoMensual,
    },
    // Compras e inventario (lotes FIFO). Las compras NO restan del resultado: el costo entra al vender.
    inventario: {
      comprasPeriodo: inventory.resumen.comprasPeriodo,
      inventarioValorizado: inventory.resumen.inventarioValorizado,
      costoPromedioUnitario: inventory.resumen.costoPromedioUnitario,
      unidadesValoradas: inventory.resumen.unidadesValoradas,
      unidadesSinValorar: inventory.resumen.unidadesSinValorar,
    },
    resultadoOperativoEstimado: profit.resumen.resultadoOperativoEstimado,
    advertencias: [
      'La utilidad bruta no es utilidad neta: no incluye impuestos, nómina ni gastos no registrados.',
      ...(inventory.resumen.unidadesSinValorar > 0 ? [`Hay ${inventory.resumen.unidadesSinValorar} unidades en inventario sin valorar: el inventario valorizado es parcial.`] : []),
      ...(profit.resumen.ingresoPendienteCosteo > 0 ? ['Hay ventas pendientes de costeo; la utilidad está subestimada hasta registrar sus costos.'] : []),
      'El esquema no desglosa IVA; los montos son los de las líneas de orden.',
    ],
  };
}

const csvText = (value: unknown): string => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function financialDashboardToCsv(d: Awaited<ReturnType<typeof getFinancialDashboard>>): string {
  const rows: Array<[string, string | number | null]> = [
    ['Periodo', `${d.from} a ${d.to}`],
    ['Ventas (no canceladas)', d.ventas.total], ['Órdenes', d.ventas.ordenes], ['Ticket promedio', d.ventas.ticketPromedio],
    ['Ingreso cobrado y costeado', d.rentabilidad.ingresoCobradoCosteado], ['Costo de mercancía vendida', d.rentabilidad.costoMercanciaVendida],
    ['Utilidad bruta', d.rentabilidad.utilidadBruta], ['Margen bruto %', d.rentabilidad.margenBrutoPct],
    ['Ingreso pendiente de costeo', d.rentabilidad.ingresoPendienteCosteo],
    ['Compras de inventario del periodo', d.inventario.comprasPeriodo], ['Inventario valorizado', d.inventario.inventarioValorizado],
    ['Unidades sin valorar', d.inventario.unidadesSinValorar],
    ['Comisiones causadas en el periodo', d.comisiones.causadasEnPeriodo], ['Comisiones por pagar', d.comisiones.porPagar],
    ['Gastos operativos', d.gastos.total], ['Resultado operativo estimado', d.resultadoOperativoEstimado],
    ...d.ventas.porComercial.map((s): [string, number] => [`Ventas · ${s.nombre}`, s.ventas]),
    ...d.ventas.porModalidad.map((t): [string, number] => [`Ventas · modalidad ${t.tier}`, t.revenue]),
    ...d.gastos.porCategoria.map((c): [string, number] => [`Gastos · ${c.categoria}`, c.total]),
  ];
  return `﻿${[['Indicador', 'Valor'], ...rows].map(([k, v]) => `${csvText(k)},${v === null ? '' : typeof v === 'number' ? String(v) : csvText(v)}`).join('\r\n')}\r\n`;
}
