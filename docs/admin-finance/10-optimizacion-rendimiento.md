# 10 — Optimización de rendimiento (Productos, Dashboard, Inventario, Órdenes, Finanzas)

Fecha de medición: 2026-11-02. Entorno **local** (Postgres 16 en Docker, `next start` en producción, API compilada). No es producción:
no hay latencia Cloudflare → Railway → Supabase. Las cifras sirven para comparar, no como promesa de SLA.

## 1. Datos de prueba
~10.052 productos y ~2.021 órdenes sintéticas (script `perf-seed.sql`, solo en la BD local de pruebas `dorella-pg-test`, puerto 55432).

## 2. Cambios (sin confirmar antes de este commit)
- Dashboard dividido en secciones (`?sections=core|charts|inventory`) más tres endpoints paginados (`tier-upgrades`, `slow-movers`, `restock-alerts`); la UI pinta lo principal sin esperar a lo pesado.
- Productos: filtros y paginación en servidor (`products-filters.integration.test.ts`), página admin reescrita.
- Inventario: consulta de resumen reducida (`inventory.service.ts`).
- `useApi`: ajuste menor de la petición.

## 3. Medición de API (curl, caché caliente)
| Endpoint | Tiempo |
|---|---|
| Dashboard completo | 185 ms |
| Dashboard `core` | 29 ms |
| Dashboard `charts` | 44 ms |
| Dashboard `inventory` | 161 ms |
| Resumen financiero (75 muestras seguidas) | media 0,12 s · máx 0,25 s |

Estas son mejoras de **API**; no se presentan como mejoras de interfaz.

## 4. Medición de navegador (Chrome real por CDP)
Cronometrado **dentro de la página** (MutationObserver + `performance.now`), visita fría tras iniciar sesión.
"Útil" = primer dato real visible; "completa" = sin esqueletos/spinners.

| Pantalla | Escritorio útil / completa | Móvil (390×844, CPU 4× más lenta) útil / completa |
|---|---|---|
| Productos | 338 / 383 ms | 1993 / 2402 ms |
| Dashboard | 231 / 460 ms | 1845 / 3169 ms |
| Órdenes | 237 / 252 ms | 1561 / 1695 ms |
| Resumen financiero | 2288 / 2288 ms (*) | 3231 / 3232 ms (*) |
| Inventario valorizado | 139 / 473 ms | 1371 / 2397 ms |

(*) Primer acceso tras inactividad: la API tardó ~2 s (conexiones y caché de Postgres en frío). Repetido 75 veces seguidas: máx 0,25 s; con rangos distintos, 0,13–0,25 s tras el primer acceso. No se reprodujo con el servidor caliente, por lo que no se atribuye a una consulta concreta.
La cronología del Dashboard muestra la red completa en ~490 ms (`/api/auth/me` a 161 ms, las 6 llamadas del panel en paralelo entre 204 y 484 ms); el contenido útil aparece antes de que lleguen `charts` e `inventory`.

## 5. Corrección del método de medición (importante)
La primera medición (`ui-perf.mjs`) daba Dashboard "útil 2558 ms / completa 3275 ms". **Era un artefacto**: el sondeo por CDP (`Runtime.evaluate` cada 100 ms) retrasaba la lectura. Medido dentro de la página: 372 / 802 ms (primera pasada) y 231 / 460 ms (siguiente). Las cifras de §4 usan el método corregido.
La causa del fallo en la línea 21 de `ui-perf.mjs` era distinta: `screens-dashboard.json` tenía escapes inválidos para JSON (`\$\s` en lugar de `\\$\\s`), así que `JSON.parse` lanzaba `SyntaxError`.

## 6. Comparación antes/después en condiciones equivalentes (escritorio)
Antes = `4d0a0b6` (worktree aparte), después = rama actual. Dos pares API+web de producción (`node dist` + `next start`), misma BD local con ~10.052 productos y 2.021 órdenes, mismo Chrome y mismo método (cronometraje dentro de la página). 3 ejecuciones por entorno, alternadas; se reporta la mediana. Cada pantalla se mide en un navegador limpio.

| Pantalla | Antes útil / completa | Después útil / completa | Peticiones API antes → después | Datos API antes → después |
|---|---|---|---|---|
| Productos | 12.156 / 12.170 ms | 276 / 301 ms | 105 → 5 | 4.922 KB → 32 KB |
| Dashboard | 689 / 690 ms | 240 / 388 ms | 5 → 7 | 19 KB → 21 KB |

