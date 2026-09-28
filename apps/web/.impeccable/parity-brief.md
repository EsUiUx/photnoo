# Figma parity build — shared brief for all builders

Photnoo: photo-delivery SaaS for photographers in Egypt. Monorepo at `G:\Photography` (pnpm + Turborepo).
- `apps/api`: NestJS 11, Prisma 7 (`packages/db`), pg-boss jobs. Local API on :4000, Postgres on :5432 (both running).
- `apps/web`: Next.js 16 (read `apps/web/AGENTS.md` — this Next has breaking changes; check `node_modules/next/dist/docs/` before using unfamiliar APIs), Tailwind 4, next-intl (English default, Arabic RTL secondary). Web dev server on :3000.
- Product spec: PRD v1 (requirement IDs P-xx photographer, C-xx client). The owner has now asked for full Figma parity, including Store, Prints, Portfolio and Analytics that the PRD had deferred.

## Environment
- Bash: `export PATH="$HOME/.corepack-bin:$PATH"` before pnpm.
- Checks: `pnpm --filter @photnoo/api exec tsc --noEmit -p tsconfig.json`, `pnpm --filter @photnoo/web exec tsc --noEmit`, `pnpm --filter @photnoo/web lint`, API tests `pnpm --filter @photnoo/api test` (look at existing `*.spec.ts`/test setup first and follow it).
- Other builders are editing other areas of the same working tree at the same time. Typecheck errors in files you do not own are theirs: ignore them, fix yours. Never revert or reformat files you do not own. Never run git commands that change state (no commit, checkout, reset, stash). Do not restart the API/DB/web servers; if you need the API rebuilt to try endpoints, run `pnpm --filter @photnoo/api build` only (the running API won't pick it up; rely on tests instead).
- The Prisma schema is already migrated with every model you need (see `packages/db/prisma/schema.prisma`, bottom section "Figma parity"): Photographer profile/settings fields, Client, Notification, Product, PrintItem, Order, OrderItem, PortfolioItem, PhotographerCounter, Gallery.clientId/printsEnabled. Do NOT change the schema. If you truly need a column, stop and report it instead.

## Shared services already built (use them, don't duplicate)
- `apps/api/src/media/image-upload.service.ts` — `ImageUploadService.store(photographerId, kind, file)` re-encodes a JPEG/PNG upload (≤15 MB, multer memory `FileInterceptor`, see `billing.controller.ts` proof upload for the pattern) into `imageKey` + `previewKey` + blur; `.url(key)` signs a view URL; `.remove(imageKey)`. Import `MediaModule`.
- `apps/api/src/notifications/notifications.service.ts` — global `NotificationsService.notify(photographerId, { type, data, galleryId?, orderId?, dedupeKey? })`, fire-and-forget, respects the photographer's preferences.
- `apps/api/src/clients/clients.service.ts` — global `ClientsService.upsertByPhone(photographerId, { name, phone, email }, tx?)` returns clientId.
- Empty module stubs already registered in `app.module.ts`: `profile/`, `store/`, `prints/`, `portfolio/`, `analytics/` (fill in your module file; don't edit app.module.ts).
- API conventions: `@UseGuards(AuthGuard)` + `@CurrentAuth() auth: AccessClaims` (`auth.photographerId`), `ZodValidationPipe` with zod schemas (shared request schemas live in `packages/shared/src`; add your own file there and one export line to its index), `this.prisma.client.<model>`. EVERY query scoped by photographerId (tenant isolation, PRD section 10). Money is `Decimal(12,2)` EGP; serialize as numbers (see `egp()` in billing.service.ts). Errors as `{ code, message }` like existing services.
- Web conventions: API client `src/lib/api.ts`; TanStack Query (see `src/lib/queries.ts` for patterns, but put YOUR hooks in a new `src/lib/queries-<area>.ts` and your types in `src/lib/types-<area>.ts`). App routes live under `src/app/[locale]/(app)/<route>/page.tsx` (see `billing/page.tsx` for the metadata pattern). Messages: add `messages/en/app-<area>.json` and `messages/ar/app-<area>.json` (namespace `App.<area>`), then run `node scripts/sync-message-index.mjs` from apps/web. Arabic must be real, natural Arabic.

## Design rules (binding)
Read `apps/web/.impeccable/build-guide.md` and follow it. Summary: semantic tokens only (bg-canvas, bg-surface, bg-surface-subtle, text-fg / fg-secondary / fg-muted, border-border, brand, brand-soft, success/warning/danger/info + -soft); ui primitives in `src/components/ui/*` (Button/ButtonLink/IconButton, TextField/PasswordField/TextareaField/SelectField/CheckboxField, Dialog + useConfirm, Menu, Badge, Card, Meter, Segmented, CopyButton, DetailList, Spinner/Skeleton/EmptyState/ErrorState/Alert); lucide-react icons strokeWidth 1.75, size 16–20; Tailwind default type scale; radii md/lg/xl; logical properties (ms/me/ps/pe/start/end) for RTL; 44px touch targets on coarse pointers; tables become cards on mobile; every page has loading, empty and error states; labels always visible; confirmations for destructive actions; keyboard and screen-reader accessible. Match the look of the existing redesigned screens (`components/app/dashboard-view.tsx`, `components/billing/*`, `components/gallery/*`).

## Figma
The Figma file is open in the Figma desktop app. Use `mcp__figma-desktop__get_screenshot` (load via ToolSearch "select:mcp__figma-desktop__get_screenshot,mcp__figma-desktop__get_metadata") on the node ids named in your brief to see the features and layout. Figma sets WHAT is on each screen (features, fields, data, actions, sections); our design system sets HOW it looks (do not copy Figma's colors, fonts, or icon art). Where Figma shows placeholder data (SAR currency, fake deltas), use real data and EGP.

## Demo data
Add a seeding function for your area in a new file `apps/api/src/cli/seed-demo-<area>.ts` exporting `async function seedDemo<Area>(prisma, photographerId)` that creates realistic Egyptian demo data (idempotent: skip if already seeded). Do not edit `seed-demo.ts`; report the export name and the orchestrator wires it in.

## Report back (under 600 words)
Files created/changed, endpoints added, routes added, what was tested and how, anything left undone or any decision the owner must make.
