/** Build, validate and deploy Aquavelle to Cloudflare Workers + D1. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--dry-run'))
  throw Error('Usage: deploy-cloudflare.mjs [--dry-run]');
const dryRun = args.includes('--dry-run');
const id = process.env.AQUAVELLE_D1_ID || (dryRun ? '00000000-0000-4000-8000-000000000000' : '');
const name = process.env.AQUAVELLE_WORKER_NAME || 'aquavelle';
const mode = process.env.AQUAVELLE_AUTH_MODE || 'public';
const issuer = process.env.AQUAVELLE_ACCESS_ISSUER;
const audience = process.env.AQUAVELLE_ACCESS_AUDIENCE;
const operator = process.env.AQUAVELLE_OPERATOR_ORIGIN;
if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  throw Error('Set AQUAVELLE_D1_ID to the UUID of your D1 database.');
if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(name)) throw Error('Use a valid Worker name.');
if (!['public', 'access'].includes(mode))
  throw Error('Standalone deployment supports public mode or verified Cloudflare Access.');
if (
  mode === 'access' &&
  (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') ||
    !/^[a-f0-9]{64}$/i.test(audience || '') ||
    !/^https:\/\/(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(operator || ''))
)
  throw Error('Set the HTTPS Access team issuer, application audience and operator origin.');

const node = (argv) =>
  execFileSync(process.execPath, argv, { stdio: 'inherit', windowsHide: true });
node(['scripts/run-framework.mjs', 'build']);
const cfgPath = resolve('dist/server/wrangler.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.name = name;
cfg.vars = {
  ...cfg.vars,
  AQUAVELLE_AUTH_MODE: mode,
  ...(mode === 'access'
    ? {
        AQUAVELLE_ACCESS_ISSUER: issuer,
        AQUAVELLE_ACCESS_AUDIENCE: audience,
        AQUAVELLE_OPERATOR_ORIGIN: operator,
      }
    : {}),
};
cfg.d1_databases = [
  {
    binding: 'DB',
    database_name: 'aquavelle-db',
    database_id: id,
    migrations_dir: resolve('drizzle'),
  },
];
cfg.r2_buckets = [];
cfg.preview_urls = false;
cfg.observability = { enabled: true, logs: { enabled: true, invocation_logs: false } };
if (mode === 'access') cfg.routes = [{ pattern: new URL(operator).hostname, custom_domain: true }];
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

function wrangler(command) {
  node([
    '--import',
    './scripts/sites-env.mjs',
    './node_modules/wrangler/bin/wrangler.js',
    ...command,
    '--config',
    cfgPath,
  ]);
}
wrangler(['deploy', '--dry-run']);
if (!dryRun) {
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
  wrangler(['deploy']);
}
