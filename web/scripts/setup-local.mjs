/** Apply versioned SQL migrations to the same local D1 binding used by Vite/Wrangler. */
import './sites-env.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from './sites-env.mjs';
const hosting = JSON.parse(readFileSync(path.join(projectRoot, '.openai/hosting.json'), 'utf8'));
if (hosting.d1 !== 'DB') throw Error('Expected the DB D1 binding. Review hosting configuration.');
const config = {
  name: 'climateplus-local-migrations',
  compatibility_date: '2026-05-15',
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'site-creator-d1',
      database_id: '00000000-0000-4000-8000-000000000000',
      migrations_dir: path.join(projectRoot, 'drizzle'),
    },
  ],
};
mkdirSync(path.join(projectRoot, '.sites-runtime'), { recursive: true });
const configPath = path.join(projectRoot, '.sites-runtime/local-migrations.json');
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
const result = spawnSync(
  process.execPath,
  [
    '--import',
    './scripts/sites-env.mjs',
    './node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    configPath,
    '--persist-to',
    path.join(projectRoot, '.wrangler/state'),
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, CI: 'true' },
    stdio: ['ignore', 'inherit', 'inherit'],
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
