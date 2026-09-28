# Photnoo web redesign: build guide (2026-09-28)

Approved direction: **the category standard at full craft**, benchmarked against **Pixieset and Pic-Time**. Photo-first, clean, calm, premium. White ground, the Figma green as the brand, one precise grotesk. The approved homepage comp is `.impeccable/mocks/home-b-image-led.png` (full-bleed photo hero, floating activity card). Product brief: `PRODUCT.md`. English is the default locale; Arabic is second with full RTL.

## Hard rules

- Use the **semantic tokens** in `src/app/globals.css`:
  - surfaces: `bg-canvas`, `bg-surface`, `bg-surface-subtle`, `bg-surface-sunken`;
  - lines: `border-border`, `border-border-strong`;
  - text: `text-fg`, `text-fg-secondary`, `text-fg-muted`;
  - brand: `bg-brand`, `hover:bg-brand-hover`, `bg-brand-soft`, `text-brand`, `bg-brand-soft-strong`;
  - status: `success`, `warning`, `danger`, `info`, each with a `-soft` background.

  Legacy names (ink-*, line, field-*, neutral-*, primary-300 as a button color, on-primary) must not appear in files you touch. **No raw hex colors** in className or style, except the WhatsApp brand green if needed: `#25d366` may only be a background with dark text `#0b3d1f`, or use a white button with a green icon.
- **Type scale: Tailwind defaults only.** `text-xs` (12) is for labels and meta, `text-sm` (14) is the UI default, `text-base` (16) for body and inputs, and `text-lg`/`xl`/`2xl`/`3xl`/`4xl` for headings. No arbitrary `text-[..px]`.
  - Weights: 400 body, 500 UI and labels, 600 headings. Never 700+ in the app; 700 only for the marketing display.
  - Page title: `text-2xl font-semibold tracking-tight text-fg`. Section title: `text-lg font-semibold`. Card title: `text-base font-semibold`.
- **Radii:** `rounded-md` for controls, inputs and small tiles; `rounded-lg` for cards and panels; `rounded-xl` for dialogs and sheets; `rounded-full` only for avatars, badges and dots. No arbitrary radii.
- **Spacing:** Tailwind scale only (1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16). Page gutters: `px-4 sm:px-6 lg:px-8`. Card padding: `p-5` or `p-6`. More space above a heading than below it.
- **Shadows:** `shadow-xs` for controls and cards, `shadow-card` for raised cards, `shadow-popover` for menus, `shadow-overlay` for dialogs. No arbitrary shadows.
- **Icons:** `lucide-react` only, `strokeWidth={1.75}`, size 16 (inline or small buttons), 18 (buttons and nav), or 20–22 (feature and empty states). Always `aria-hidden` when decorative. Delete usage of `/app/*.svg` and `/icons/*.svg` custom icons in files you touch; the brand logo SVGs in `/brand/` stay.
- **Logical properties only** (ms/me/ps/pe/start/end/text-start). Mirror directional icons in RTL with `rtl:-scale-x-100`.
- **Touch targets:** at least 40px, and 44px on coarse pointers. Use the primitives, which already do this.
- **Motion:** 150–220ms, `ease-[var(--ease-out-expo)]`. Globals already honor reduced motion. No scattered hover-scale effects.
- **Numbers:** always through next-intl `useFormatter().number` or `lib/format.ts`; use the `tabular` class in tables and counters. `formatBytes` and `isolate` in `lib/format.ts` keep "500 GB" in order inside Arabic text.
- Every page renders `<main id="main">` (the skip link targets it) and exactly one `<h1>`.
- Every route sets `export const metadata`/`generateMetadata` with a localized title. The root template adds " · Photnoo".
- Copy: the product's own language. Buttons name the action; errors name the problem and the recovery. **Never invent** testimonials, customer counts or ratings.
- Keep all existing behavior, API calls and query hooks working. Do not change `src/lib/api.ts`, `src/lib/queries.ts`, `src/lib/uploader.ts` or `src/lib/client-*.ts` except to add a hook your area needs.

## Primitives (src/components/ui)

- `button.tsx`: `Button` (variants primary, secondary, ghost, soft, danger, inverse, inverse-outline; sizes sm, md, lg; `icon`, `iconEnd` accept Lucide components; `pending`, `block`), `ButtonLink` (same, with an href; internal links use the locale router), `IconButton` (required `label`).
- `field.tsx`: `TextField`, `PasswordField`, `TextareaField`, `SelectField`, `CheckboxField`. The label is always visible; `hint` and `error` are wired with aria-describedby; `ltr` for email, phone, code and password.
- `dialog.tsx`: `Dialog` (native dialog, `dismissible={false}` while work runs, `footer` slot) and `useConfirm()`, which replaces every `window.confirm`: `const {confirm, dialog} = useConfirm()`.
- `menu.tsx`: `Menu`, an accessible dropdown (keyboard, Escape, focus return).
- `primitives.tsx`: `Badge` (tones plus a `dot`), `Card`, `Meter` (labelled progress), `Segmented` (radio group with arrow keys), `CopyButton` (announces "Copied" or a failure), `DetailList`.
- `state.tsx`: `Spinner`, `Loading`, `Skeleton`, `EmptyState` (Lucide icon), `ErrorState` (with retry), `Alert`.
- Common strings: namespace `Common` (`messages/<locale>/common.json`): close, cancel, retry, copy, copied, loading, showPassword, and so on.

## Messages

Messages are one file per area in `messages/en/*.json` and `messages/ar/*.json`. Each file holds a slice of the tree, e.g. `{"App": {"billing": {...}}}`, and they are deep-merged at runtime.
- **Only edit the files for your own area.** When you need new keys, add them to your area's files, or create a new file such as `messages/en/app-shell.json` plus its Arabic twin, then run `node scripts/sync-message-index.mjs`.
- Arabic must be real Arabic, never English copied over.

## Old components to migrate away from (do not delete; the lead removes them at the end)

- `src/components/app/dialog.tsx` (`Dialog`, `PillButton`): use `ui/dialog` and `ui/button`.
- `src/components/auth/fields.tsx` (`TextField`, `SubmitButton`, `FormAlert`, ...): use `ui/field`, `ui/button` and `ui/state` `Alert`.
- `src/components/app/status-badge.tsx`: rebuild it on `ui/primitives` `Badge` (neutral for draft, success for active, info for delivered, neutral for expired, warning for suspended) inside your area if you own it.

## Verification for your area

- Run `pnpm exec tsc --noEmit` and `pnpm exec eslint <your files>` from `apps/web`, using `export PATH="$HOME/.corepack-bin:$PATH"` in bash.
- Fix every error in files you own. Ignore errors in other areas; other builders are editing them at the same time.
- Do not start dev servers and do not commit.
