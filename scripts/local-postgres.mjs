// Local Postgres without Docker, for machines where Docker Desktop is not available.
// Runs a real PostgreSQL 17 from npm binaries on port 5432 with data under .local/postgres.
//   node scripts/local-postgres.mjs
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/api/package.json'));
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(require.resolve('embedded-postgres')).href
);

const databaseDir = join(root, '.local', 'postgres');
const firstRun = !existsSync(databaseDir);
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'photnoo',
  password: 'photnoo',
  port: 5432,
  persistent: true,
  onLog: () => {},
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('photnoo');
console.log('Postgres running on postgresql://photnoo:photnoo@localhost:5432/photnoo (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
