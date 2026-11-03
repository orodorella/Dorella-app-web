# Fase 1 — Roles y permisos

## Roles y permisos (fuente: `packages/shared/src/constants/permissions.ts`)

| Permiso | admin | comercial | bodega |
|---|:-:|:-:|:-:|
| orders:create (crear pedido manual) | ✔ | ✔ | — |
| orders:read_own (solo sus órdenes) | ✔ | ✔ | — |
| orders:read_all | ✔ | — | ✔ |
| orders:update_status (estado, confirmar) | ✔ | — | ✔ |
| orders:mark_paid | ✔ | — | — |
| products:manage / inventory:manage | ✔ | — | ✔ |
| dashboard:operational | ✔ | — | ✔ |
| dashboard:financial, finance:read, commissions:manage, expenses:manage | ✔ | — | — |
| users:manage, categories:manage, academy:manage | ✔ | — | — |

Un rol desconocido (o `cliente`) no tiene permisos. `comercial` es un rol único para N personas; cada persona se identifica por `User.id`.

## Autorización efectiva
- Backend: `requirePermission(...)` (`middleware/requirePermission.ts`) en `/api/admin/orders`, `/api/admin/products` y `/api/admin/dashboard`. `users`, `categories` y `academy` siguen con `requireRole('admin')`.
- `GET /api/admin/orders`, `/:id`, `/:id/pdf` filtran por `sellerId` cuando el rol no tiene `orders:read_all`; una orden ajena responde 404.
- `POST /api/admin/orders/manual`: el vendedor es `req.user.id`. El esquema es `.strict()`: un `sellerId` en el cuerpo devuelve 400.
- `GET /api/admin/dashboard/operational` (bodega y admin) no incluye ingresos, clientes ni valor de inventario. El resto del dashboard exige `dashboard:financial`.
- Frontend: `lib/admin-access.ts`, `admin/layout.tsx` y `middleware.ts` ocultan/redirigen por rol; es solo UX, la seguridad es la del API.

## Modelo y migraciones (aditivas, sin aplicar)
| Migración | Cambio | Rollback |
|---|---|---|
| 0037_role_comercial_bodega | `ALTER TYPE "Role" ADD VALUE` ×2 | No se pueden quitar valores de un enum; son inocuos si no se usan |
| 0038_audit_log | tabla `audit_log` | eliminar la tabla |
| 0039_orders_seller_id | `orders.seller_id` nullable + índice + FK `ON DELETE SET NULL` | quitar índice y columna |

Las órdenes anteriores quedan con `seller_id = NULL` ("Sin comercial asignado"); no se infiere el vendedor.

## Auditoría
`audit_log` registra: `user.role_changed` (ambos caminos de cambio de rol), `order.manual_created`, `order.status_changed`, `order.marked_paid`.

## Pruebas
`packages/api/src/tests/rbac.test.ts`: matriz de permisos, 401/403 por HTTP real para cliente/comercial/bodega/admin, límite por vendedor, rechazo de `sellerId` en el cuerpo, ausencia de `precioBase` en las búsquedas de pedido manual.
