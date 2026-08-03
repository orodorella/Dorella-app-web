# AGENTS.md

B2B/B2C wholesale jewelry e-commerce (Colombia). Monorepo managed by **pnpm 9** (lockfile v9.0).

## Setup

```bash
corepack enable            # enables corepack (ships with Node 16.9+)
pnpm install               # corepack auto-downloads the pinned pnpm version
cp .env.example .env       # then fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
pnpm --filter api prisma:migrate
pnpm --filter api prisma:seed
```

Node version: **22** (see `.node-version`). Use `fnm use` or `nvm use` to switch.

The `packageManager` field in `package.json` pins pnpm for corepack. Developers not using corepack are unaffected.

## Commands

```
pnpm dev                      # Runs API (:3001) + Next.js (:3000) concurrently
pnpm --filter api dev          # API only
pnpm --filter web dev          # Next.js only
pnpm --filter web build        # Next.js production build
pnpm --filter api test         # Vitest (unit tests only, no DB required)
pnpm --filter api prisma:migrate
pnpm --filter api prisma:seed  # Seeds admin@dorella.co + categories. Requires SEED_ADMIN_PASSWORD and SEED_CLIENT_PASSWORD env vars.
pnpm --filter api prisma:generate
```

No lint or typecheck scripts are configured. No CI workflows exist.

## Cloudflare Deploy (Workers)

Configured in the Cloudflare dashboard (no CI workflows in the repo). Root directory is `/`, so **every** dashboard command field runs from the repo root — each one that invokes wrangler **must** `cd packages/web` first, or it must include `--config packages/web/wrangler.jsonc`. Wrangler refuses to run in a workspace root without a target app.

| Field | Value |
|-------|-------|
| Build command | `pnpm --filter web verify:architecture && pnpm --filter web build:cloudflare` |
| Deploy command | `cd packages/web && pnpm exec wrangler deploy` |
| Version command | `cd packages/web && npx wrangler deploy` |

- `wrangler.jsonc` lives at `packages/web/wrangler.jsonc`; its `main` (`.open-next/worker.js`) is relative to that file, so wrangler must run from `packages/web`.
- `verify:architecture` (`packages/web/scripts/verify-worker-architecture.mjs`) is idempotent and only reads `src/`; it must stay in the build command so failures surface before the deploy step. Do not chain it (or a rebuild) into the deploy command — the build already ran there.
- Known failure mode: any of these three fields left as a bare `wrangler`/`npx wrangler` command (no `cd packages/web`) fails with `ERROR: The Cloudflare application detection logic has been run in the root of a workspace instead of targeting a specific project.` This has hit both the Deploy command and the Version command independently — check **all** command fields in the dashboard when this error appears, not just the one that last failed.
- Worker name is `dorella-app-web` (`wrangler.jsonc` `name` + the `WORKER_SELF_REFERENCE` service binding) — must match the project name in the Cloudflare dashboard exactly.

## Architecture

| Package | Tech | Role |
|---------|------|------|
| `packages/api` | Express 5 + Prisma + TS strict | All business logic, pricing, auth, DB |
| `packages/web` | Next.js 15 App Router + Tailwind 4 | SSR/SSG frontend, consumes API |
| `packages/shared` | TS types + constants | Consumed by api via `workspace:*` |
| `packages/frontend` | Vite 8 + React 19 + JSX | **Legacy.** Pre-migracion. Do not modify. |

Next.js calls Express as an external API. Server Components use `API_INTERNAL_URL`; Client Components use `NEXT_PUBLIC_API_URL`. CORS origin defaults to `http://localhost:5173` (legacy Vite port).

## Env Loading

- **API:** `dotenv-cli` reads from root `.env` (script: `dotenv -e ../../.env`). Validated with Zod at startup — missing vars crash the process.
- **Web (client):** `NEXT_PUBLIC_API_URL` and `API_INTERNAL_URL` from `.env`.
- **Shared:** No env vars.

Required API vars: `DATABASE_URL`, `JWT_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` (min 32 chars).

## Security Rule #1

**`precioBase` is NEVER exposed in public or client API responses.** Only `GET /api/admin/products` returns it. The `pricing.service.ts` `formatProductForTier()` strips it. Tests in `packages/api/src/tests/products.test.ts` assert this — they must never be weakened.

Prices are calculated server-side in `pricing.service.ts`. The frontend never computes discounts.

## Tier Naming Mismatch

The API and shared types use `por_mayor` / `gran_mayor`. The Next.js frontend maps these to `mayorista` / `granmayorista` via `TIER_MAP` in `src/lib/api-client.ts:21`. If you add or change tiers, update both sides.

## Import Conventions

- **API:** Uses relative paths (`../services/pricing.service.js`), not the `@/*` alias defined in tsconfig. Extensions are `.js` (ESM resolution).
- **Web:** Uses `@/*` path alias (maps to `./src/`).
- **Shared:** Direct TS entry point (`"main": "src/index.ts"`), no build step.

## Known Gotchas

- **`app.listen()` at module level** (`packages/api/src/index.ts:48`): Importing the app starts the server. This blocks testability — tests will bind to the port.
- **`packages/web` has no `public/` directory**: Fonts load from Google Fonts CDN, not self-hosted. No static images exist.
- **Cart has no persistence**: `CartProvider` uses React state only. Cart is lost on page refresh. No localStorage.
- **`getServerSession()` is unused**: Exists in `src/lib/auth.ts` but no page imports it. All protected pages use client-side auth.
- **No `next/image` usage**: All product images use raw `<img>` tags, losing optimization.
- **No ISR `revalidate` configured**: Pages fetch from API but don't set `next: { revalidate: N }` on fetch calls.
- **No structured data (JSON-LD)**: Product pages lack Google Shopping schema.
- **Admin middleware is weak**: `middleware.ts` only checks for cookie existence, not the user's role. Role check happens later in `admin/layout.tsx`.
- **Double fetch on product page**: `generateMetadata()` and the page component each independently fetch the same product.

## Testing

- Framework: **Vitest** (unit only). No integration or E2E tests.
- Run all: `pnpm --filter api test`
- Coverage: `pricing.service.test.ts`, `products.test.ts`, `order.service.test.ts`
- No supertest usage despite it being a devDependency. No DB-backed tests.
- Security-critical test: verifies `precioBase` never appears in product responses.

## Full Blueprint

For architecture decisions, data model, API routes, deploy strategy, and non-negotiable rules, read `CLAUDE.md` (2,800+ lines). It is the authoritative design document.
