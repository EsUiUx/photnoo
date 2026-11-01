# Deploying Photnoo to your own Vercel and Supabase

This sets up your own copy: two or three Vercel projects and one Supabase project. It needs about an hour.
Nothing here depends on anyone else's accounts. Generate your own secrets.

## What runs where

| Piece | Host | Notes |
| --- | --- | --- |
| Website and photographer app (`apps/web`) | Vercel project | Proxies `/v1/*` to the API, so auth cookies stay first-party |
| API (`apps/api`) | Vercel project | The Nest app runs as one function (`apps/api/api/index.js`) |
| Admin console (`apps/admin`) | Vercel project, optional | The CLI commands below cover the same first steps |
| Postgres | Supabase | Prisma migrations, connected through Supabase's pooler |
| Photos | Supabase Storage | Used through its S3-compatible endpoint, with a private bucket |

There is no always-on worker on Vercel. With `JOBS_INLINE=true`, photo processing runs right after each upload,
and a cron request (`apps/api/vercel.json`) runs gallery expiry and billing checks once a day.

## You need

- Node.js 22 and pnpm 9 (`corepack enable`)
- Accounts on GitHub, Vercel and Supabase
- For your own domain: access to its DNS

```bash
git clone <this repository>
cd photnoo
corepack pnpm@9.15.4 install
corepack pnpm@9.15.4 turbo run build --filter=@photnoo/api
```

## If you received an existing Supabase project

If the Supabase project was transferred to you, its database, bucket, tables and data are already in place.
Use this section in place of step 1, then continue with steps 2, 3 and 5. A previous owner's site keeps using
the old credentials until you replace them, so treat every one of them as compromised.

Skip these parts of the guide:

- Step 1, except finding the pooler host (1.5). You still need your project's ref and pooler host for the URLs.
- Creating demo data in step 4. Create your own admin and photographer only if you need them.
  `seed-plans` is safe to run: it changes nothing if plans already exist.

Replace the credentials in this order:

1. Set up the Vercel projects in steps 2 and 3, but do not deploy yet.
2. Create new storage keys (**Storage → S3 Configuration → New access key**) for the API's `S3_ACCESS_KEY_ID`
   and `S3_SECRET_ACCESS_KEY`.
3. Generate a new database password, letters and digits only, and set it in the **SQL Editor**. This stops any
   previous owner's site from reaching the database.

   ```sql
   alter role photnoo_app password '<generated password>';
   ```

4. Build `DATABASE_URL` from step 1.5 with that password, and generate your own `JWT_ACCESS_SECRET` and
   `CRON_SECRET` as shown in step 2. Never reuse the previous values. A new JWT secret signs everyone out.
5. Deploy the API and the website, then run the checks in steps 2 and 3.
6. Delete the old access keys under **Storage → S3 Configuration**.
7. Review the accounts in the data. Delete demo photographers, clients and galleries you do not want, or change
   their passwords. Passwords for demo accounts may have been shared with others during testing.

Moving a domain: the previous owner must first remove it from their Vercel project. Then follow step 5.

Until the previous owner deletes their API project on Vercel, its daily cron request fails once the database
password has changed. That has no effect on your site.

## 1. Supabase

1. Create a project and choose the region closest to your users. These steps use Frankfurt (`eu-central-1`).
2. In the **SQL Editor**, create a database user for the app with a password you generate.
   Use letters and digits only, so it needs no escaping in a URL.

   ```sql
   create role photnoo_app login password '<generated password>';
   grant usage, create on schema public to photnoo_app;
   grant create on database postgres to photnoo_app;
   ```

3. Create a private bucket, also in the SQL Editor:

   ```sql
   insert into storage.buckets (id, name, public) values ('photnoo-media', 'photnoo-media', false);
   ```

4. Create storage keys: **Storage → S3 Configuration → New access key**. Note the access key ID, the secret
   and the endpoint shown there (`https://<project-ref>.storage.supabase.co/storage/v1/s3`).
5. Find the pooler host: click **Connect** at the top of the dashboard. It looks like
   `aws-1-eu-central-1.pooler.supabase.com` (the `aws-0`/`aws-1` part varies by project). You need two URLs:

   ```
   # Session pooler: migrations, seeds, scripts
   postgresql://photnoo_app.<project-ref>:<password>@<pooler-host>:5432/postgres?uselibpqcompat=true&sslmode=require
   # Transaction pooler: the running API
   postgresql://photnoo_app.<project-ref>:<password>@<pooler-host>:6543/postgres?uselibpqcompat=true&sslmode=require
   ```

   The direct `db.<ref>.supabase.co` host is IPv6-only, so Vercel cannot use it.

6. Create the tables and lock them against Supabase's public Data API, from `packages/db`:

   ```bash
   cd packages/db
   DATABASE_URL="<session pooler url, ending ?sslmode=require>" corepack pnpm@9.15.4 exec prisma migrate deploy
   DATABASE_URL="<session pooler url>" node scripts/enable-rls.mjs
   cd ../..
   ```

   `prisma migrate deploy` needs the URL to end in `?sslmode=require`, without `uselibpqcompat=true`.
   Re-run `enable-rls.mjs` after any migration that adds a table.