- **Productos** mejora ~40×: antes pedía el catálogo completo en 105 peticiones; ahora filtra y pagina en la base.
- **Dashboard**: la API es equivalente (`/api/admin/dashboard` ~0,19 s antes, ~0,21 s después, mismo payload de 11 KB). La mejora de ~2,9× en tiempo "útil" y ~1,8× en "completa" viene de pintar por secciones. "Útil" es el primer dato visible; en el antes aparece junto con la carga completa.
- Una primera tanda de Productos+Dashboard en el mismo navegador dio `NA` para el Dashboard "antes" porque el Productos viejo (105 peticiones) contaminaba la siguiente pantalla; por eso se repitió aislado.
- Órdenes, Resumen financiero e Inventario no cambiaron de forma relevante (≈0,1–0,5 s en ambos).

## 7. Limitaciones / pendientes
- Móvil emulado: solo se midió el estado actual, no el A/B.
- Navegación posterior (cliente ya hidratado) y consultas SQL con `EXPLAIN ANALYZE` no medidas aún.
- Móvil emulado por CPU throttling, no un dispositivo real.
- `ui-perf.mjs` no cierra el Chrome headless (puerto 9333): una segunda medición seguida se cuelga. Cerrar el Chrome de `dorella-e2e` entre ejecuciones.

## 8. Cierre de la fase de rendimiento (2026-11-03)

### 8.1 Navegación posterior (clic en el menú, sin recargar; cronometrado dentro de la página)
| Destino | Escritorio | Móvil (390×844, CPU 4× más lenta) |
|---|---|---|
| Productos (1.ª vez / 2.ª vez) | 141 / 87 ms | 1318 / 451 ms |
| Órdenes | 107 ms | 259 ms |
| Dashboard (1.ª / 2.ª vez) | 202 / 137 ms | 300 / 323 ms |

El primer acceso a Productos en móvil incluye descargar el fragmento de código de la ruta. Una primera versión de esta medición era inválida (el selector ya existía en la pantalla anterior); se corrigió exigiendo que la URL sea la de destino.

### 8.2 Consultas PostgreSQL (`EXPLAIN (ANALYZE, BUFFERS)`)
Conjunto de rendimiento (~10 mil productos, ~2 mil órdenes): todas las consultas del Dashboard cuestan 1–30 ms; el aggregate de inventario `core` hace 3 recorridos de `products` (~134 ms en frío, 29 ms en caliente por API). Las búsquedas de productos usan los índices trigrama (`products_nombre_trgm_idx`, `products_sku_trgm_idx`).

Hallazgo a escala (300 mil órdenes sintéticas, copia de staging aislada): el índice `orders(status, created_at)` **no se usaba** porque las consultas hacían `status::text IN (...)`. Con el estado comparado como enum (`status = ANY(ARRAY[...]::"OrderStatus"[])`) y la serie diaria agregada una sola vez:

| Consulta (300 mil órdenes) | Antes | Después | Resultado |
|---|---|---|---|
| Resumen de ingresos, 30 días | ~70 ms (Parallel Seq Scan) | ~4,5 ms (Bitmap Index Scan) | ≈15× |
| Serie diaria, 30 días | 258–286 ms | 10–14 ms | ≈25×, 0 diferencias de resultado en SQL |

Aplicado en `dashboard.service.ts` (commit `542ba7c`). Verificación de equivalencia por API contra el código anterior con los datos de rendimiento: JSON idéntico en 7/30/90 días, salvo el orden de filas empatadas en `topCustomers` y `slowMovers` (datos sintéticos con empates masivos); se añadió un desempate determinista (`u.id`, `p.id`). Dashboard completo con 300 mil órdenes: ~80–130 ms; `core` 24–83 ms; `inventory` ~20 ms. **No se midió el Dashboard anterior de extremo a extremo a esa escala** (solo a nivel SQL).

### 8.3 Caché e invalidación
Ninguna de las optimizaciones depende de caché: el API no tiene caché en memoria para Dashboard ni Productos, y las pantallas del panel piden datos frescos en cada visita. Las páginas públicas (`/`, `/catalogo`, `/producto/[id]`) mantienen `revalidate = 60` sin cambios. Por tanto no se introduce ningún riesgo de invalidación; el costo es que cada visita al panel consulta la base.

### 8.4 Pendiente de rendimiento
- A/B en móvil (solo se midió el estado actual).
- Volumen real: repetir `EXPLAIN ANALYZE` en staging con una copia de datos reales (el planificador depende de las estadísticas).
- El aggregate de inventario `core` podría reducirse a un solo recorrido con `FILTER`; no se hizo por su bajo beneficio (29 ms en caliente).
