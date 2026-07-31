# D'orella web: Cloudflare Workers deployment

This document covers only `packages/web`. The Express API remains on Railway,
and PostgreSQL plus product images remain on Supabase.

## Target architecture

```text
Browser
  -> https://www.dorela.co (Cloudflare Worker / OpenNext)
       -> https://api.dorela.co (Railway / Express)
            -> Supabase PostgreSQL and Storage
```

The web application must never import Prisma, read `DATABASE_URL`, or connect to
PostgreSQL. Server Components use `serverFetch()` and Route Handlers use
`fetch()` to call the Railway API. Run this guard before every deployment:

```bash
pnpm --filter web verify:architecture
```

The Supabase browser client in `src/lib/supabase.ts` uses only the public anon
key for Supabase Auth. It is not a PostgreSQL pool and must never receive the
service-role key.

## Why Workers and not Pages

This is an SSR Next.js 15 application with App Router, Middleware, Server
Components, and Route Handlers. It uses `@opennextjs/cloudflare` and deploys as
a Cloudflare Worker. Do not use the deprecated `@cloudflare/next-on-pages`.

`wrangler.jsonc` uses `nodejs_compat` with compatibility date `2026-07-31`.
This is later than the required `2024-09-23` baseline for the current Node.js
compatibility APIs.

## Variables

Configure the following in the Cloudflare build environment:

| Variable | Example | Availability |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.dorela.co` | Build and runtime |
| `API_INTERNAL_URL` | `https://api.dorela.co` | Runtime |
| `NEXT_PUBLIC_SITE_URL` | `https://www.dorela.co` | Build and runtime |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://PROJECT.supabase.co` | Build and runtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Build and runtime |

Cloudflare Build variables exist only during compilation. After the first
Worker version is created, add the same non-secret values under
**Settings > Variables & Secrets** so Server Components and Route Handlers also
receive them at runtime. `keep_vars` is enabled in `wrangler.jsonc` so later
Wrangler deployments preserve values managed from the dashboard.

Add this runtime secret with Wrangler or the Cloudflare dashboard:

```bash
pnpm --filter web exec wrangler secret put JWT_SECRET
```

`JWT_SECRET` must be identical to the Railway API value. Never expose it as
`NEXT_PUBLIC_JWT_SECRET` and never commit it.

Cloudflare cannot use Railway private networking. `API_INTERNAL_URL` must
therefore use the public HTTPS Railway/custom-domain URL. This is expected and
does not open database access from the frontend.

For local Worker preview, copy `.dev.vars.example` to `.dev.vars` and replace
the placeholders. `.dev.vars` is gitignored.

## Build and validation

Use Node.js 22 and pnpm 9:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter web verify:architecture
pnpm --filter web build
pnpm --filter web build:cloudflare
```

OpenNext has known symlink limitations on native Windows. Run its production
build in Linux, WSL, CI, or Cloudflare Builds. Regular `next build` remains
supported on Windows.

Local production preview:

```bash
pnpm --filter web preview:cloudflare
```

Nothing in this repository deploys automatically. Deployment requires an
explicit command:

```bash
pnpm --filter web deploy:cloudflare
```

## Cloudflare Git build

- Repository root: `/`
- Node version: `22`
- Install command: `corepack enable && pnpm install --frozen-lockfile`
- Build command: `pnpm --filter web verify:architecture && pnpm --filter web build:cloudflare`
- Worker configuration: `packages/web/wrangler.jsonc`

Do not point the project root at `packages/web` before installation: pnpm needs
the workspace root and lockfile.

Static assets are served from `.open-next/assets`. Product images continue to
load directly from Supabase Storage; Cloudflare Images and R2 are not required.
R2 incremental caching is intentionally disabled because the application
currently has no ISR/revalidation configuration.

## Railway changes

Keep the Express service and Prisma configuration unchanged. Configure:

```text
NODE_ENV=production
CORS_ORIGIN=https://www.dorela.co
JWT_SECRET=<same secret configured in Cloudflare>
```

`NEXT_PUBLIC_API_URL` and `API_INTERNAL_URL` in Cloudflare should both point to
Railway's public HTTPS API or `https://api.dorela.co`.

Server-to-server fetches are not controlled by browser CORS. CORS is still kept
restricted for any browser request that reaches Railway directly. Do not use
`*` with credentials. If Cloudflare preview domains need direct browser API
access, implement an explicit preview-origin allowlist in Express rather than a
wildcard.

Recommended domains:

```text
www.dorela.co -> Cloudflare Worker
api.dorela.co -> Railway
dorela.co     -> redirect to https://www.dorela.co
```

Cookies are written by same-origin Next.js Route Handlers on
`www.dorela.co`. They remain `HttpOnly`, `Secure` in production, and do not
need to be shared with `api.dorela.co`; the proxy forwards tokens to Railway.

## Release checklist

1. Confirm Railway `/api/health` is healthy.
2. Run architecture guard, TypeScript, Next build, API tests, and OpenNext build.
3. Check Wrangler's compressed Worker size: Free permits 3 MiB; Paid permits
   10 MiB. Upgrade rather than removing security or application behavior to
   force the bundle under a limit.
4. Deploy to a Cloudflare preview URL.
5. Test home, catalog pagination, product details, Supabase images, login,
   refresh, logout, admin redirects, product visibility, cart, and checkout.
6. Validate CSP, secure cookies, and Railway logs.
7. Attach the production custom domain only after the preview passes.

## Fast rollback to Vercel + Railway

Railway and Supabase are never migrated, so rollback affects only DNS/frontend:

1. Keep the last working Vercel project and production deployment intact until
   Cloudflare has been stable for at least one full business cycle.
2. Record the Vercel production deployment URL before changing DNS.
3. Use a short DNS TTL (for example 300 seconds) before cutover.
4. If Workers fails, detach or disable the `www.dorela.co` Worker route and
   restore the previous Vercel CNAME/record.
5. Restore Vercel environment variables with
   `NEXT_PUBLIC_API_URL=https://api.dorela.co` and
   `API_INTERNAL_URL=https://api.dorela.co`.
6. Leave Railway, Supabase, migrations, storage, and MercadoPago webhook
   unchanged.
7. Purge Cloudflare cache and verify home, login, catalog, and checkout on the
   restored Vercel deployment.

Do not delete the Vercel project during the first Cloudflare release. Git
rollback is also available by deploying `main`; this Cloudflare work lives on
the `cloudflare-opennext-web` branch.
