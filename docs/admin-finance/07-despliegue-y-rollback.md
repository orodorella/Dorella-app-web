# Fase 7 — Plan de despliegue, validaciones y rollback

> Actualización: el estado de QA y la recomendación vigente están en [09-qa-final-y-recomendacion.md](09-qa-final-y-recomendacion.md) (migraciones 0037–0044; **NO APTO** hasta cerrar sus condiciones).

**Este documento es un plan. Nada se ha subido, mezclado, desplegado ni aplicado a ninguna base de datos. Cada paso de "Producción" requiere autorización explícita.**

## 1. Estado verificado localmente
| Verificación | Resultado |
|---|---|
| Base | `main` @ `f0617ff`; rama `feature/admin-roles-finances-commissions` (commits de Fase 0 a 6 + correcciones) |
| Diff vs `main` | Solo archivos nuevos y modificados; **0 archivos eliminados**; sin cambios en `.env*`, `wrangler.jsonc`, `open-next.config.ts`, `package.json`, `pnpm-lock.yaml`, `next.config`, Railway o Cloudflare |
| Variables de entorno | **Ninguna nueva ni modificada** |
| Migraciones 0037–0043 | Solo `CREATE`/`ADD COLUMN`/`ADD VALUE`/`CHECK`/`INSERT … ON CONFLICT DO NOTHING`; sin `DROP`/`DELETE`/`UPDATE`/`TRUNCATE` |
| `pnpm --filter api build` | OK |
| `pnpm --filter api test` | **277 pasan, 11 omitidas** (integración con BD), 0 fallan (línea base previa: 155) |
| `tsc --noEmit` api y web | limpio |
| `next build` (web) | OK; `verify:architecture` OK |
| `next lint` | No configurado en el repo (pide configuración interactiva); no se ejecutó |
| Build Cloudflare (`build:cloudflare`) | **No ejecutado** localmente; correrlo en el pipeline habitual |
| Pruebas con base de datos real / E2E | **No ejecutadas** (no hay base aislada verificada). Las consultas SQL crudas y las transacciones se probaron con la capa de datos simulada |

## 2. Antes de desplegar (obligatorio)
1. **Respaldo de la base** (Supabase: backup/PITR o `pg_dump`) y anotar el commit actual de producción (`f0617ff` si no hay otro).
2. Aplicar y probar las migraciones (0037–0043) en un **entorno de staging con copia de datos** (`prisma migrate deploy` solo allí). Verificar que `prisma migrate status` quede limpio y que las órdenes existentes sigan intactas (`seller_id` y `costo_unitario_snapshot` en NULL es lo esperado).
3. En staging, ejecutar manualmente: login de admin, comercial y bodega; crear pedido manual como comercial; marcar pagado como admin; ver comisión causada; liquidar; cargar costo; registrar gasto; abrir `/admin/finanzas`; cancelar una orden y comprobar el reverso.
4. Revisar con el dueño las decisiones abiertas (sección 5).
5. Revisar el diff completo (`git diff main...HEAD`) y los permisos de cada rol (`01-fase1-roles-permisos.md`).

## 3. Orden de despliegue propuesto (cuando se autorice)
1. **Migraciones primero** (son compatibles hacia atrás: el código anterior ignora columnas/tablas nuevas): `prisma migrate deploy` contra producción, con backup confirmado. 0037 solo agrega valores al enum.
2. **API (Railway)** desde la rama aprobada. Es compatible con los datos antiguos (todo lo nuevo es nullable/aditivo).
3. **Web (Cloudflare Workers)**: usar los comandos ya configurados (`verify:architecture` + `build:cloudflare`, `wrangler deploy` desde `packages/web`). No se modifica la configuración del dashboard.
4. Crear los usuarios Comercial 1 / Comercial 2 / Bodega cambiando su rol desde `/admin/usuarios` (flujo existente de verificación por código).
5. Configurar porcentajes en `/admin/comisiones` (sin definir = 0 %) y cargar costos en `/admin/costos`.

## 4. Validaciones posteriores al despliegue
- `GET /api/health`; login de un cliente y de un admin; catálogo e imágenes cargan; checkout (Mercado Pago) y pedido manual existentes siguen funcionando; no hay 401 inesperados; stock/reservas sin cambios.
- Un comercial recibe 403 en `/api/admin/products`, `/api/admin/finance/*`, `/api/admin/commissions/*`, `/api/admin/expenses/*`; bodega recibe 403 en finanzas y en `mark-paid`.
- Una orden nueva de comercial queda con `seller_id`; `precioBase` y costos no aparecen en respuestas de cliente.
- Revisar logs de errores 500 durante la primera hora.

## 5. Decisiones de negocio abiertas
1. ¿Tope de `descuentoAdicional` para comerciales? (hoy hasta 100 %, solo auditado).
2. ¿Bodega debe ver montos por orden (totales/subtotales)? Hoy sí, por el flujo de preparación.
3. Política cuando alguien deja de ser comercial antes de que corra la causación.
4. Carga de soportes de gastos como archivo (requiere crear un bucket privado en Supabase: cambio remoto no hecho).
5. Porcentajes iniciales de comisión (0 / 2 / 1 % eran ejemplos; no se sembraron).

## 6. Rollback
- **Código**: volver al commit anterior de producción (`f0617ff`) en Railway y Cloudflare (re-despliegue de ese commit / versión previa del Worker). Como las migraciones son aditivas, el código anterior sigue funcionando con la base ya migrada.
- **Roles**: usuarios con rol `comercial`/`bodega` se tratan como no-admin por el código anterior (no ven el panel). Para devolverlos a cliente: cambio de rol desde `/admin/usuarios` o `UPDATE users SET role='cliente' WHERE role IN ('comercial','bodega')` (con respaldo).
- **Datos nuevos**: tablas `commission_*`, `product_costs`, `expenses`, `expense_categories`, `audit_log` y columnas `orders.seller_id`, `order_items.costo_unitario_snapshot` pueden quedarse sin uso. Solo si es imprescindible, eliminar en orden inverso (0042 → 0037) con el SQL de rollback incluido como comentario en cada `migration.sql`; **el enum `Role` no permite quitar valores** (son inocuos).
- **Recuperación total**: restaurar el backup previo (PITR) — último recurso; implica perder datos posteriores al respaldo.

- Lotes/FIFO y ciudades DIVIPOLA: ver [08](08-inventario-costos-lotes-y-comprador.md) (migración 0043; rollback: eliminar `lot_consumptions`, `inventory_movements`, `inventory_lots`, quitar `order_items.costo_total_snapshot`/`costo_metodo`).

## 7. Riesgos conocidos
- SQL crudo y transacciones sin prueba contra Postgres real (ver sección 1).
- Causación de comisiones perezosa (se ejecuta al abrir resumen o liquidar), no en el instante del pago.
- Sin desglose de IVA; rentabilidad = utilidad bruta, no neta.
- Bodega ve montos de órdenes; comercial puede dar descuentos altos (decisiones abiertas).
- `next lint` no configurado y E2E no existentes en el repo.
