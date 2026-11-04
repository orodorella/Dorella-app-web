/**
 * Qué cuenta cada indicador del panel. Describen las consultas del API tal como
 * están (dashboard.service, sales-report.service, cost.service, finance-dashboard.service,
 * expense.service, lot.service); si una regla cambia allá, este texto debe cambiar aquí.
 */
export const KPI_DEFINITIONS = {
  // Dashboard (dashboard.service: estados confirmed, invoiced, shipped, delivered).
  ventasConfirmadas: 'Ventas confirmadas = total de las órdenes confirmadas, facturadas, enviadas o entregadas creadas en el periodo. Excluye pendientes y canceladas; no exige pago aprobado.',
  ordenesConfirmadas: 'Órdenes confirmadas, facturadas, enviadas o entregadas creadas en el periodo.',
  ticketPromedio: 'Promedio del total por orden confirmada del periodo.',
  porConfirmar: 'Órdenes en estado pendiente creadas en el periodo.',
  clientesActivos: 'Clientes distintos con al menos una orden confirmada en el periodo.',
  reabastecer: 'Productos activos con stock bajo: más de 0 unidades pero en o por debajo de su mínimo. No depende del periodo.',

  // Ventas (sales-report.service).
  ventas: 'Ventas = mercancía de órdenes no canceladas (pagadas o no), después de descuentos y sin fletes, por fecha de creación en hora de Colombia.',
  ordenesVenta: 'Órdenes no canceladas creadas en el periodo (o del estado filtrado).',
  ticketVenta: 'Ventas ÷ órdenes del periodo.',
  unidades: 'Unidades vendidas en órdenes no canceladas del periodo.',

  // Rentabilidad (cost.service): solo pago aprobado.
  ingresoCobrado: 'Ingresos cobrados = mercancía de órdenes con pago aprobado y no canceladas que tienen costo registrado. Lo que no tiene costo va a «Pendiente de costeo».',
  costoMercancia: 'Costo registrado de las unidades cobradas en el periodo (lotes FIFO o costo vigente en la fecha de la orden).',
  utilidadBruta: 'Ingresos cobrados con costo − costo de mercancía vendida. No es utilidad neta: no descuenta impuestos ni nómina.',
  margenBruto: 'Margen bruto = utilidad bruta ÷ ingresos cobrados con costo.',
  recargo: 'Recargo = utilidad bruta ÷ costo de mercancía vendida.',
  pendienteCosteo: 'Ingresos cobrados de líneas sin costo registrado. No entran en la utilidad hasta que se registre su costo.',
  comisionesCausadas: 'Comisiones causadas en el periodo: se causan cuando el pago de la orden queda aprobado.',
  comisionesPorPagar: 'Comisiones causadas y aún no pagadas de cualquier periodo, más ajustes manuales sin liquidar. No depende del periodo.',
  utilidadMenosComisiones: 'Utilidad bruta − comisiones causadas en el periodo.',
  gastosOperativos: 'Gastos registrados no anulados del periodo, de todas las categorías (incluye las que no afectan el resultado, p. ej. flete ya incluido en el costo).',
  gastosQueAfectan: 'Gastos no anulados del periodo solo de categorías que afectan el resultado operativo.',
  resultadoOperativo: 'Utilidad bruta − comisiones causadas − gastos de categorías que afectan el resultado. Excluye impuestos, nómina no registrada y ventas pendientes de costeo.',

  // Gastos (expense.service).
  gastosPeriodo: 'Gastos no anulados con fecha en el periodo, de todas las categorías.',

  // Compras e inventario (lot.service).
  comprasPeriodo: 'Valor de las compras registradas con fecha en el periodo. No resta del resultado: el costo entra cuando se vende.',
  inventarioValorizado: 'Unidades en lotes con costo × su costo efectivo, a hoy. No depende del periodo.',
  costoPromedio: 'Costo promedio de las unidades valoradas. Informativo: las ventas se costean por lotes (FIFO).',
  unidadesSinValorar: 'Unidades en stock que no pertenecen a ningún lote con costo. No se les asume costo.',

  // Comisiones (commission.service).
  comisionEstimada: 'Comisión de órdenes del periodo con pago aún pendiente; se causará cuando se apruebe el pago.',
  comisionCausada: 'Comisión de órdenes con pago aprobado en el periodo, aún sin pagar.',
  comisionPagada: 'Comisión ya incluida en una liquidación marcada como pagada.',
} as const;
