# Photnoo: handoff (2026-10-13)

Read this first in a new Claude session. It replaces the conversation history.

## What exists
Photo-delivery SaaS for photographers in Egypt. The monorepo is `G:\Photography` (pnpm + Turborepo):
- `apps/api`: NestJS 11, Prisma 7, pg-boss worker locally; a Vercel Function with inline jobs when hosted.
- `apps/web`: Next.js 16, Tailwind 4, next-intl. English is the default, Arabic is RTL.
- `apps/admin`: Next.js admin console on :3001.
- `packages/db`: Prisma schema and migrations. `packages/shared`: zod schemas.

Built and committed, newest first:
- Vercel and Supabase hosting: `apps/api/api/index.js`, `JOBS_INLINE`, the daily cron tick.
- `aaabedf`: motion system and pricing rail.
  - React ViewTransition page transitions and Motion for React.
  - `components/motion/*`: Reveal, Stagger, DevelopImage, CountUp.
  - The pricing rail scrolls horizontally, and the mobile hero is fixed.
- `952ba7c`: the photographer app matches the Figma file (Figma file id `p4ls6kTNr4KrrxpcEmQTRX`).
  - New areas: Settings, Notifications, Clients, Store, Prints and orders, Portfolio, a public profile at `/p/<slug>`, a shop at `/p/<slug>/shop`, and Analytics.
- `fb3af00`: premium redesign.
  - Tokens, ui primitives, lucide icons, a new homepage, and photos generated with Higgsfield.
- Earlier: auth, galleries, uploads, sharing, the client gallery `/g/<token>`, billing with manual payments and invoices, the admin console, and the demo seed.

## Product truth
- **PRD v1** and the **Recommendation doc** are private documents; ask the previous owner for copies.
- The user later asked for full Figma parity, including Store, Prints, Portfolio and Analytics, which PRD v1 had deferred.
- `apps/web/PRODUCT.md` holds the design context. The design bar is Pixieset / Pic-Time, keeping the logo and the green brand.

## Run it locally (Windows, Git Bash)
```bash
export PATH="$HOME/.corepack-bin:$PATH"   # pnpm shim
node scripts/local-postgres.mjs            # embedded Postgres on :5432 (keep running)
cd apps/api && pnpm build && node --env-file=../../.env dist/main.js     # API :4000
cd apps/api && node --env-file=../../.env dist/worker.js                 # worker
cd apps/web && pnpm build && node node_modules/next/dist/bin/next start -p 3000
```
- Run exactly one API, the newest build.
- Redis is not installed. Health reports "degraded"; that is fine.
- Demo data: `pnpm --filter @photnoo/api seed:demo` (idempotent).
- Test logins go in `.local/dev-accounts.md` (git-ignored; each developer keeps their own).
- Checks from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @photnoo/api test` (108 tests).

## Hosting
Hosting is Vercel plus Supabase, with nothing running on a local machine. To set up your own copy, follow [DEPLOY.md](DEPLOY.md).
The Cloudflare tunnel flow (`scripts/preview-redeploy.mjs`) is retired; the script remains for local previews only.

## Conventions
- Per-area message files live in `apps/web/messages/{en,ar}/*.json`. After adding one, run `node scripts/sync-message-index.mjs` in `apps/web`.
- Every API query is scoped by `photographerId`. Errors return `{ code, message }`.

## Open items
- **Owner decisions:**
  - real prices (current ones are placeholders);
  - link duration chosen at share (current) or at create (as Figma shows);
  - testimonials, social URLs, the public phone number;
  - online payment (Paymob) versus pay-the-photographer-directly.
- **Not built:**
  - notification emails (the preference is stored, nothing is sent), and SMTP login for hosted email providers;
  - a captcha after 3 wrong gallery passwords (the API sets `captchaRequired`, the web ignores it);
  - Redis rate limiting;
  - an admin revenue dashboard (A-10);
  - DESIGN.md (impeccable documenter);
  - an Arabic visual pass on the new screens;
  - security review and load test.
