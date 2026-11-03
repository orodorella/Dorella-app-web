# 12 — Release mínimo: alcance, commit candidato, orden de publicación y recuperación

Estado: **preparado, NO publicado.** Sin push, merge, despliegue ni migración productiva. Principio: cambio mínimo necesario; no se toca lo que ya funciona.

## 1. Commit candidato
- Rama local `release/finanzas-minimo`, creada **desde producción real** (`origin/main` @ `7767d25`, verificado con `git fetch`: sin commits nuevos).
- Commits sobre producción:
  1. `feat(admin): roles y permisos, ventas por comercial, comisiones, costos y rentabilidad, gastos, compras por lotes con FIFO, dashboard financiero y velocidad de Productos/Dashboard` — todo el alcance autorizado.
  2. `fix(api): numero de orden con entropia suficiente` — **aprobado e incluido** (ver §4).
  3. Documentación del release.
  4. `fix(admin): publicar y ocultar productos en la tienda queda solo para el administrador` — decisión aprobada (ver §8).
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

## 4. Número de orden (commit 2, aprobado)
`DOR-AAAAMMDD-####` tiene 10.000 combinaciones por día; con ~30 pedidos diarios la probabilidad de choque ronda el 4 % diario y el pedido falla con 500. Lo usan el pedido manual del comercial (en alcance) y el checkout público. El commit lo cambia a 6 caracteres alfanuméricos (19 de 20 caracteres de la columna). Compatibilidad verificada en el código: Mercado Pago identifica por `orderId` y `external_reference` (el número solo viaja como metadato de texto en `metadata.order_number`), el PDF lo usa en el nombre de archivo (caracteres alfanuméricos), la interfaz solo lo muestra (checkout, "mis pedidos", WhatsApp), comisiones y dashboard lo leen como texto, y el prefijo `ACD-` de academia ya guarda alfanuméricos en la misma columna. Los pedidos existentes conservan su número; ambos formatos conviven (restricción única). No hay otros cambios en el checkout.

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
- **RESUELTO (decisión aprobada): publicar/ocultar productos es solo del administrador.** `PATCH /api/admin/products/:id/visibility` exige `finance:read` (igual que desactivar) y la pantalla deja el indicador Visible/Oculto sin acción para bodega; probado en `rbac.test.ts`. Bodega conserva productos (sin precios), inventario, órdenes y dashboard operativo. Texto anterior, ya superado: **Bodega puede mostrar/ocultar productos en la tienda** (`PATCH /api/admin/products/:id/visibility`, reversible) y gestionar sus imágenes; **crear, importar, exportar y desactivar (borrado lógico) son solo de admin** (`finance:read`). El revisor automático de seguridad señaló la diferencia entre `visibility` y `DELETE`; es intencional (la pantalla ofrece el interruptor a quien gestiona productos y reserva lo irreversible al admin) y toda la ruta exige sesión y `products:manage`/`inventory:manage` (comercial recibe 403, probado en `rbac.test.ts`). Si negocio quiere visibilidad solo para admin, es añadir `requirePermission('finance:read')` a esa ruta y ocultar el botón.
- Tope de descuento extra del comercial: se mantiene el 10 % provisional, configurable por el administrador (decisión aprobada).
- Mercado Pago: implementación existente sin cambios y sin nuevas pruebas de integración (decisión aprobada).
- Bodega puede cancelar pedidos ya pagados y la búsqueda de clientes es consultable por comerciales (≥3 letras, 10 resultados por página); ver `07-despliegue-y-rollback.md` §5.

## 9. Disparadores de despliegue (evidencia de solo lectura, GitHub)
| Plataforma | Evidencia | Conclusión |
|---|---|---|
| **Railway (API)** | El commit de producción `7767d25` tiene el estado `divine-encouragement - api: success — api.dorellajoyeria.com`; todos los despliegues de GitHub son del entorno `divine-encouragement / production`; ramas de feature y correcciones **no** tienen ese estado | Despliega producción desde `main`. No compila otras ramas (inferido) |
| **Cloudflare Workers Builds** (`dorella-app-web`) | **Todas** las ramas remotas tienen su check (incluida `cloudflare-opennext-web`, que nunca estuvo en `main`) | Compila **cada rama que se empuja**. Si la rama es la de producción, despliega; si no, normalmente sube una versión de vista previa. **La rama de producción y el comando de despliegue de ramas no productivas no son visibles sin el panel** |
| **Vercel** | Ningún commit tiene estado de Vercel | Sin evidencia de que siga conectado; no se pudo consultar (token de la CLI inválido) |

Datos que faltan (solo en paneles): Cloudflare → `dorella-app-web` → *Settings → Builds*: **rama de producción**, "Build non-production branches" y su comando de despliegue (que sea `versions upload` y no `deploy`); Railway → servicio API → *Settings → Source*: rama conectada y *PR Environments*; Vercel → *Settings → Git*. Consecuencia práctica: **empujar la rama de release a GitHub ya inicia un build en Cloudflare** (vista previa que usaría la API real), por lo que conviene publicar en el orden del §5 o confirmar antes el comando de ramas no productivas.

## 10. Pre-vuelo de migraciones y respaldo (no ejecutado en producción)
- `docs/admin-finance/ops/preflight-produccion-solo-lectura.sql`: transacción de solo lectura que comprueba (1) que la última migración sea la 0036 y no haya ninguna sin terminar, (2) que el esquema no tenga aún nada de 0037–0044 y el enum `Role` sea `cliente,admin`, (3) línea base de conteos y stock para comparar después y (4) versión y tamaño. Probado en la base de ensayo; en producción requiere tu autorización y `DIRECT_URL`.
- Compatibilidad con el backend actual y no modificación de órdenes/inventario: ya verificadas en el ensayo (§3). Respaldo restaurable: **no verificable desde aquí** (Supabase → *Database → Backups*: PITR activo y copia reciente; procedimiento de restauración de prueba en el plan §9).
- Regla: si alguna comprobación dice REVISAR o no hay respaldo restaurable, no se migra.
