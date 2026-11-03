# 11 — Preparación de publicación, orden seguro y rollback

Estado: **preparado, NO ejecutado**. Nada se ha subido, mezclado ni desplegado; ninguna migración se aplicó a ninguna base remota.
Complementa a [07-despliegue-y-rollback.md](07-despliegue-y-rollback.md) con el estado real de producción (`7767d25`).

## 1. Qué se publicaría
- Rama local `integration/pre-release` (creada desde `feature/admin-roles-finances-commissions`). El commit exacto está en `PROGRESO.md`.
- Contiene: toda la rama de finanzas/comisiones/FIFO/rendimiento **más** `origin/main` @ `7767d25` (producción actual, "recover cleanly from expired sessions"), con 2 conflictos resueltos (`login/page.tsx`, `useApi.ts`) y dependencias actualizadas.
- Las ramas remotas `cloudflare-opennext-web`, `feature/mercado-pago-checkout-pro` y `fix/manual-order-reservation-transaction` tienen commits que esta rama no incluye, pero su contenido ya está en `main` (se comprobó el arreglo `ca9b2d7`: ya se lee rol/tier/estado desde la BD en cada petición). Son commits de sincronización, no código nuevo.

## 2. Qué desplegó producción realmente
Las implementaciones de GitHub (entorno `divine-encouragement / production`, Railway) apuntan a commits de `main`; la última es `7767d25` (2026-10-19). El `main` local estaba en `f0617ff`: **comparar siempre contra `origin/main` actualizado, no contra `main` local**.

## 3. Qué se desplegaría automáticamente
- No existe `.github/workflows`: el disparo se configura en las plataformas.
- Railway (API): evidencia de despliegue automático desde `main`.
- Cloudflare Workers (web): los docs mencionan un "Cloudflare Git build" pero no la rama conectada; **no verificable desde el repo**. Vercel (ruta de rollback) también podría estar conectado a `main`.
- **No hacer push a `main` ni crear PR hacia `main` hasta confirmar en los paneles de Railway, Cloudflare y Vercel qué ramas y eventos disparan despliegue.** Una rama de feature con Preview Deployments activos también puede desplegar una vista previa.

## 4. Migraciones 0037–0044 (nunca aplicadas en producción)
Todas son aditivas (CREATE TABLE/INDEX/TYPE, ADD COLUMN, `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS`); ninguna tiene `DROP` ni columnas `NOT NULL` sin valor por defecto. El código de producción actual sigue funcionando con el esquema nuevo.

Orden seguro:
1. Respaldo completo (Supabase backup/PITR confirmado); anotar commit y fecha.
2. Aplicar migraciones en **staging con copia de datos reales**; revisar bloqueos (`ALTER TABLE orders/order_items`).
3. Aplicar en producción con `prisma migrate deploy` **antes** de desplegar el código nuevo.
4. Desplegar API (Railway) y verificar `/api/health`.
5. Desplegar web y verificar login, catálogo, pedido manual y panel.
6. Con la API estable, asignar roles `comercial` / `bodega` (hasta entonces nadie los tiene).

Compatibilidad frontend/backend: la web nueva usa `/api/admin/dashboard?sections=` y filtros de productos; sobre una API vieja degradaría. La API nueva con una web vieja funciona (los parámetros son opcionales). Por eso **API primero, web después**.

## 5. Rollback
- **Código**: redeploy de `7767d25` en Railway y del despliegue previo en Cloudflare/Vercel. Revertir un commit **no** revierte migraciones.
- **Esquema**: no hace falta deshacerlo (aditivo). Excepción: si ya hay usuarios con rol `comercial` o `bodega`, el código viejo (enum `Role` sin esos valores) falla al leerlos; antes de un rollback de código hay que devolverlos a `cliente` o `admin` (script SQL por preparar y probar en staging).
- **Datos nuevos** (comisiones, lotes FIFO, gastos, auditoría) viven en tablas nuevas y no afectan al sistema viejo.
- Web: según `packages/web/CLOUDFLARE_DEPLOYMENT.md`, el rollback rápido a Vercel+Railway solo toca DNS/frontend; no borrar el proyecto Vercel en el primer lanzamiento.
- Variables y secretos remotos: este plan no los modifica (`wrangler.jsonc` usa `keep_vars: true`).

