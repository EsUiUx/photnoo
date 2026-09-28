# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Photographers in Egypt** (Cairo, Alexandria, Giza and beyond): wedding, engagement, family, newborn, event and corporate shooters, mostly solo or small studios. They finish a shoot, upload hundreds of large JPEG/RAW files from a laptop, and hand the client a private link. They also check which clients viewed and downloaded, and manage their plan and invoices. Desktop for uploading and managing; phone for checking activity.
- **Their clients** (couples, families, HR teams): no account, no app. They open a WhatsApp link on a phone, enter a password, browse and download their photos within 7 days.
- **Photnoo staff** (Super Admin, Operations, Support): a separate admin console (apps/admin). It shares the brand but not this app.

## Product Purpose

Photnoo is a delivery platform for professional photographers. The photographer uploads a finished shoot into a private gallery, shares a link and a password (sent separately on WhatsApp), and the client views and downloads originals within a 7-day window and a download allowance of twice the gallery size. Every view and download is recorded as proof of delivery. Success: photographers deliver faster, look more professional than a Google Drive link, and settle "I never received the photos" disputes with evidence.

## Positioning

Built for photo delivery in Egypt, not generic file transfer. Private link plus a separately sent password, a 7-day window, a download cap that stops link sharing, and proof of every download. Priced in EGP and paid by InstaPay, Vodafone Cash or bank transfer, invite-only for vetted photographers, with Arabic support.

## Operating Context

- Photographer journey: apply → approved by staff → invite link → create account → create gallery (client name + phone) → drag-and-drop upload, resumable, into optional folders → share (7-day link + password to WhatsApp) → watch views and downloads → gallery closes and files are purged.
- Client journey: WhatsApp message → mobile gallery → password → browse, full-screen viewer, download one or all → closed page when the link expires or the allowance runs out.
- Billing: annual (pre-selected) or monthly plans from 100 GB to 2 TB per year of deliveries, plus Enterprise (contact us). Manual payment with a PHN-XXXXXX reference and a receipt upload, reviewed by staff, then an invoice PDF.
- Surfaces in this app: marketing homepage, auth (login, apply, invite, reset), photographer app (dashboard, galleries, gallery detail with uploader and sharing, billing), client gallery `/g/<token>`.

## Capabilities and Constraints

- Next.js 16 app router, Tailwind 4, next-intl. **English is the primary language and the default locale; Arabic is secondary** with full RTL (user decision, 2026-09-28).
- Open-source icon library allowed and preferred over the current custom Figma icons (user request).
- Photographer app sidebar items not in v1 (Clients, Notifications, Settings, Store, Prints, Portfolio, Analytics) are not built; do not invent their functionality.
- Admins see metadata only, never photos (outside a logged abuse case).
- Undecided by the owner: prices (current ones are placeholders), testimonials, social URLs, whether the phone number is public.

## Brand Commitments

- Name **Photnoo**; the PHOTNO wordmark with its star mark (`public/brand/logo-green.svg`, `logo-white.svg`) stays.
- The green brand scale stays: primary-50 `#f4f8f5` to primary-900 `#14201b`, core greens `#588157`, `#3a5a40`, `#344e41` (user decision: "keep logo + green brand"). Everything else about the look (type, layout, components, imagery, surfaces) is open for redesign. The user described the current look as outdated, generic and dull and wants premium and sleek.
- **Standing preference (2026-09-28): the category standard, executed at full craft.** The user chose the conventional photo-delivery SaaS look over the concept directions. The quality bar is **Pixieset and Pic-Time**: photo-first, clean, polished, calm. Do not smuggle concept quirks into it.

## Evidence on Hand

- Real product flows and data model (running locally with demo data from `pnpm --filter @photnoo/api seed:demo`).
- No real testimonials, customer logos, press or usage numbers exist: none may be invented. Stats or quotes shown on marketing pages must be clearly placeholder or omitted.
- Photography: free-license stock photos (Unsplash or Pexels) are approved for marketing, auth and demo imagery, to be replaced by the owner's own later. Provenance is recorded per file.

## Product Principles

1. The photos are the product: the interface frames the photographer's work and recedes around it.
2. Delivery must feel more premium than a file link. Every screen a client sees represents the photographer's brand.
3. Evidence over promises: views, downloads and receipts are shown plainly, as proof.
4. Fast on a phone on Egyptian 4G: the client flow must work in seconds with one hand.
5. Nothing ambiguous about money or expiry: dates, allowance and prices are always explicit.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast and keyboard access; visible focus on every control.
- Full RTL mirroring for Arabic; Western digits in both languages.
- Clients are often non-technical and on mid-range Android phones: large tap targets (44 px minimum), no hover-only affordances.
