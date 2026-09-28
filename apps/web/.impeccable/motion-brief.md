# Motion rollout: shared brief

Photnoo web app at `G:\Photography\apps\web` (Next.js 16, React 19.2, Tailwind 4, next-intl en + ar RTL). Read `AGENTS.md` there.

## Motion thesis (binding)
Photos **develop**: a soft blur and desaturation resolve into focus. The interface moves only to explain what changed.
- One authored moment per surface. The homepage hero already has it (`components/home/hero.tsx`), so don't touch the hero.
- Everything else is quiet: reveals the first time something is seen, capped staggers for things that really are lists, and developing photos.
- Operate surfaces (the photographer app) stay fast. Nothing waits on choreography: 150–300 ms, stagger ≤ 8 items × 45 ms.
- Not every section gets the identical entrance. Vary by meaning:
  - headings and copy: `rise`;
  - photos: `develop`;
  - large feature images or mockups: `clip`;
  - lists and grids: `Stagger`.
- Skip anything that doesn't earn motion.

## Toolkit (already built; use it, don't reinvent it)
- `@/components/motion/reveal`:
  - `<Reveal variant="rise|develop|clip" delay? as?>`: a one-time reveal on scroll into view.
  - `<Stagger as="ul|div|ol">` with children spreading `{...staggerItem(i)}`, so the list arrives in sequence.
  - Content stays visible without JS, and there's a failsafe.
- `@/components/motion/develop`:
  - `<DevelopImage>`: a drop-in `next/image`.
  - `<DevelopImg>`: a drop-in plain `<img>` for signed storage URLs.
  - `useDevelop()` returns `{ attach, settle, state }` for custom markup; put `data-develop={state}` on the img.
  - Use these for photos that load over the network: gallery thumbnails, covers, portfolio, products, client grid, viewer.
- `@/components/motion/count-up`: `<CountUp value format>`, for KPI numbers that count up once when seen (stat cards only).
- Motion for React (`motion/react`) is installed and loaded through `LazyMotion` with `domAnimation` and strict mode in the root layout. So:
  - Use the `m.*` components (e.g. `import * as m from 'motion/react-m'`), never `motion.*`.
  - `AnimatePresence` is fine, e.g. for list items being removed (notifications marked read or deleted, files deleted, upload rows finishing) and for small inline swaps.
  - `layout` animations need `domMax`, which isn't loaded, so don't use `layout` or `layoutId`.
- Page transitions already run through React `<ViewTransition>` in `app/[locale]/(app|auth|p/[slug])/template.tsx`; CSS lives in `globals.css`.
  - You may add shared-element morphs with `<ViewTransition name=... share="photo-morph" default="none">` (import `{ ViewTransition } from 'react'`), but only where both ends render in the same commit.
- Dialogs, drawers and segmented controls are already animated (CSS in `globals.css`, `data-motion` on the dialog).
- Tokens (`globals.css`): `--ease-out-expo`, `--duration-fast|base|slow|develop`.
- Reduced motion is handled centrally for everything in the toolkit. Anything custom you add must add `motion-reduce:` fallbacks, keeping opacity and dropping movement.

## Rules
- Don't change layout, copy, data or behaviour, only motion. Keep `next/image` props (`sizes`, `priority`, `placeholder`) when swapping in `DevelopImage`.
- Keep hover and press feedback subtle. Buttons already have states; don't add scale-on-hover everywhere. Card hover lift is allowed only on clickable cards (gallery cards, product cards), at most 2px, with a shadow change.
- No layout-property animation (width, height, top, left). Use transform, opacity, filter or clip-path.
- Only own the files listed in your brief. Another builder works in parallel on other files; ignore their typecheck errors. No git commands that change state. Don't start or stop servers.
- When done, run `export PATH="$HOME/.corepack-bin:$PATH"; pnpm exec tsc --noEmit` and `pnpm exec eslint <your files>` from `apps/web`. Report back in under 300 words: the files touched and what moves where.
