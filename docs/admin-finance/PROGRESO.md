# PROGRESO — Roles, ventas por comercial, comisiones, costos, gastos y finanzas

Rama: `feature/admin-roles-finances-commissions` (base `main` @ `f0617ff`). **Nada se ha subido, mezclado ni desplegado. Ninguna migración se ha aplicado a ninguna base de datos.**
Documentos: [00-auditoria-y-plan.md](00-auditoria-y-plan.md) (plan y arquitectura), [01-fase1-roles-permisos.md](01-fase1-roles-permisos.md).

## Decisiones de negocio aprobadas (2026-11-02)
1. Comisión se causa solo con pago aprobado/confirmado.
2. Base = subtotal de productos después de descuentos, sin fletes ni conceptos ajenos a la mercancía.
3. Modalidad = `Order.tierAtPurchase`; el comercial no la elige.
4. Cada comercial ve solo sus órdenes; admin ve todas.
5. Órdenes de tienda sin vendedor no generan comisión.
6. IVA: no se inventa desglose; se documenta la limitación.

## Estado por fase
| Fase | Estado |
|---|---|
| 0 Auditoría | Hecha (commit `3589818`) |
| 1 Roles y permisos | Hecha (commit `de42a39`) + correcciones de revisión independiente |
| 2 Ventas por comercial | Hecha (ver [02-fase2](02-fase2-ventas-por-comercial.md)) |
| 3 Comisiones | Hecha + correcciones de revisión independiente (commit `8ad0af7`; ver [03-fase3](03-fase3-comisiones.md)) |
| 4 Costos y rentabilidad | Hecha (commit `7e8ab81`; ver [04-fase4](04-fase4-costos-rentabilidad.md)) |
| 5 Gastos | Hecha (commit `d8d44b8`; ver [05-fase5](05-fase5-gastos.md)) |
| 6 Dashboard financiero | Hecha (commit `443444f`; ver [06-fase6](06-fase6-dashboard-financiero.md)) |
| 7 QA y despliegue | Hecha localmente (ver [07-despliegue-y-rollback](07-despliegue-y-rollback.md)); **despliegue NO realizado, pendiente de autorización** |

## Entrega 2 (2026-11-02): lotes/FIFO, DIVIPOLA, autocompletado de compradores
Ver [08-inventario-costos-lotes-y-comprador.md](08-inventario-costos-lotes-y-comprador.md). Migración nueva: 0043 (sin aplicar). Commits: `77daebc` (ciudades + comprador) y el de lotes/FIFO. Revisiones independientes aplicadas (ver §7 del doc 08). Pruebas: 277 pasan / 11 omitidas; builds api y web correctos.

## Entrega 3 (2026-11-02): QA final
Ver [09-qa-final-y-recomendacion.md](09-qa-final-y-recomendacion.md). **Recomendación actualizada: APTO CON CONDICIONES** (ya probado contra Postgres real y en navegador; faltan dependencias, staging con datos reales y Mercado Pago). Nueva migración 0044 (app_settings + orders.seller_role). Cambios: tope de descuento configurable del comercial, comisión con rol de la orden, bodega sin precios, trabajador de costeo FIFO automático con estado, ajuste de stock con bloqueo y trazabilidad, pruebas de integración de lotes (sin ejecutar). Pruebas: 317 pasan, 0 omitidas (con Postgres real); E2E en navegador con 27 capturas en `evidencias/`.

## Decisiones técnicas
- `seller_id` se movió de la Fase 2 a la Fase 1 (migración 0039) porque "el comercial solo ve sus órdenes" lo necesita.
- `sellerId` = usuario autenticado que crea el pedido manual (también si es admin). Las comisiones solo se calculan para vendedores con rol `comercial`.
- Auditoría (`audit_log`): en la misma transacción para el cambio de rol por verificación; "best effort" para el resto (un fallo de auditoría se registra en logs pero no revierte una operación ya confirmada).
- Pedidos manuales: el comercial usa `/api/admin/orders/lookup/products|customers` (campos mínimos, sin `precioBase` ni proveedor) en vez de `/api/admin/products|users`.
- `mark-paid` queda solo para admin (dispara comisiones); bodega puede cambiar estados y confirmar pedidos con pago aprobado.

## Pruebas
- Línea base antes de cambios: 155 pasan / 11 omitidas.
- Tras Fase 1: 165 pasan. Tras correcciones de revisión y Fase 2: **230 pasan / 11 omitidas** tras Fase 6 (`finance-dashboard` 5) (`rbac` 14, `sales-report` 8, `commission` 25, `cost` 11, `expense` 11, +1 en `manual-order`), `tsc --noEmit` limpio en `api` y `web`.

## Revisión de seguridad global (Fase 7) y resolución
Sin hallazgos CRITICAL/HIGH. Corregidos: M1 bodega no podía guardar productos desde la UI (la página ahora oculta precios, crear, desactivar, importar y exportar a quien no es admin y no envía `precioBase`); L1 `sellerId` ya no llega a clientes; L2/L3/L4 validaciones que evitan 500 (monto de ajuste, `sellerId` de liquidaciones, fechas antes de cabeceras de exportación); L5 "por pagar" y "causadas" ahora coinciden con reversos de liquidaciones pendientes. Observaciones de negocio abiertas: tope de descuento del comercial, enumeración de clientes, bodega cancela pedidos pagados.

