import test from 'node:test';
import assert from 'node:assert/strict';
import hubs from '../public/data/rainhub-model.json' with { type: 'json' };
import {
  rainwaterPlan,
  rainHubAccessIndex,
  leakageEstimate,
  nearestChannel,
  projectToLine,
} from '../src/platform/water-model.mjs';
test('rainwater accounting conserves volume and makes wet-day timing explicit', () => {
  const input = {
    roofM2: 100,
    runoff: 0.8,
    tankL: 1000,
    startL: 200,
    dailyDemandL: 100,
    lossMm: 1,
    rainfallMm: [20, 0, 0, 5, 0],
  };
  const r = rainwaterPlan(input);
  // Day 1 spills 720 L; the second rain on day 4 spills another 20 L.
  assert.equal(r.totalCollectedL, 1840);
  assert.equal(r.totalSpillL, 740);
  assert.equal(r.closingL, 800);
  assert.equal(input.startL + r.totalCollectedL, r.totalServedL + r.totalSpillL + r.closingL);
  assert.equal(r.demandL, r.totalServedL + r.totalUnmetL);
  const early = rainwaterPlan({ ...input, startL: 0, rainfallMm: [20, 0, 0, 0, 0] });
  const late = rainwaterPlan({ ...input, startL: 0, rainfallMm: [0, 0, 0, 0, 20] });
  assert.ok(early.totalUnmetL < late.totalUnmetL);
});
test('zero rainfall, zero tank, invalid and overflow inputs cannot invent water', () => {
  const input = {
    roofM2: 80,
    runoff: 0.8,
    tankL: 0,
    startL: 0,
    dailyDemandL: 50,
    lossMm: 1,
    rainfallMm: [0, 100],
  };
  const r = rainwaterPlan(input);
  assert.equal(r.totalServedL, 0);
  assert.equal(r.totalUnmetL, 100);
  assert.equal(r.closingL, 0);
  for (const change of [
    { roofM2: Infinity },
    { startL: 1 },
    { dailyDemandL: 0 },
    { rainfallMm: [null] },
    { runoff: 1.1 },
    { rainfallMm: [] },
  ])
    assert.throws(() => rainwaterPlan({ ...input, ...change }));
});
test('projection finds the segment, retains original observation and rejects distant matches', () => {
  const p = { latitude: 23, longitude: 90.01 };
  const coordinates = [
    [90, 23],
    [90.02, 23],
  ];
  const q = projectToLine(p, coordinates);
  assert.ok(q.gapM < 0.01);
  assert.deepEqual(p, { latitude: 23, longitude: 90.01 });
  assert.equal(
    nearestChannel({ ...p, latitude: 24 }, [
      { id: 'a', component: 'a', geometry: { coordinates } },
    ]),
    null,
  );
  assert.equal(nearestChannel(p, [{ id: 'a', component: 'a', geometry: { coordinates } }]).id, 'a');
});
test('leak estimate uses measured volume and time, not unsupported drip sizes', () => {
  assert.equal(leakageEstimate(100, 60).dailyLitres, 144);
  assert.throws(() => leakageEstimate(100, 0));
});

test('browser scenario index agrees with the frozen RainHub export', () => {
  const scenarios = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ];
  for (const [i, [hasHubs, cleanup]] of scenarios.entries()) {
    const index = rainHubAccessIndex(hubs.blocks, {
      hubs: hasHubs,
      cleanup,
      effect: hubs.meta.cleanup_effect,
    });
    assert.ok(Math.abs(index - hubs.wai[i].wai) < 0.00002, hubs.wai[i].scenario + ': ' + index);
  }
  for (const row of hubs.wai_sensitivity) {
    const index = rainHubAccessIndex(hubs.blocks, {
      hubs: true,
      cleanup: true,
      effect: row.cleanup_effect,
    });
    assert.ok(Math.abs(index - row.wai_hubs_and_cleanup) < 0.00002);
  }
});
