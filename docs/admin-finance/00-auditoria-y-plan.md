# Fase 0 — Auditoría y plan: roles, rentabilidad, gastos y comisiones

Rama: `feature/admin-roles-finances-commissions` (base: `main` @ `f0617ff`, 2026-11-02).
Estado: **solo lectura**. Ningún archivo de producción, `.env` ni migración fue tocado.

## 1. Arquitectura real encontrada (difiere del brief en un punto)

| Tema | Brief | Realidad |
|---|---|---|
| Backend | NestJS | **Express 5 + Prisma 6 + TS strict** (`packages/api`). No hay guards de Nest: la autorización son middlewares (`requireAuth`, `requireRole`). |
| Frontend | Next.js | Next.js 15 App Router en `packages/web`, desplegado en **Cloudflare Workers** (OpenNext). `packages/frontend` (Vite) es legado: no tocar. |
| Gráficas | "la ya instalada" | `recharts ^3.9.2` ya está en `packages/web`. |
| Excel/CSV | reutilizar | `exceljs` en API (`product-export.service.ts`, `product-import.service.ts`). |
| Pagos | Mercado Pago | Presente (`mercadopago.service.ts`, `PaymentAttempt`). WhatsApp: pedidos manuales con `origen='whatsapp'`. |
| Despliegue | Railway + Cloudflare | API en Railway; web en Cloudflare (ver `AGENTS.md` y `packages/web/CLOUDFLARE_DEPLOYMENT.md`). No hay CI en el repo: el despliegue se dispara desde los dashboards. |

Línea base de pruebas: `pnpm --filter api test` → **14 archivos, 155 pasan, 11 omitidas** (las omitidas son de integración con BD). No hay scripts de lint ni typecheck en `package.json`; el typecheck se hace con `tsc` en el build.

## 2. Modelo actual relevante