## Revisión independiente de Fase 3 (resolución)
Corregidos: reembolsos de Mercado Pago (solo quedan en `payment_attempts`) ahora revierten la comisión; el reclamo de liquidación exige entrada `accrued` y no anulada; se puede liquidar a quien dejó de ser comercial si tiene comisiones causadas; fechas imposibles rechazadas; "hoy" en hora de Colombia; CSV con montos numéricos; ids inválidos → 400. Documentado: la causación depende del rol vigente al sincronizar (una orden pagada de alguien que dejó de ser comercial antes de cualquier sync no se causa); un reverso sobre una liquidación pendiente se descuenta en la siguiente, no la modifica.

## Revisión independiente de Fase 1 (hallazgos y resolución)
1. Bodega veía/cambiaba `precioBase`, exportaba catálogo → corregido: precios `null` para quien no tenga `finance:read`; crear/borrar/importar/exportar productos solo admin; el PUT descarta `precioBase`.
2. Comercial puede dar `descuentoAdicional` hasta 100% → **decisión de negocio pendiente (¿tope por rol?)**; mitigado con auditoría (`maxDescuentoAdicional` en `order.manual_created`).
3. Búsqueda de clientes recorrible → ahora exige ≥3 caracteres y máx. 10 por página.
4. Bodega ve montos por orden (totales/subtotales) → aceptado por ahora; si "nada financiero" incluye precios de venta por orden, hace falta una vista reducida (decisión de negocio).

## Riesgos / pendientes conocidos
- Consultas SQL de reportes no ejecutadas contra BD real (sin BD aislada verificada): validar en staging.
- Los costos (Fase 4) deben ir en endpoints/campos separados con permiso `finance:read` (bodega ya no ve precios).
- **Al commitear usar rutas explícitas** (nunca `git add packages/api/src` completo) para no incluir `password-reset.test.ts`.
- Verificar con pruebas manuales en un entorno aislado el flujo de login de cada rol (no hay BD aislada verificada).
- `password-reset.test.ts` sigue sin seguimiento y sin tocar.

## Entrega 4 (2026-11-02): optimización de rendimiento
Ver [10-optimizacion-rendimiento.md](10-optimizacion-rendimiento.md). Dashboard por secciones, productos con filtros/paginación en servidor, inventario más ligero. Medición real de navegador (escritorio y móvil emulado) con 10.052 productos y 2.021 órdenes sintéticas: pantallas del panel útiles en 139–338 ms en escritorio; en móvil con CPU 4× más lenta, 1,4–2,0 s. Las cifras iniciales de ~2,5 s del Dashboard eran un artefacto del sondeo CDP (corregido midiendo dentro de la página). Pruebas con Postgres real: 329 tras corregir el mock de `rbac.test.ts` (faltaba `ALL_DASHBOARD_SECTIONS`); `tsc` limpio en api y web.

## Entrega 5 (2026-11-02): integración con producción, dependencias, A/B, Cloudflare
- Rama de trabajo: `integration/pre-release` (local). Producción real = `origin/main` @ `7767d25`; se integró (2 conflictos resueltos). Ver [11-plan-publicacion-y-rollback.md](11-plan-publicacion-y-rollback.md).
- Dependencias: `pnpm audit` 99 → 19 (2 críticas solo de pruebas). API 336 pruebas OK; web 36 OK; `tsc` limpio.
- Build Cloudflare (`build:cloudflare`) OK y smoke test local con `wrangler dev` (páginas públicas 200, `/admin` sin sesión → 307 a `/login`).
- A/B de rendimiento (escritorio, mediana de 3): Productos 12,2 s → 0,28 s (105 → 5 peticiones, 4,9 MB → 32 KB); Dashboard 689 → 240 ms útil, 690 → 388 ms completo. Ver [10-optimizacion-rendimiento.md](10-optimizacion-rendimiento.md) §6.
- Migraciones 0037–0044: todas aditivas; ver plan §4.

- E2E en navegador sobre la rama integrada (77 comprobaciones, API+web de producción locales): **70 pasan, 7 fallan; resultado NO concluyente**, porque el guion no es idempotente y se ejecutó por segunda vez sobre la misma BD (ya había consumido stock y lotes; la BD además tiene el sembrado de rendimiento). Análisis: inventario valorizado: la API devuelve 6.074.000, igual que SQL directo (el guion esperaba 1.920.000 de un estado anterior); stock 18/20 y lote 8/10 son consumo acumulado; la comisión de la última orden sí existe (1 entrada) y su costo FIFO es 41.000, pero el trabajador la causa unos segundos después de costear y el guion comprueba antes (carrera del guion); "utilidad bruta $9.000" depende de datos; "País ≠ Colombia" ya fallaba en la pasada anterior. Para cerrar: repetir sobre una BD limpia con fixtures reproducibles y espera por la comisión. Las suites automáticas (API 336, web 36) sí pasan.

