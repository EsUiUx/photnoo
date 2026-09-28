# Photnoo

Premium, time-limited photo delivery for professional photographers. The photographer uploads a
gallery, the client gets a private link and password, every download leaves a receipt, and files
delete themselves when the link closes.

Product scope and rules live in **Photnoo PRD v1**; architecture and roadmap in the
**Project Recommendation** doc. Delivery rules shared by every app are in
[`packages/shared/src/rules.ts`](packages/shared/src/rules.ts).

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/api` | NestJS modular monolith (REST API under `/v1`, `/health` for probes) |
| `apps/web` | Next.js app: marketing site, photographer app, client gallery (Arabic + English, RTL) |
| `packages/db` | Prisma schema, migrations and client factory |
| `packages/shared` | Delivery rules, zod schemas and types shared by API and web |

## Prerequisites

- Node.js 22 (`.nvmrc`)
- pnpm 9 via Corepack: `corepack pnpm@9.15.4 <command>` (or `corepack enable` once, then `pnpm`)
- Docker Desktop, for local Postgres, Redis, MinIO (stand-in for Cloudflare R2) and Mailpit

## First run

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm --filter @photnoo/db migrate:deploy
pnpm build
pnpm dev
```

- Web: http://localhost:3000 (redirects to `/ar` or `/en`)
- API health: http://localhost:4000/health
- Mailpit (outgoing email): http://localhost:8025
- MinIO console: http://localhost:9001 (`photnoo` / `photnoo-secret`)

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs every app in watch mode |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` | What CI runs |
| `pnpm db:migrate` | Creates a new migration after editing `schema.prisma` |
| `pnpm db:generate` | Regenerates the Prisma client |

## Rules for contributors

- No secrets in the repo. `.env.example` holds dummy values only; real ones live in AWS Secrets Manager.
- Every tenant-owned query filters by `photographerId`.
- Migrations are expand-then-contract: never drop or rename a column in the same release that stops using it.
- User-facing text goes in `apps/web/messages/{ar,en}.json`; use logical CSS utilities (`ms-*`, `pe-*`) so layouts mirror in Arabic.