- `Role` enum: `cliente | admin`. Sin otros roles.
- `User.tier` (`detal | por_mayor | gran_mayor`) → **ya es la "modalidad"**. `Order.tierAtPurchase` la congela por orden; `descuentoAplicado` guarda el % del nivel; `OrderItem.descuentoAdicional` es un descuento extra por línea.
- `Order.createdByAdminId` (FK a `users`) se llena **solo** en `createManualOrder`. Las órdenes de tienda no tienen vendedor.
- `OrderItem.precioBaseSnapshot` es el **precio base de catálogo**, NO un costo. No sirve para rentabilidad.
- `Product.precioBase` es precio de lista (nunca se expone fuera de admin; regla de seguridad #1).
- No existe ningún campo de costo, gasto ni comisión.
- Montos: `Decimal(12,2 / 15,2)` en COP. Se mantendrá `Decimal` en BD y `Prisma.Decimal`/enteros en cálculo, sin `float`.
- Estados de orden: `pending | confirmed | invoiced | shipped | delivered | cancelled`. Pago separado en `paymentStatus` (`pending, in_process, approved, rejected, cancelled, refunded, charged_back`) + `paidAt`.
- Inventario: `InventoryReservation` (reserva al crear, se consume al marcar pagada). No debe tocarse.

## 3. Superficie de autorización actual

- `authMiddleware` lee `role/tier` frescos de la BD en cada request (bueno: un cambio de rol aplica de inmediato).
- Todas las rutas `/api/admin/*` hacen `router.use(requireRole('admin'))`: academy, categories, dashboard, orders, products, users.
- Frontend: `admin/layout.tsx` exige `user.role === 'admin'`; también comprueban `'admin'`: `middleware.ts`, `Navbar.tsx`, `login`, `callback`, `usuarios`, `academy-access.ts`. Un rol nuevo (`comercial`, `bodega`) **no coincide con `'admin'`**, así que todo lo existente lo rechaza por defecto (fallo seguro).
- Cambios de rol/nivel ya exigen verificación (`SensitiveUserChangeVerification`).
- Hay una migración RLS solo para `products` (`0026_rls_products`). Pendiente verificar en Fase 1 si el frontend usa Supabase directo para algo más que Storage.

## 4. Riesgos identificados

1. **Enum de Postgres**: `ALTER TYPE "Role" ADD VALUE` es aditivo y seguro, pero el valor nuevo no puede usarse en la misma transacción; se separa en su propia migración.
2. **`createdByAdminId` no equivale a vendedor** en datos históricos (un admin pudo cargar pedidos en nombre de otra persona). No se infiere: se agrega `seller_id` nuevo y las órdenes previas quedan "Sin comercial asignado".
3. **Costo histórico**: sin snapshot por línea, cambiar el costo reescribiría la rentabilidad pasada. Se congela `costo_unitario_snapshot` al crear la orden; `NULL` = "pendiente de costeo" (nunca 0).
4. **Modalidad de órdenes manuales**: hoy sale de la cuenta del cliente. El comercial no podrá elegirla libremente (evita manipular comisión). Es decisión de negocio (ver §8).
5. **Fuga de datos sensibles**: `getAdminOrders` y los DTO de orden no deben incluir costo/margen para `comercial`/`bodega`. Se usarán selects explícitos por permiso y pruebas que verifiquen ausencia de campos, como la prueba de `precioBase`.
6. **Regresiones ya corregidas** que no se deben reintroducir: 401/sesiones (`authMiddleware`, refresh), imágenes (`84766e1`, `a74f9eb`), transacciones de pedidos manuales (`853c4d4`, `e44d9b7`), proxy de Railway (`c78b2b8`).
7. **Archivo sin seguimiento** `packages/api/src/tests/password-reset.test.ts` existe en el árbol local y pasa; no se incluye en los commits de esta rama.

## 5. Diseño propuesto (todo aditivo)

**Roles y permisos (Fase 1)**
- `Role` += `comercial`, `bodega`. Un único rol `comercial` para N personas; la identidad individual sale de `User.id`.
- Mapa rol→permisos en `shared` (`orders:read`, `orders:create`, `products:write`, `inventory:write`, `finance:read`, `commissions:manage`, `users:manage`, …) y middleware `requirePermission(...)`. `requireRole('admin')` se conserva donde ya está.
- Comercial: crear/consultar **solo sus** órdenes. Bodega: productos, inventario, órdenes, dashboard operativo, sin costos. Admin: todo.
- Las rutas `/api/admin/orders` pasan de `requireRole('admin')` a permisos por endpoint; el servicio filtra por `sellerId` cuando el rol es `comercial`.
- Auditoría: tabla `audit_log` (actor, acción, entidad, antes/después) para cambios de comisión, costos, rol y liquidaciones.

**Vendedor y modalidad (Fase 2)**
- `orders.seller_id` (UUID nullable, FK `ON DELETE SET NULL`, índice). Se asigna desde la sesión en `createManualOrder`; nunca viene del body.
- Modalidad = `tierAtPurchase` existente (por orden). Como el nivel es por orden, no se necesita modalidad por línea. Reportes agregados con SQL/Prisma `groupBy` sobre `orders` + `order_items`.
- Módulo "Rendimiento comercial" con filtros comercial/fecha/categoría/modalidad/estado y gráficas Recharts.

**Comisiones (Fase 3)**
- `commission_rules(id, tier, user_id NULL, porcentaje Decimal(7,4), vigente_desde, vigente_hasta NULL, created_by)`: regla general por modalidad; override opcional por comercial. Nunca se edita una regla: se cierra y se crea otra.
- `commission_entries(order_id, seller_id, tier, base, porcentaje_aplicado, monto, estado)` con snapshot del % → cambios futuros no alteran lo ya causado.
- `commission_liquidations` + `commission_adjustments` + pagos con fecha y quién.
- Estados: **estimada** (orden creada, no pagada) → **causada** (pago aprobado y orden no cancelada) → **pagada** (liquidación pagada); **anulada** si hay cancelación/reembolso antes de liquidar; si ya estaba liquidada, genera un ajuste negativo en el siguiente periodo (no se reescribe el pasado).
- Idempotencia: `UNIQUE(order_id)` en `commission_entries`.

**Costos y rentabilidad (Fase 4)**
- `product_costs(product_id, costo_adquisicion, costo_adicional, costo_total, vigente_desde, created_by)` (historial) y `order_items.costo_unitario_snapshot Decimal NULL`.
- Fórmulas: `utilidad = ingreso − costo`; `margen = utilidad / ingreso`; `recargo = utilidad / costo` (se muestran ambos, rotulados).
- Reportes muestran "utilidad bruta" y "resultado operativo estimado", nunca "utilidad neta".
- Ingreso neto = `Order.total` de órdenes pagadas y no canceladas/reembolsadas. El IVA no está desglosado en el esquema; se documenta la limitación.

**Gastos (Fase 5)**
- `expense_categories` (administrables, con `is_active`) y `expenses(fecha, descripcion, valor Decimal(15,2), category_id, proveedor, medio_pago, observaciones, soporte_url, created_by)`.
- Soportes en el bucket existente de Supabase Storage con ruta privada (sin URL pública).
- Anti doble conteo: categoría marca `afecta_resultado` / `capitalizable_a_costo`; el flete de compra ya incluido en `costo_adicional` se registra con una categoría que no resta dos veces.

**Dashboard financiero (Fase 6)**: endpoint `/api/admin/finance/summary` (permiso `finance:read`), página admin nueva con el estilo actual; exportación CSV/XLSX con `exceljs`.

## 6. Migraciones planeadas (todas aditivas; ninguna se aplica a producción sin autorización)

| # | Contenido | Fase |
|---|---|---|
| 0037 | `ALTER TYPE "Role" ADD VALUE 'comercial', 'bodega'` | 1 |
| 0038 | `audit_log` | 1 |
| 0039 | `orders.seller_id` + FK + índice | 2 |
| 0040 | `commission_rules`, `commission_entries`, `commission_liquidations`, `commission_adjustments` | 3 |
| 0041 | `product_costs`, `order_items.costo_unitario_snapshot` | 4 |
| 0042 | `expense_categories`, `expenses` (+ seed de categorías iniciales) | 5 |

Reglas: sin `DROP`, sin `reset`, columnas nuevas nullable o con default, validación en una BD local/aislada. Cada migración con su rollback documentado (SQL inverso) en `docs/admin-finance/`. Antes de cualquier despliegue: respaldo (`pg_dump`/snapshot de Supabase) a cargo del dueño del proyecto.

## 7. Estrategia de pruebas y regresión

- Mantener verde la línea base (155). Ejecutar `pnpm --filter api test` tras cada commit.
- Pruebas nuevas por fase: matriz rol×endpoint (403 efectivo por HTTP directo), vendedor tomado de la sesión (ignora `sellerId` del body), ausencia de campos de costo/margen en respuestas no-admin, aritmética monetaria exacta, snapshots de comisión tras cambio de %, idempotencia, cancelación/reembolso.
- Pruebas de BD (migraciones y transacciones) solo contra un Postgres local/aislado, nunca contra el `DATABASE_URL` de producción.
- Build: `pnpm --filter api build` y `pnpm --filter web build`; para Cloudflare `verify:architecture` antes de `build:cloudflare`.

## 8. Decisiones de negocio pendientes (con valor por defecto propuesto)

1. **¿Cuándo se causa la comisión?** Propuesto: al aprobarse el pago (`paymentStatus='approved'` o marcada pagada manualmente), no al crear la orden.
2. **Base de la comisión**: propuesto = suma de `subtotal` de líneas (después de descuentos), excluyendo flete.
3. **Modalidad de pedidos manuales**: hoy = nivel de la cuenta del cliente; pedido a clientes sin cuenta = `detal`. ¿El comercial puede elegir otra? Propuesto: no.
4. **¿Pueden los comerciales ver todas las órdenes o solo las suyas?** Propuesto: solo las suyas.
5. **Porcentajes iniciales**: los del brief (0 / 2 / 1 %) quedan solo como seed editable, marcados "ejemplo".
6. **Órdenes de tienda (sin vendedor)**: propuesto que no generen comisión.

## 9. Protocolo de despliegue (resumen; detalle en Fase 7)

Base verificada = `f0617ff`. Antes de pedir autorización: diff completo contra `main`, comprobar que `.env*`, `wrangler.jsonc`, `open-next.config.ts` y `.env.example` no cambian (o que los cambios son solo documentación de variables nuevas), build + pruebas verdes, migraciones revisadas, backup confirmado y plan de rollback. **No se hará push, merge, deploy ni migración productiva sin autorización explícita.** Variables nuevas previstas: ninguna por ahora.

## 10. Plan de ejecución

Fases 1→7 según el brief, un commit pequeño por funcionalidad, revisión individual por fase. No se avanza si hay errores críticos pendientes.
