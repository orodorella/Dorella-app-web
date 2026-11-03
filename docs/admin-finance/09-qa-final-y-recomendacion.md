# QA final, integración y recomendación de producción

Fecha: 2026-11-02 · Rama `feature/admin-roles-finances-commissions` · Nada se ha subido, mezclado, desplegado ni aplicado a ninguna base de datos.

## Recomendación: **APTO CON CONDICIONES** (no apto para despliegue directo a producción)
Desde la actualización del 2026-11-02 (tarde) el cambio ya se ejecutó contra un **PostgreSQL 16 real y desechable** (Docker) y se usó en un **navegador real** (Chrome, por CDP) con datos 100 % sintéticos: migraciones 0001–0044 aplicadas, 21 pruebas de integración pasando, 77 comprobaciones E2E (75 pasaron en la pasada completa; las 2 restantes —ciudades y país distinto de Colombia— se corrigieron y se verificaron en una repetición dirigida, no en una segunda pasada completa) y 27 capturas de evidencia. Eso encontró y corrigió **cuatro defectos reales** que ninguna prueba con simulaciones había mostrado. **Quedan condiciones antes de producción:** (1) actualizar dependencias vulnerables (Next.js, Express/proxy-addr, etc.), (2) validar en staging con **copia de datos reales** y respaldo confirmado (la base de pruebas es sintética y el E2E usó el servidor de desarrollo, no el build de Cloudflare), (3) resolver el problema preexistente de la migración 0030 al crear entornos desde cero, (4) confirmar las decisiones de negocio abiertas (tope de descuento 10 %, etc.), y (5) probar el flujo de pago real de Mercado Pago, que no se ejercitó.

## 1. Funcionalidades verificadas (por pruebas automatizadas con datos simulados + revisión estática)
Roles `comercial`/`bodega`/`admin` con autorización real en API; vendedor por orden y rol del vendedor al crearla; rendimiento comercial; comisiones (vigencias, causación por pago, reversos, liquidaciones, CSV); costos de catálogo; compras por lotes y FIFO; valoración inicial; rentabilidad e inventario valorizado; gastos con categorías administrables; resumen financiero; país + municipios DIVIPOLA; autocompletado de comprador; tope de descuento del comercial configurable; bodega sin precios; trazabilidad de ajustes de stock.

## 2. Pruebas ejecutadas
| Control | Resultado |
|---|---|
| `pnpm --filter api test` | **317 pasan con base real (0 omitidas)** (11 integración previas + 8 nuevas de lotes) |
| `tsc --noEmit` api y web | limpio |
| `pnpm --filter api build`, `next build`, `verify:architecture` | correctos |
| `pnpm audit --prod` | 78 hallazgos preexistentes (ver §8); `package.json` y lockfile sin cambios en esta rama |
| Revisiones independientes (subagentes) | 6 rondas (fases 1, 3, global, FIFO, comprador/ciudades, final); sin hallazgos CRITICAL abiertos |

## 3. Pruebas ejecutadas con base real y navegador (2026-11-02, tarde)
| Prueba | Resultado |
|---|---|
| `prisma migrate deploy` 0001–0044 en Postgres 16 | Aplicadas. Para una base nueva hubo que (a) crear los roles de Supabase (`anon`, `authenticated`, `service_role`) que exige la 0026 y (b) ejecutar a mano las dos sentencias `CREATE INDEX CONCURRENTLY` de la 0030 y marcarla como aplicada (**problema preexistente**: `CONCURRENTLY` no puede correr dentro de la transacción de `migrate deploy`). |
| Deriva `schema.prisma` ↔ base | Sin deriva en ninguna tabla/columna/tipo de esta rama (solo diferencias antiguas preexistentes, p. ej. FKs y defaults de migraciones anteriores). |
| Integración (11 previas + 10 de lotes/FIFO) | **21/21** en serie, 6 corridas seguidas sin fallos tras las correcciones. Suite completa en serie: **317/317, 0 omitidas**. |
| E2E en navegador (Chrome 1440×900 y 390×844) | Login y navegación por rol; panel admin y todas las pantallas financieras; compras por lotes e inventario valorizado ($1.920.000 con 4 lotes); creación de pedido como comercial; autocompletado de cliente, nombres compuestos y ambiguos; ciudades con y sin tildes y con teclado; país distinto de Colombia; descuento topado (UI y servidor); pago → costeo FIFO **automático** → comisión → rentabilidad → resumen financiero; bodega sin precios; móvil sin desbordes. |
| Pendiente | Flujo de pago real de Mercado Pago (no hay credenciales ni sandbox configurado); build de Cloudflare (`build:cloudflare`); carga/estrés; `next lint` (no configurado). |

## 4–5. Errores encontrados y correcciones (resumen acumulado)
Ver `PROGRESO.md`. En esta última ronda: **descuento de hasta 100 % para comercial** → tope configurable (por defecto 10 %, admin sin tope, aplicado en el API y reflejado en la pantalla); **comisión dependía del rol actual** → la orden guarda el rol del vendedor al crearla; **bodega veía montos de órdenes** → vista sin precios/totales y sin factura PDF; **costeo dependía de abrir reportes** → trabajador automático cada 60 s con reintentos y retroceso, estado y pendientes visibles (`/inventory/costing-status`); **ajuste manual de stock sin trazabilidad ni bloqueo** → transacción con `FOR UPDATE`, rechazo por debajo de lo reservado, movimiento + auditoría; importación Excel auditada.

