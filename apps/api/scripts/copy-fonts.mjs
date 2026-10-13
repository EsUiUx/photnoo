// Copies the invoice fonts next to the compiled code, so serverless bundles (which only trace
// require() calls) ship them. src/billing/invoice-pdf.ts prefers dist/fonts when it exists.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const from = join(dirname(require.resolve('@fontsource/ibm-plex-sans-arabic/package.json')), 'files');
const to = new URL('../dist/fonts/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const subset of ['latin', 'arabic']) {
  for (const weight of [400, 600]) {
    const name = `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff`;
    cpSync(join(from, name), new URL(name, to));
  }
}
