// Turns on row-level security for every table in the public schema, as a second lock against
// Supabase's public Data API. The app connects as the tables' owner, so it is not affected.
// Safe to re-run; run it after every migration that adds a table.
// usage (from packages/db): DATABASE_URL="<session pooler url>" node scripts/enable-rls.mjs
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
for (const { tablename } of rows) {
  await client.query(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
}
const check = await client.query(`SELECT count(*) FILTER (WHERE rowsecurity) AS secured, count(*) AS total FROM pg_tables WHERE schemaname = 'public'`);
console.log(`Row-level security on ${check.rows[0].secured} of ${check.rows[0].total} tables`);
await client.end();