## 2. Vercel: API project

Create a project from this repository (or with `vercel project add`), then set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Include files outside the root directory | On |
| Node.js Version | 24.x |
| Function Region | Same area as the database (for example `fra1`) |

Build settings come from `apps/api/vercel.json`. Add these environment variables for Production:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` (or `staging`, if you want to load demo data: the seed refuses `production`) |
| `WEB_ORIGIN` | The website's final URL, such as `https://your-domain.com`. Share and invite links use it |
| `ADMIN_ORIGIN` | The admin console's URL, if you deploy it |
| `TRUST_PROXY_HOPS` | `1` |
| `DATABASE_URL` | The transaction pooler URL (port 6543) |
| `DB_POOL_MAX` | `3` |
| `REDIS_URL` | `redis://127.0.0.1:6379`. Required by validation, but nothing depends on Redis yet |
| `JWT_ACCESS_SECRET` | Generate (command below) |
| `CRON_SECRET` | Generate. Vercel sends it on cron requests |
| `JOBS_INLINE` | `true` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | The endpoint from Supabase |
| `S3_REGION` | Your project's region, such as `eu-central-1` |
| `S3_BUCKET` | `photnoo-media` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The storage keys from Supabase |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | See "Known limits": email is not working yet. `127.0.0.1`, `1025` and any sender address let the API start |
| `COMPANY_*`, `PAY_*` | Your invoice details and payment instructions. See `.env.example`. A payment method left empty is hidden |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Deploy, then open `https://<api-url>/health`. A 503 with `"database":"ok","redis":"down"` is the expected healthy result.

## 3. Vercel: website project

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Include files outside the root directory | On |
| Node.js Version | 22.x |
| Environment variable | `API_URL` = the API project's production URL, with no trailing slash |

`API_URL` is read at build time for the `/v1` proxy, so redeploy the website whenever it changes.
It must stay listed under `env` for `build` in `turbo.json`. Turborepo hides undeclared variables from the
build, and the symptom is a `DNS_HOSTNAME_RESOLVED_PRIVATE` 404 on `/v1/*`.

To check: `https://<website-url>/v1/auth/invites/x` should return JSON with `invite_invalid`.

**Admin console (optional):** the same settings with Root Directory `apps/admin` and the same `API_URL`.

## 4. First accounts

Put the API's variables in a git-ignored file, `.local/production.env`, for running CLI commands. For the
commands below, use the session pooler URL for `DATABASE_URL` in that file. Run them from `apps/api`:

```bash
cd apps/api
node --env-file=../../.local/production.env dist/cli/billing.js seed-plans
```

Create a photographer:

1. Submit the form at `https://<website-url>/en/apply`.
2. List applications and approve one:

   ```bash
   node --env-file=../../.local/production.env dist/cli/applications.js list
   node --env-file=../../.local/production.env dist/cli/applications.js approve <id> --trial
   ```

3. The approve command prints an invite link, and the email error beside it is expected. Open the link and set a password.

Create an admin, which prints a one-time password and an authenticator key:

```bash
node --env-file=../../.local/production.env dist/cli/admins.js create <email> "<name>" super_admin
```

Optional demo data, for a photographer who already exists (`NODE_ENV` must not be `production`):

```bash
node --env-file=../../.local/production.env dist/cli/seed-demo.js <photographer-email>
```

It prints sample client gallery links and passwords.

## 5. Your domain

In the website project, add the domain under **Settings → Domains**. In your DNS, add what Vercel shows,
usually an `A` record from `@` to `76.76.21.21` and a `CNAME` from `www` to `cname.vercel-dns.com`, and remove any
old parking records. Then set `WEB_ORIGIN` on the API project to the new URL and redeploy the API.

## Updating

Pushes redeploy automatically if you connected the Vercel projects to Git. After a schema change, run step 1.6 again.

## Known limits

- **Emails are not sent.** `MailService` connects to SMTP without a username or password, so hosted providers
  such as Resend or SES need a small code change first (`apps/api/src/mail/mail.service.ts`). Failures are logged
  and do not break requests. Until then, invite links come from the CLI, and password reset emails do not arrive.
- **Vercel Hobby** is for non-commercial use and limits cron to once a day. Use Pro for a paid launch.
- **Supabase's free plan** caps each uploaded file at 50 MB. Paid plans allow more, under Storage settings.
- **Photo processing has no retry on Vercel.** With `JOBS_INLINE`, a failure is logged and the file stays in processing.
  For production volume, consider running `dist/worker.js` on a small always-on server instead, with `JOBS_INLINE` unset.
- **Function time limit:** processing must finish within the function's `maxDuration` (300 seconds).
- **Rate limiting** is not backed by Redis yet, and the captcha after failed gallery passwords is not built on the web side.
- **Not yet proven on Vercel:** a full upload through the app (upload, complete, process). Signed part uploads to
  Supabase storage and sign-in, gallery, client and analytics reads have been tested. Test an upload first.
