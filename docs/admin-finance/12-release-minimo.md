# 12 — Release mínimo: alcance, commit candidato, orden de publicación y recuperación

Estado: **preparado, NO publicado.** Sin push, merge, despliegue ni migración productiva. Principio: cambio mínimo necesario; no se toca lo que ya funciona.

## 1. Commit candidato
- Rama local `release/finanzas-minimo`, creada **desde producción real** (`origin/main` @ `7767d25`, verificado con `git fetch`: sin commits nuevos).
- Commits sobre producción:
  1. `feat(admin): roles y permisos, ventas por comercial, comisiones, costos y rentabilidad, gastos, compras por lotes con FIFO, dashboard financiero y velocidad de Productos/Dashboard` — todo el alcance autorizado.
  2. `fix(api): numero de orden con entropia suficiente` — **opcional**, aislado (ver §4).
  3. Este documento (solo documentación).
- Diferencia contra producción: 90 archivos (la rama de trabajo tenía 155).

## 2. Clasificación de lo que cambia respecto a producción
| Categoría | Contenido |
|---|---|
| **Necesaria (funcionalidad pedida)** | Migraciones 0037–0044 y `schema.prisma`; permisos (`shared/constants/permissions.ts`, `requirePermission`); rutas y servicios de ventas, comisiones, costos, gastos, lotes/FIFO, dashboard financiero, auditoría y ajustes; páginas del panel (comisiones, costos, finanzas, gastos, inventario-costos, rendimiento, rentabilidad); pedido manual con vendedor y tope de descuento; Productos con filtros y paginación en servidor; Dashboard por secciones y consultas con índice |
| **Dependencia técnica indispensable** | `admin-access.ts`, `OperationalDashboard`, `colombia.ts`/`CityAutocomplete`/DIVIPOLA (autocompletado de comprador y ciudad del pedido manual, pedido en turnos anteriores), `tsconfig` de la API (excluye `colombia.test.ts` de `tsc`) |
| **Corrección directamente relacionada** | `ConfirmDialog` (`type="button"`: sin esto el diálogo enviaba el formulario del pedido manual), `useApi` (parámetro `signal` para cancelar peticiones al cargar por secciones), `formatCOP` (no mostrar $0 cuando bodega no ve precios) |
| **Compartido, cambio mínimo** | `middleware.ts`, `login/page`, `callback/page`, `Navbar` (acceso y destino por rol en lugar de `role === 'admin'`); `users.routes` y `admin-user-change-verification.service` (admitir los roles nuevos en el cambio de rol, con auditoría); `order.service` y `orders.routes` (vendedor y rol del vendedor en pedidos manuales, alcance por vendedor, costo congelado por línea) |
| **Ajeno al alcance → EXCLUIDO** | Actualización de dependencias (`package.json` ×5, `pnpm-lock.yaml`, 2 retoques de tipos de busboy), carpeta `e2e/` (queda en `integration/pre-release`), imágenes de evidencias |
| **Opcional → commit aparte** | Número de orden con más entropía (toca el checkout público) |

Verificado: **ningún archivo de Mercado Pago, pagos, checkout, Alegra, correo, almacenamiento, `env.ts`, `wrangler.jsonc`, `open-next` ni variables de entorno cambia.** El código nuevo no introduce variables de entorno.

## 3. Base de datos
- 8 migraciones nuevas (0037–0044), solo aditivas: `CREATE TABLE/INDEX/TYPE`, `ADD COLUMN` y `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS`. **Sin `UPDATE`, `DELETE`, `TRUNCATE` ni `DROP`.** Único `INSERT`: 9 categorías de gasto en una tabla nueva (0042). No se modifica ninguna migración histórica ni se toca inventario u órdenes existentes.
- Ensayo (plan §7): base tipo producción a 0036 → respaldo → restauración (conteos idénticos en 22 tablas) → migración en 7,2 s → tablas originales intactas, 0 restricciones sin validar. La API de producción actual sigue funcionando sobre el esquema nuevo (lectura y creación de pedido).
- Respaldo recuperable: procedimiento en plan §9 (respaldo gestionado de Supabase con PITR + `pg_dump -Fc`, restauración de prueba y comparación de conteos).

