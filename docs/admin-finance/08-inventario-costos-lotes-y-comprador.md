# Entrega 2 — Costos por lotes (FIFO), país y ciudades DIVIPOLA, autocompletado de compradores

## 1. Auditoría de lo que existía (antes de esta entrega)
| Tema | Estado encontrado |
|---|---|
| Costos | `product_costs` (historial de costo de catálogo, Fase 4) y `order_items.costo_unitario_snapshot`. **No había lotes, entradas ni movimientos de inventario.** |
| Stock | `products.stock` / `stock_reservado` con `applyInventoryDeltas` (único punto de cambio, con CHECK). Se consume al pagar (`consumeReservation…`) y se restituye al cancelar (`cancelOnlineOrderInventory`). Ajuste manual: `adjustStock`/importación Excel. |
| Inventario valorizado | No existía (el dashboard antiguo usaba `precio_base × stock`, valor de venta, no costo). |
| Rentabilidad | Fase 4: ingreso costeado − `cantidad × costo_unitario_snapshot`; líneas sin costo = "pendiente de costeo". |
| Clientes | `users` con `nombre`, `apellido` (ambos obligatorios), `telefono`, `direccion`, `ciudad`, `departamento` (texto libre). No hay país ni código de municipio. |
| Pedidos manuales | `createManualOrder`: copia de entrega en `orders.compradorNombre/Apellido/Telefono/Email` y `direccionEnvio` (JSON `{direccion, ciudad, informacionAdicional}`); nivel y descuento salen de la cuenta del cliente. |
| Bug reportado | La búsqueda devolvía un resumen y el formulario hacía `apellido: cliente.apellido \|\| actual`; cuando el cliente estaba guardado con "Sebastián Rubio" en `nombre` y `apellido` vacío, el apellido quedaba vacío. |

## 2. Costos por lotes y FIFO (migración 0043, aditiva, sin aplicar)
- `inventory_lots` (compra o valoración inicial): cantidad, restante, costo unitario, gastos adicionales de adquisición, **costo efectivo = precio + gastos/cantidad**, proveedor, fecha, referencia, observaciones, clave de idempotencia única.
- `lot_consumptions` (qué lotes consumió cada línea de orden) e `inventory_movements` (bitácora: compra, valoración inicial, venta, devolución, ajuste). `order_items.costo_total_snapshot` y `costo_metodo` (`fifo` | `sin_lote` | NULL).
- **Compra**: suma stock **una sola vez** vía `applyInventoryDeltas` en la misma transacción que crea el lote (con `SELECT … FOR UPDATE` del producto). **Valoración inicial**: asigna costo a existencias que ya estaban; no suma stock y no puede superar las unidades sin valorar (flujo seguro: no se inventan costos).
- **Costeo de ventas (FIFO)**: `syncFifoCosts` (idempotente) costea órdenes con pago aprobado en orden de pago, tomando lotes por antigüedad con `FOR UPDATE` y solo lotes creados antes del pago; todo-o-nada por línea; guarda desglose por lote, costo total exacto (suma de consumos redondeados a centavos) y costo unitario informativo. Las líneas que no se pueden cubrir quedan `sin_lote` (se mantiene el costo de catálogo si lo había, o "pendiente de costeo"); jamás costo 0.
- **No toca las transacciones de inventario existentes**: corre fuera de ellas, así un fallo de costeo no puede bloquear un pago. Se dispara en segundo plano al marcar pagado/cancelar y de forma perezosa antes de calcular rentabilidad o valoración (cubre pagos de Mercado Pago sin tocar ese flujo).
- **Cancelación/devolución**: los lotes se restituyen una sola vez (marca `reversed_at`, movimiento "devolución"); el costo congelado de la línea no se reescribe. No existe un flujo de devolución separado en el sistema: se trata como cancelación de orden pagada.
- **Ajustes**: `inventory.lot_adjusted` cambia la cantidad restante de un lote con motivo (valoración); el stock físico se ajusta con el mecanismo existente.
- **Indicadores** (`/admin/inventario-costos` y bloque `inventario` del resumen financiero): compras del periodo (solo lotes tipo compra), inventario valorizado, costo promedio unitario (informativo), unidades sin valorar, historial por producto (lotes + movimientos + costos de catálogo). Las compras **no restan** del resultado (el costo entra al vender), por lo que no se cuenta dos veces con los gastos; los gastos de adquisición van dentro del lote, no como gasto operativo.
- Acceso: solo `finance:read` (admin). Los snapshots no aparecen en respuestas de cliente, catálogo ni roles sin permiso financiero.

## 3. País y ciudades (DIVIPOLA)
- Catálogo oficial versionado: `packages/web/src/data/divipola-municipios.json` (1.122 municipios, 33 departamentos; fuente: DANE, datos abiertos datos.gov.co `gdxc-w37w`, descargado el 2026-11-02). Sin APIs ni claves en ejecución.
- `lib/colombia.ts`: búsqueda desde 2 caracteres, sin tildes ni mayúsculas, parcial por palabra, también por departamento; "cali" → Santiago de Cali primero. `CityAutocomplete`: combobox ARIA (flechas, Enter, Escape), ratón y táctil, estados vacío/seleccionado.
- Colombia: el pedido guarda `ciudad` (nombre visible), `departamento` y `municipioCodigo` (DIVIPOLA) en la copia de entrega. Otros países: ciudad y región manuales. El código se valida solo en formato (5 dígitos): el API no replica el catálogo.
- Compatibilidad: ciudades históricas en texto libre se conservan; solo se resuelve el municipio si la coincidencia es única (si no, queda el texto con aviso y sin código).

