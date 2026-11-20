import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

test('public Kaggle and water inventory outputs reproduce byte for byte from retained raw inputs', (t) => {
  const out = mkdtempSync(path.join(tmpdir(), 'climate-gis-resources-'));
  let run;
  for (const python of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    run = spawnSync(
      python,
      ['-I', path.join(root, 'scripts/build-gis-resources.py'), '--out', out],
      { encoding: 'utf8' },
    );
    if (!run.error) break;
  }
  if (run.error) return t.skip('Python not available; app still runs with Node only.');
  assert.equal(run.status, 0, run.stderr);
  for (const name of [
    'water-access-candidates.json',
    'river-pollution-context.json',
    'gis-source-audit.json',
  ]) {
    assert.equal(
      readFileSync(path.join(out, 'public/data', name), 'utf8'),
      readFileSync(path.join(root, 'public/data', name), 'utf8'),
      name,
    );
  }
});