## 4. Decisión opcional: número de orden (commit 2)
`DOR-AAAAMMDD-####` tiene 10.000 combinaciones por día; con ~30 pedidos diarios la probabilidad de choque ronda el 4 % diario y el pedido falla con 500. Lo usan el pedido manual del comercial (en alcance) y el checkout público. El commit lo cambia a 6 caracteres alfanuméricos (19 de 20 caracteres de la columna). Ningún código depende del formato anterior. Si prefieres no tocar el checkout público, se publica sin ese commit; el riesgo de choque ya existe hoy en producción.

## 5. Despliegue automático y orden de publicación
Qué se sabe: Railway (API) despliega desde `main` (historial de despliegues de GitHub). Cloudflare/Vercel: **no verificable desde el repo** (sin workflows ni configuración); hay que mirar los paneles (plan §10). Por eso **no se hace push de ninguna rama hasta confirmarlo**, porque una rama de release también podría desplegar una vista previa.

Como el despliegue automático no permite controlar el orden, se hace compatible con cualquier orden **migrando primero y a mano**:
1. Respaldo (PITR + `pg_dump`) y anotar `origin/main` vigente (`git fetch`; hoy `7767d25`).
2. **Aplicar las migraciones 0037–0044 a producción** (`prisma migrate deploy` con `DIRECT_URL`, desde una máquina de confianza; requiere tu autorización). Son compatibles con la API actual, así que no hay corte.
3. Comprobar: `/api/health`, login, catálogo, creación de pedido y conteos de tablas originales.
4. Publicar (merge/push a `main`): Railway y Cloudflare despliegan solos. Hay una ventana de minutos con el panel nuevo sobre la API vieja (o al revés): solo afecta al panel de administración; el sitio público y el checkout no cambian.
5. Verificar el panel con un administrador y el Dashboard financiero.
6. **Observación de 24–48 h sin asignar roles `comercial`/`bodega`.** Después, asignarlos.

Nunca publicar el código antes que las migraciones: la API nueva sobre el esquema viejo falla en las consultas que usan columnas y tablas nuevas.

Variables y secretos: no cambian y no se tocan (`keep_vars: true` en el Worker; sin variables nuevas).

## 6. Recuperación
- **Código:** redeploy de `7767d25` en Railway y de la versión anterior del Worker en Cloudflare (o `git revert` de los commits 1 y 2). Revertir no deshace migraciones.
- **Esquema:** no se revierte; es aditivo y el código anterior lo ignora (probado).
- **Roles nuevos asignados:** antes de volver al código anterior ejecutar `docs/admin-finance/ops/rollback-roles.sql` (guarda el rol original y deja a esos usuarios como `cliente`); `restore-roles.sql` los devuelve. Sin roles asignados no hay nada que hacer.
- **Último recurso:** restauración del respaldo (pierde lo ocurrido después; las migraciones no pueden dañar datos porque no los modifican).

## 7. Validación del candidato (sin repetir lo ya cubierto)
Con las dependencias de producción (lockfile de `origin/main`): `tsc` de API y web, build de la API y build del frontend correctos; **19 archivos de prueba enfocados (271 pruebas)** — roles, comisiones, costos, gastos, FIFO/lotes, dashboard, productos, pedido manual e inventario, más regresión de órdenes, reservas, Mercado Pago (mocks) y sesiones — y 36 del web; E2E en base limpia sobre este árbol con las dependencias de producción: **77/77**.
No verificado: Mercado Pago real (sandbox sin credenciales; no se modificó), staging con datos reales, paneles de Railway/Cloudflare/Vercel.

## 8. Decisiones abiertas y hallazgos revisados
- **Bodega puede mostrar/ocultar productos en la tienda** (`PATCH /api/admin/products/:id/visibility`, reversible) y gestionar sus imágenes; **crear, importar, exportar y desactivar (borrado lógico) son solo de admin** (`finance:read`). El revisor automático de seguridad señaló la diferencia entre `visibility` y `DELETE`; es intencional (la pantalla ofrece el interruptor a quien gestiona productos y reserva lo irreversible al admin) y toda la ruta exige sesión y `products:manage`/`inventory:manage` (comercial recibe 403, probado en `rbac.test.ts`). Si negocio quiere visibilidad solo para admin, es añadir `requirePermission('finance:read')` a esa ruta y ocultar el botón.
- Tope de descuento extra del comercial: 10 % provisional (configurable por admin); confirmar con negocio.
- Bodega puede cancelar pedidos ya pagados y la búsqueda de clientes es consultable por comerciales (≥3 letras, 10 resultados por página); ver `07-despliegue-y-rollback.md` §5.
- Commit opcional del número de orden (§4).