## 4. Autocompletado de compradores
- Al elegir un cliente se consulta `GET /api/admin/orders/lookup/customers/:id` (datos reales y vigentes; permiso `orders:create`; id validado; solo clientes activos).
- Nombre/apellido: campos estructurados si existen; si el apellido está vacío y el nombre tiene **exactamente** dos palabras se separan; con 3+ palabras no se adivina (queda en nombre, con aviso). No se inventa país: se conserva el valor del formulario (Colombia por defecto de la pantalla).
- Si el administrador ya escribió datos, se pregunta antes de reemplazar (el cliente igual queda vinculado y con su descuento). Solo se completan campos que el cliente realmente tiene.
- Los datos de entrega del pedido son una copia: editarlos no cambia el perfil del cliente, y cambiarlos después en el perfil no altera pedidos anteriores. Quitar el cliente desliga `userId` (los datos escritos se conservan para esa entrega).

## 5. Compatibilidad y riesgos
- Migración 0043 solo agrega (tablas, tipos, 2 columnas nullables, CHECKs). Órdenes anteriores: `costo_metodo` NULL → se evalúan con la regla "solo lotes anteriores al pago": si no había lotes quedan `sin_lote`; nada retroactivo.
- Un producto con compras registradas por lotes **no debe** sumarse también por ajuste manual/Excel (doble stock). La pantalla lo advierte; la discrepancia se ve como "valoradas > stock" o "sin valorar".
- El orden FIFO depende de la fecha de pago y de que el costeo corra; en carrera extrema entre dos pagos simultáneos podría invertirse el orden entre dos órdenes (efecto: costos intercambiados entre ellas, total igual).
- Pruebas de transacciones/concurrencia y SQL solo con la capa de datos simulada (sin base aislada verificada). **Validar en staging.**

## 6. Validación segura antes de producción
1. Backup, y aplicar migraciones 0037–0043 en staging con copia de datos (`prisma migrate deploy` solo allí).
2. Producto de prueba: compra A (10 u. a $50.000), compra B (10 u. a $60.000 con $20.000 de flete); pedido manual de 15 u.; marcar pagado; verificar que consuma 10 de A y 5 de B, costo = 10×50.000 + 5×62.000, y stock −15 una sola vez.
3. Cancelar ese pedido: lotes restituidos una vez, stock restituido por el mecanismo existente.
4. Doble clic / reenvío de la misma compra: un solo lote y un solo aumento de stock.
5. Valoración inicial de existencias reales con costos reales del proveedor; revisar "unidades sin valorar" = 0.
6. Pedido manual: elegir un cliente con nombre en un solo campo, otro con ciudad en texto libre, y verificar el aviso, la confirmación al sobrescribir y el JSON de `direccion_envio`.

## 7. Revisiones independientes y correcciones
**Costeo FIFO** (hallazgos HIGH/MEDIUM, corregidos): (H1) dos sincronizaciones simultáneas podían costear dos veces la misma línea → bloqueo consultivo global de transacción y re-comprobación dentro del bloqueo; (H2) una orden problemática tumbaba todos los reportes → cada orden se procesa aislada (fallos contados en `failed` y registrados), con límite de transacción de 30 s; (H3) un reembolso de Mercado Pago restituía lotes pero no stock → ahora solo se restituyen lotes de órdenes **canceladas** (donde el stock sí vuelve); (M1) un ajuste de lote podía impedir una restitución posterior → el ajuste respeta lo consumido por órdenes activas y la restitución nunca supera lo comprado (`LEAST`); (M2) interbloqueo costeo/restitución → eliminado por el bloqueo global. Pendiente documentado: líneas `sin_lote` no se reevalúan solas (decisión de integridad histórica); la clave de idempotencia no se compara con el contenido; `comprasPeriodo` usa costo exacto y el valorizado costo efectivo a 4 decimales (diferencias de centavos).
**Comprador y ciudades** (corregidos): carrera al elegir cliente (respuestas tardías descartadas con un token de selección); al reemplazar ya no se heredan datos de otro cliente; la detección de datos propios incluye municipio, país y departamento y usa el estado más reciente; selección táctil por `click` (no al arrastrar); accesibilidad del combobox (`aria-haspopup`, anuncio de resultados, Home/End, desplazamiento a la opción activa, etiqueta del estado elegido); Bogotá y Cartagena se resuelven; el aviso de nombre se limpia al quitar cliente. Aceptado: `municipioCodigo` se valida solo por formato en el API; nombres de dos palabras como «María José» sin apellido se separan sin aviso.

## 8. Pruebas ejecutadas
`pnpm --filter api test`: **277 pasan, 11 omitidas** (integración con BD), 0 fallan. `tsc --noEmit` (api y web) limpio; `pnpm --filter api build` y `next build` correctos; `verify:architecture` correcto. **No se ejecutaron pruebas contra una base de datos real ni E2E de navegador**: las consultas SQL, los bloqueos (`FOR UPDATE`, advisory lock) y la concurrencia solo se verificaron con la capa de datos simulada y revisión estática.
