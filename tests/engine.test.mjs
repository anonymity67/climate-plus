import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scenarioConfig,
  plan,
  simulate,
  inspect,
  canonical,
  receipt,
  verifyReceipt,
} from '../src/engine.mjs';

test('scenario config is seven days with an explicit synthetic provenance', () => {
  const c = scenarioConfig('salinity');
  assert.equal(c?.days, 7);
  assert.equal(c.provenance, 'synthetic');
  assert.ok(c.restrictedSources.includes('pond'));
});
test('planner conserves water and respects budget and storage', () => {
  const c = scenarioConfig('storm');
  const p = plan(c, { budget: 2400 });
  assert.ok(p?.rows?.length === 7);
  for (const r of p.rows) {
    assert.ok(Math.abs(r.open + r.inflow + r.delivery - r.served - r.spill - r.close) < 1e-6);
    assert.ok(r.close >= 0 && r.close <= c.capacity);
  }
  assert.ok(p.cost <= 2400);
  assert.equal(p.rows[1].delivery, 0);
});
test('no money and no water returns all unmet demand without NaN', () => {
  const c = { ...scenarioConfig('storm'), initial: 0, inflows: Array(7).fill(0) };
  const p = plan(c, { budget: 0 });
  assert.ok(p);
  assert.equal(p.served, 0);
  assert.equal(p.worstCoverage, 0);
  assert.equal(p.unmet, p.demand);
});
test('balanced allocation meets school floor when feasible and avoids household starvation', () => {
  const c = { ...scenarioConfig('salinity'), initial: 1000, inflows: Array(7).fill(0) };
  const p = simulate(c, [], { budget: 0, schoolFloor: 0.8 });
  assert.ok(p?.rows);
  assert.equal(p.rows[0].allocation[2], 240);
  assert.ok(Math.abs(p.rows[0].allocation[0] / 1200 - p.rows[0].allocation[1] / 800) < 1e-8);
});
test('zero demand produces defined full coverage', () => {
  const p = plan({ ...scenarioConfig('dry'), demands: [0, 0, 0] }, { budget: 0 });
  assert.ok(p);
  assert.equal(p.worstCoverage, 1);
  assert.equal(p.unmet, 0);
});
test('optimizer is no worse than every feasible schedule in its catalogue', () => {
  const c = scenarioConfig('salinity'),
    opts = { budget: 1600 },
    best = plan(c, opts);
  assert.ok(best?.score);
  for (let mask = 0; mask < 128; mask++) {
    const days = Array.from({ length: 7 }, (_, i) => i).filter((i) => mask & (1 << i));
    if (days.length > 2) continue;
    const p = simulate(c, days, opts);
    for (let i = 0; i < best.score.length; i++) {
      if (Math.abs(best.score[i] - p.score[i]) < 1e-6) continue;
      assert.ok(best.score[i] <= p.score[i] + 1e-6);
      break;
    }
  }
});
test('invalid demand and budgets are rejected', () => {
  assert.throws(() => plan(scenarioConfig('storm'), { budget: -1 }), /budget/i);
  assert.throws(() => plan(scenarioConfig('storm'), { demandMultiplier: NaN }), /demand/i);
});
test('inspections respect access and available hours', () => {
  const selected = inspect(
    [
      { id: 'a', hours: 2, priority: 4, accessible: true },
      { id: 'b', hours: 3, priority: 9, accessible: false },
      { id: 'c', hours: 1, priority: 3, accessible: true },
    ],
    2,
  );
  assert.deepEqual(
    selected?.map((x) => x.id),
    ['a'],
  );
});
test('receipt verifies and detects tampering; canonical keys are order independent', async () => {
  assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 }));
  assert.ok(canonical({ a: 2 }));
  const r = await receipt({ plan: { litres: 100 }, provenance: 'synthetic' });
  assert.ok(r?.digest);
  assert.equal(await verifyReceipt(r), true);
  r.manifest.plan.litres = 101;
  assert.equal(await verifyReceipt(r), false);
});
