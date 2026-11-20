import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeFacts as f, bnNum } from '../src/platform/home-facts.mjs';

const m = JSON.parse(
  readFileSync(new URL('../public/data/rainhub-model.json', import.meta.url), 'utf8'),
);

test('home page rain numbers match the model export', () => {
  assert.deepEqual(f.monthlyMm, m.meta.monthly_mm);
  assert.equal(
    f.yearMm,
    m.meta.monthly_mm.reduce((a, b) => a + b, 0),
  );
  assert.equal(
    f.dryFiveMm,
    [...m.meta.monthly_mm]
      .sort((a, b) => a - b)
      .slice(0, 5)
      .reduce((a, b) => a + b, 0),
  );
  const rain = m.cells.map((c) => c.rain_mm_year);
  assert.deepEqual(f.rainRangeMm, [Math.min(...rain), Math.max(...rain)]);
});

test('home page people, sample and tank numbers match the model export', () => {
  assert.equal(f.population, Math.round(m.meta.population / 1e5) / 10);
  assert.equal(f.exposed, Math.round(m.meta.exposed / 1e5) / 10);
  assert.equal(f.samples, m.meta.samples);
  assert.equal(f.oxygenPassPct, Math.round(m.meta.pass_pct));
  assert.equal(f.hubs, m.hubs.length);
  assert.equal(f.tankM3, m.meta.hub_tank_m3);
  assert.equal(
    f.hubPeople,
    m.hubs.reduce((a, h) => a + h.served, 0),
  );
  assert.deepEqual(
    f.reliabilityPct,
    m.meta.hubs_reliability.map((r) => Math.round(r * 100)),
  );
  assert.equal(f.accessBasePct, Math.round(m.wai[0].wai * 100));
  assert.equal(f.accessWithCleanupPct, Math.round(m.wai[3].wai * 100));
});

test('Bangla digits', () => {
  assert.equal(bnNum('2,301 mm'), '২,৩০১ mm');
});