## 6. Dependencias
`pnpm audit`: 99 → 19 (0 bajas, 12 moderadas, 5 altas, 2 críticas). Quedan: `tinypool` (crítica, solo pruebas), `glob` (build de OpenNext), `postcss` (empaquetado en Next, solo build), `deepmerge-ts` (CLI de Prisma) y `zod` 3.x (requiere migración mayor a 4; decidir aparte). Ninguna crítica llega al runtime de producción.

## 7. Ensayo de staging local (evidencia, 2026-11-03)
Entorno 100 % local y desechable (contenedor `dorella-pg-stg`, 127.0.0.1:55435; datos sintéticos; nada de producción). Se repite con `docs/admin-finance/ops/`.

| Paso | Resultado |
|---|---|
| Base "tipo producción" | Migraciones 0001–0036 + 61 usuarios, 300 productos, 200 órdenes con 200 ítems |
| Respaldo | `pg_dump -Fc` (sha256 `c286b97e…72da`) y `pg_restore --list` correctos |
| Restauración en base aparte | **Conteos idénticos en las 22 tablas** |
| Migraciones 0037–0044 sobre la copia restaurada | Aplicadas en **7,2 s**; 12 tablas nuevas (`expense_categories` queda con 9 filas sembradas por la 0042); tablas originales sin cambios (solo `_prisma_migrations` +8); **0 restricciones sin validar**; enum `Role` = cliente, admin, comercial, bodega; `orders.seller_id` nulo en las 200 órdenes |
| Backend NUEVO sobre el esquema migrado | Login, productos, listado admin, `GET /api/orders` y **creación de pedido (201)** correctos |
| Backend ANTERIOR (`7767d25`) sobre el esquema migrado, sin usuarios con roles nuevos | Mismas operaciones correctas, incluida la creación de pedido (201) |
| Backend ANTERIOR con filas `comercial`/`bodega` en la BD | `GET /api/admin/users` → **500**; login de esos usuarios → **500**; catálogo, productos admin, pedidos y login de admin/clientes siguen **200**. Es degradación parcial, sin pérdida de datos |
| `rollback-roles.sql` | Backend anterior vuelve a **200** en `admin/users`; los 2 usuarios entran como `cliente`; idempotente (segunda ejecución sin efecto) |
| `restore-roles.sql` | Los 2 usuarios recuperan su rol; el backend nuevo los autentica con `comercial` |

Limitaciones: datos sintéticos y pequeños (los tiempos de bloqueo reales dependen del volumen); no se probó Supabase (RLS, políticas); la fila fallida de la 0030 en `_prisma_migrations` es un artefacto de crear la base desde cero (en producción la 0030 ya está aplicada).

## 8. Estrategia de despliegue y rollback sin degradar usuarios a mano
Problema: la API anterior no conoce `comercial`/`bodega`; con esas filas en la BD falla el listado de usuarios y el login de esos usuarios.

**Recomendada (sin cambios de código, probada en §7):**
1. Migraciones aditivas → API nueva → web nueva (orden de §4).
2. **Periodo de observación (≥ 24–48 h) sin asignar roles nuevos.** Si hay que volver atrás en ese lapso, solo se revierte el código: no existe ningún usuario que degradar y no hace falta tocar datos.
3. Pasado el periodo, asignar `comercial`/`bodega` desde el panel.
4. Si después hace falta volver atrás: **un solo comando** `psql … -f docs/admin-finance/ops/rollback-roles.sql` (transaccional, idempotente, guarda el rol original en `role_rollback_snapshot` y deja a esos usuarios como `cliente`, mínimo privilegio), luego redeploy del código anterior. Para volver a avanzar: `restore-roles.sql`. El backend anterior lee el rol desde la BD en cada petición, así que surte efecto al instante.

**Opcional (endurecimiento, NO implementado):** desacoplar los roles nuevos del enum guardándolos en una columna aditiva (`staff_role`) y mantener `users.role` en `cliente`/`admin`. El código anterior vería a esos usuarios como clientes y nunca fallaría; el rollback sería sin intervención. Costo estimado: ~35 archivos (66 usos de `role` en 14 archivos de la API y 70 en 21 de la web) y repetir RBAC y E2E. Decisión del dueño.