## Entrega 6 (2026-11-03): cierre de pre-release — matriz de requisitos
Rama local `integration/pre-release` (producción real = `origin/main` @ `7767d25`, integrada). Detalle: [11-plan-publicacion-y-rollback.md](11-plan-publicacion-y-rollback.md), [10-optimizacion-rendimiento.md](10-optimizacion-rendimiento.md), [09-qa-final-y-recomendacion.md](09-qa-final-y-recomendacion.md).

| Requisito | Evidencia | Estado | Riesgo | Acción pendiente |
|---|---|---|---|---|
| E2E completo en base limpia | `node e2e/run-clean.mjs` (contenedor nuevo por ejecución, migraciones + fixtures sintéticos): **77/77** en 3 ejecuciones; `evidencias/e2e-limpia/` | Cerrado (local) | Bajo | Repetirlo en staging real tras desplegar |
| Pruebas automáticas | API 335/336 en la corrida completa final y web 36/36; `tsc` limpio. El fallo era un test inestable (12 % de choque por diseño con 20.000 códigos); corregido y 22/22 en 3 ejecuciones | Cerrado con reserva | Bajo | Repetir la suite completa de la API tras el último commit (no se repitió en una sola corrida) |
| Integración con producción | Merge `555c694` de `origin/main` @ `7767d25` (2 conflictos resueltos); fix de rol/tier desde BD ya presente | Cerrado | Medio si producción avanza | `git fetch` y comparar con `origin/main` justo antes de publicar |
| Vulnerabilidades | 99 → 19 (0 bajas, 12 moderadas, 5 altas, 2 críticas). Críticas = `tinypool` (solo vitest). Alcance real en plan §11 | Parcial | Bajo-medio (`zod` 3.x, acotado a 1 MB) | Decidir migraciones mayores: zod 4, Prisma 7, vitest 4, OpenNext |
| Migraciones 0037–0044 | Ensayo: respaldo → restauración (22 tablas idénticas) → migración en 7,2 s; 0 restricciones sin validar; originales intactas; plan §7 | Cerrado en local | Medio (datos y volumen reales, Supabase/RLS sin probar) | Staging con copia anonimizada y autorizada |
| Rollback con roles nuevos | API anterior con filas comercial/bodega: `admin/users` 500 y login de esos usuarios 500 (resto OK). `ops/rollback-roles.sql` + `restore-roles.sql` probados e idempotentes | Cerrado con procedimiento | Medio si se asignan roles sin periodo de observación | Respetar ≥24–48 h sin roles nuevos; opcional: desacoplar roles (~35 archivos), decisión del dueño |
| Respaldo/restauración verificable | Procedimiento y ensayo (plan §7 y §9) | Cerrado en local | Medio | Respaldo real de Supabase (PITR) antes de migrar |
| Rendimiento Productos/Dashboard | A/B escritorio (Productos 12,2 s → 0,28 s; Dashboard útil 689 → 240 ms); navegación posterior 87–202 ms (escritorio) y 259–451 ms (móvil); `EXPLAIN ANALYZE` a 300 mil órdenes: resumen 70 → 4,5 ms, serie diaria 270 → 12 ms | Cerrado en escritorio | Bajo | A/B en móvil no hecho; `EXPLAIN` con volumen real en staging |
| Caché e invalidación | Sin caché en API ni en el panel; ISR de 60 s de páginas públicas sin cambios | Cerrado | Bajo | — |
| Build Cloudflare Workers | `verify:architecture` + `build:cloudflare` OK; Worker local con `wrangler dev` (públicas 200, `/admin` sin sesión → 307) | Cerrado local | Medio (no hay preview remoto) | Preview remoto con autorización |
| Mercado Pago | Solo pruebas unitarias/mocks; el sandbox real requiere credenciales | **Abierto (bloqueo externo)** | Medio | Probar en sandbox con credenciales de prueba |
| Disparadores de despliegue | El repo no contiene configuración (sin workflows, railway.json, vercel.json); evidencia de Railway desplegando desde `main` | **Abierto (requiere paneles)** | Alto si se hace push sin confirmarlo | Lista de comprobaciones en plan §10 |
| Decisiones de negocio | Tope de descuento del comercial (10 % provisional), bodega cancela pedidos pagados, enumeración de clientes (doc 07 §5) | Abierto | Bajo-medio | Decisión del dueño |

### Commit candidato
Ver `git log -1` de `integration/pre-release` (el último commit local incluye todo lo anterior). **No se ha hecho push, merge ni deploy.** Orden seguro para publicar: respaldo → staging con datos anonimizados → migraciones → API → web → periodo de observación sin roles nuevos → asignar roles (plan §4 y §8).

### Clasificación: APTO CON CONDICIONES
Condiciones: (1) confirmar disparadores en los paneles; (2) staging con datos reales anonimizados; (3) sandbox de Mercado Pago; (4) respaldo real y ventana de despliegue; (5) decisiones de negocio abiertas; (6) repetir la suite completa y el E2E sobre el commit exacto que se publique.
