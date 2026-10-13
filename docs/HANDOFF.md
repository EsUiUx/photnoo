# Photnoo: handoff (2026-10-13)

Read this first in a new Claude session. It replaces the conversation history.

## What exists
Photo-delivery SaaS for photographers in Egypt. The monorepo is `G:\Photography` (pnpm + Turborepo):
- `apps/api`: NestJS 11, Prisma 7, pg-boss worker.
- `apps/web`: Next.js 16, Tailwind 4, next-intl. English is the default, Arabic is RTL.
- `apps/admin`: Next.js admin console on :3001.
- `packages/db`: Prisma schema and migrations. `packages/shared`: zod schemas.

Built and committed, newest first:
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
- **PRD v1** (Claude Docs artifact): https://claude.ai/code/artifact/f418ec22-a43d-4181-8713-e64c06f5ba31
- **Recommendation doc:** https://claude.ai/code/artifact/5ff23037-8f59-444e-b679-f82ffce94df5
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
- Test logins are in `.local/dev-accounts.md` (git-ignored). Never paste them in chat.
- Checks from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @photnoo/api test` (108 tests).

## Preview link for the owner (Cloudflare quick tunnel)
- `cloudflared` is installed (`C:\Program Files (x86)\cloudflared\cloudflared.exe`).
- Start it: `cloudflared tunnel --no-autoupdate --url http://localhost:3000`, then read the `https://*.trycloudflare.com` URL from its output. The URL changes on every restart; tell the user the new one.
- The API and worker must run with `WEB_ORIGIN` and `PUBLIC_API_URL` set to the tunnel URL. Otherwise share links say localhost and images break.
- **Standing rule:** redeploy every change to the tunnel with `node scripts/preview-redeploy.mjs --origin <tunnel url> [--api]`. It builds into `.next-staging` and swaps it in. Never rebuild `.next` in place while it is being served.

## Conventions
- Commit as `git -c user.name="Designer" -c user.email="Designer@yez.travel"`, ending the message with the Co-Authored-By line.
- Per-area message files live in `apps/web/messages/{en,ar}/*.json`. After adding one, run `node scripts/sync-message-index.mjs` in `apps/web`.
- Every API query is scoped by `photographerId`. Errors return `{ code, message }`.

## Open items
- **Owner decisions:**
  - real prices (current ones are placeholders);
  - link duration chosen at share (current) or at create (as Figma shows);
  - testimonials, social URLs, the public phone number;
  - online payment (Paymob) versus pay-the-photographer-directly.
- **Not built:**
  - notification emails (the preference is stored, nothing is sent);
  - a captcha after 3 wrong gallery passwords (the API sets `captchaRequired`, the web ignores it);
  - Redis rate limiting;
  - an admin revenue dashboard (A-10);
  - DESIGN.md (impeccable documenter);
  - an Arabic visual pass on the new screens;
  - security review and load test.
- **Connectors to re-authorise on the new account:** Figma, Higgsfield (image generation), and any others that were used.
