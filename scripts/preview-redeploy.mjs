// Redeploys the local preview that the Cloudflare tunnel serves, with a few seconds of downtime.
// 1. builds the web app into apps/web/.next-staging while the live server keeps serving .next
// 2. (--api) rebuilds the API and restarts API + worker with the tunnel origin
// 3. stops the live web server, swaps the build in, starts `next start` on :3000 again
// usage: node scripts/preview-redeploy.mjs --origin https://<name>.trycloudflare.com [--api]
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps', 'web');
const api = join(root, 'apps', 'api');
const logs = join(root, '.local', 'preview-logs');
mkdirSync(logs, { recursive: true });

const args = process.argv.slice(2);
const origin = args[args.indexOf('--origin') + 1];
if (!origin?.startsWith('https://')) throw new Error('Pass --origin https://<tunnel host>');
const withApi = args.includes('--api');

const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const ps = (script) => execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`).toString();

const pidsOnPort = (port) =>
  ps(`(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique`)
    .split(/\s+/)
    .filter(Boolean);
const pidsMatching = (pattern) =>
  ps(`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '${pattern}' } | ForEach-Object { $_.ProcessId }`)
    .split(/\s+/)
    .filter(Boolean);
const kill = (pids) => pids.forEach((pid) => ps(`Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`));

function start(args, cwd, name, env = {}) {
  const out = openSync(join(logs, `${name}.log`), 'a');
  spawn(process.execPath, args, { cwd, detached: true, stdio: ['ignore', out, out], env: { ...process.env, ...env }, windowsHide: true }).unref();
}

console.log('> building web into .next-staging');
rmSync(join(web, '.next-staging'), { recursive: true, force: true });
run(`"${process.execPath}" node_modules/next/dist/bin/next build`, web, { NEXT_DIST_DIR: '.next-staging' });

if (withApi) {
  console.log('> building API, restarting API + worker');
  run(`"${process.execPath}" node_modules/typescript/bin/tsc -p tsconfig.build.json`, api);
  kill([...pidsMatching('dist[\\\\/]main\\.js'), ...pidsMatching('dist[\\\\/]worker\\.js')]);
  const env = { WEB_ORIGIN: origin, PUBLIC_API_URL: origin };
  start(['--env-file=../../.env', 'dist/main.js'], api, 'api', env);
  start(['--env-file=../../.env', 'dist/worker.js'], api, 'worker', env);
}

console.log('> swapping the web build');
kill(pidsOnPort(3000));
await new Promise((resolve) => setTimeout(resolve, 800));
rmSync(join(web, '.next-previous'), { recursive: true, force: true });
if (existsSync(join(web, '.next'))) renameSync(join(web, '.next'), join(web, '.next-previous'));
renameSync(join(web, '.next-staging'), join(web, '.next'));
start(['node_modules/next/dist/bin/next', 'start', '-p', '3000'], web, 'web');
console.log(`> live at ${origin}`);