## 9. Respaldo verificable (procedimiento)
1. Antes de migrar: respaldo gestionado de Supabase (backup/PITR con hora anotada) **más** `pg_dump -Fc` de la base.
2. Registrar `sha256sum` del volcado y `pg_restore --list | wc -l`.
3. Restaurar en una base aparte (`pg_restore -d <base_aparte> --no-owner`) y comparar conteos por tabla (consulta usada en §7); solo se da por válido el respaldo si coinciden.
4. Aplicar las migraciones primero a esa copia; revisar duración, `SELECT count(*) FROM pg_constraint WHERE NOT convalidated` (debe ser 0) y los conteos de tablas originales.
5. Con datos reales: solo con autorización, anonimizando (correos, teléfonos, direcciones, NIT) antes de salir de producción.

## 10. Disparadores de despliegue: qué se sabe y qué falta comprobar
Verificado localmente: no existen `.github/workflows`, `railway.json`, `Procfile`, `Dockerfile`, `vercel.json` ni `.vercel`; solo `packages/web/wrangler.jsonc` (nombre del Worker `dorella-app-web`, sin rama). El historial de implementaciones de GitHub (solo lectura) muestra el entorno `divine-encouragement / production` (Railway) con commits de `main`.

**No verificable desde el repo** (comprobar en los paneles con autorización, sin cambiar nada):
- Railway → servicio de la API → *Settings → Source*: repositorio y rama conectada; *Deploy → Wait for CI*; *PR Environments* (si crean entornos por PR); directorio raíz y comandos de build/start.
- Cloudflare → *Workers & Pages → dorella-app-web → Settings → Builds*: repositorio, **rama de producción**, "Build non-production branches" (despliegues de vista previa por rama), comando de build y variables.
- Vercel (rollback) → *Settings → Git*: *Production Branch*, *Preview Deployments*, *Ignored Build Step*.
- GitHub → *Settings → Webhooks* y *Integrations* del repositorio, y la protección de `main`.
- Antes de cualquier push: abrir una rama sin importancia **no** es una prueba segura; la comprobación debe hacerse en los paneles.

## 11. Vulnerabilidades restantes (19) y alcance real
`pnpm audit` tras actualizar dentro de cada versión mayor: 0 bajas, 12 moderadas, **5 altas, 2 críticas** (de 99 iniciales). Análisis de las 7 críticas/altas (dependencias directas verificadas con `pnpm why`):

| Paquete | Sev. | Qué es | ¿Llega al runtime productivo? | Decisión |
|---|---|---|---|---|
| `tinypool` (×2) | Crítica | Contaminación de prototipo → RCE en opciones del pool de hilos | **No**: solo es dependencia de `vitest` (devDependency de api y web) | No requiere acción en producción; se corrige al subir a vitest 4 (mayor) |
| `glob` 10.3.3 | Alta | Inyección de comandos en el CLI (`-c/--cmd`) | **No**: viene de `@opennextjs/cloudflare` (herramienta de build) y no se usa el CLI con entrada externa | Se resolverá al actualizar OpenNext |
| `postcss` 8.4.31 | Alta ×2 | Lectura de archivos vía `sourceMappingURL` de CSS controlado por un atacante | **No**: copia empaquetada dentro de Next (solo compilación de CSS propio, en build) | Sin parche posible dentro de Next 15.5.x |
| `deepmerge-ts` 7.1.5 | Alta | Agotamiento de pila al fusionar grafos recursivos | Indirecto vía Prisma 6; fusiona configuración propia, no entrada de usuario | La corrección exige Prisma 7 (mayor) |
| `zod` 3.25.76 | Alta | Consumo de memoria al validar colecciones muy grandes | **Sí** (validación del API) | Mitigada: `express.json({ limit: '1mb' })` acota el tamaño; los arreglos con tope (`max(200)`) rechazan antes. Migrar a zod 4 es un cambio mayor que afecta 11 archivos y los mensajes de error: decidir aparte |

Conclusión: ninguna crítica llega a producción; la única alta con entrada de usuario (`zod`) está acotada por el límite de cuerpo. Para cerrar del todo: zod 4, Prisma 7, vitest 4 y OpenNext reciente, cada uno con su ciclo de pruebas.