## 6. Evidencias visuales
27 capturas JPEG en `docs/admin-finance/evidencias/` (datos sintéticos): `01`–`08` admin (dashboard, inventario valorizado, comisiones y pantallas financieras), `09`–`18` comercial (órdenes, búsqueda y autocompletado de clientes, nombres compuestos y ambiguos, confirmación de sobrescritura, ciudades, descuento topado, pedido creado, móvil), `19`–`21` bodega (sin precios), `22`–`26` admin tras la venta (comisión causada, rentabilidad, resumen financiero, rendimiento, móvil). `15b` muestra país ≠ Colombia.

## 7. Estado de las migraciones (todas aditivas, ninguna aplicada)
0037 roles · 0038 audit_log · 0039 orders.seller_id · 0040 comisiones · 0041 costos · 0042 gastos + categorías iniciales · 0043 lotes/FIFO · 0044 app_settings + orders.seller_role. Revisadas estáticamente (sin DROP/DELETE/UPDATE destructivo); **sin validar contra Postgres real**. Nota: el schema Prisma no puede representar los `CHECK` ni el índice parcial agregados a mano; `prisma migrate dev` podría detectar "drift" por ellos.

## 8. Riesgos restantes
- **Dependencias preexistentes** (no introducidas aquí): Next.js < 15.5.28 (RCE en optimización de imágenes —la variante crítica descrita es para servidores Windows— y DoS en Server Actions), `proxy-addr` < 2.0.8 vía Express (suplantación de IP que afecta el límite de peticiones), `body-parser`, `undici` (vía `untube`), `sharp`, `zod`, entre otras. Requieren una actualización controlada y su propio ciclo de pruebas.
- Costeo FIFO: orden dependiente de la fecha de pago; líneas `sin_lote` no se reevalúan solas; el ajuste manual/Excel de stock no ajusta lotes (se ve como "sin valorar" o "excede").
- `municipioCodigo` se valida solo por formato; nombres de dos palabras se separan sin aviso.
- Valor inicial del tope de descuento (10 %) es una decisión técnica provisional: confirmar con negocio.
- Consultas SQL crudas y bloqueos sin ejecución real.

## 9. Plan para cerrar las condiciones
1. Actualizar dependencias vulnerables (Next ≥ 15.5.28, Express/proxy-addr/body-parser, sharp, zod) con su ciclo de pruebas.
2. Staging con copia de datos y respaldo: migraciones (ojo con la 0030 y los roles de Supabase al crear desde cero), validación de la sección 6 del doc 08 y de las validaciones post-despliegue del doc 07; prueba del flujo real de Mercado Pago en sandbox.
3. Decisiones de negocio abiertas (doc 07 §5).
4. Despliegue y rollback según doc 07.
Reproducir el entorno de pruebas local: `docker run -d --name dorella-pg-test -e POSTGRES_PASSWORD=<temporal> -e POSTGRES_DB=dorella_test -p 127.0.0.1:55432:5432 postgres:16`, crear los 3 roles de Supabase, `prisma migrate deploy` (resolviendo la 0030 como se indicó) y `TEST_DATABASE_URL=… npx vitest run --no-file-parallelism` (las integraciones deben correr en serie sobre una base compartida).

## 10. Revisión independiente final (hallazgos y resolución)
Sin CRITICAL/HIGH. Corregidos: (M1) el `PUT` de producto podía cambiar el stock sin bloqueo ni trazabilidad → ahora el stock va siempre por el ajuste con bloqueo, validación contra lo reservado, movimiento y auditoría; (M2) la comisión "estimada" del resumen usaba el rol actual → ahora usa el rol de la orden; (L1) el estado del trabajador ocultaba fallos por orden → informa cuántas fallaron; (L3) índice parcial sobre `order_items.costo_metodo IS NULL` (en la migración 0044, aún sin aplicar); (L5) prueba de lotes menos agresiva (8 envíos simultáneos). Aceptados: estado del trabajador por instancia; `tierAtPurchase` visible para bodega (constantes públicas); búsqueda de comercial por referencia de proveedor sin devolver ese campo.

## 11. Defectos hallados por la base real y el navegador (corregidos)
1. **Números de orden con 4 dígitos aleatorios** (preexistente): chocaban bajo concurrencia (paradoja del cumpleaños) y tumbaban el pedido con un 500 → ahora `DOR-AAAAMMDD-` + 6 caracteres criptográficos.
2. **Compras simultáneas** fallaban por el límite de espera de transacciones de Prisma → límites ampliados en compras y ajustes de lote.
3. **El diálogo «¿Reemplazar los datos escritos?» enviaba el formulario y creaba el pedido** (bug introducido en esta rama; botones del `ConfirmDialog` sin `type="button"` dentro de un `<form>`) → corregido.
4. **«ca» no mostraba Cali ni Calarcá entre las primeras 8 opciones** → capitales primero, hasta 40 opciones con desplazamiento.
5. Prueba de integración preexistente comparaba conteos globales de órdenes y fallaba al correr junto a otros archivos → acotada a sus propios datos.

## Adenda 2026-11-03 — cierre de pre-release
Recomendación vigente: **APTO CON CONDICIONES**. Cambios respecto a este informe: E2E en base PostgreSQL nueva y desechable (`node e2e/run-clean.mjs`, 77/77 en tres ejecuciones, evidencias en `evidencias/e2e-limpia/`); integración con producción real (`origin/main` @ `7767d25`); dependencias 99 → 19 vulnerabilidades (críticas solo en pruebas); ensayo de respaldo/restauración y migraciones 0037–0044 en staging local; rollback de roles probado; optimización de consultas del Dashboard con verificación de equivalencia. Detalle y matriz en `PROGRESO.md`, `10-optimizacion-rendimiento.md` y `11-plan-publicacion-y-rollback.md`.
