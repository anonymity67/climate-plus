import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferDO, mixLoad } from '../src/water-engine.mjs';
const data = JSON.parse(
  readFileSync(new URL('../public/data/water-evidence.json', import.meta.url)),
);
test('browser model reproduces every supported held-out Python prediction', () => {
  let checked = 0;
  for (const r of data.evaluation.testRows) {
    const output = inferDO(data.model, r.features);
    if (!r.inDomain) {
      assert.equal(output.status, 'outside-domain');
      continue;
    }
    assert.ok(
      Math.abs(output.value - r.predicted) < 1e-6,
      `${r.id}: ${output.value} vs ${r.predicted}`,
    );
    checked++;
  }
  assert.equal(checked, data.evaluation.testInDomain);
});
test('dataset transformation retains real coordinates, exclusions and separate surveys', () => {
  assert.equal(data.observations.length, 1495);
  assert.equal(data.survey.length, 40);
  assert.equal(data.hydraulics.length, 6);
  assert.equal(data.unlocatedSpatialSamples.length, 62);
  assert.ok(data.unlocatedSpatialSamples.every((r) => r.latitude === null));
  assert.ok(data.observations.every((r) => r.cod === null || r.cod >= 0));
  assert.equal(data.qualityAudit.invalidCells.length, 6);
  assert.ok(
    data.observations.every(
      (r) => r.latitude >= 23 && r.latitude <= 25 && r.longitude >= 89 && r.longitude <= 92,
    ),
  );
  assert.ok(!data.model.features.some((f) => ['do', 'WQI', 'Pollution_Label'].includes(f)));
  assert.ok(data.evaluation.testRows.every((r) => r.date.startsWith('2021')));
});
test('all published source scenarios retain finite mass-balance diagnostics', () => {
  for (const h of data.hydraulics) {
    const r = mixLoad(h, 0.5);
    assert.ok(Number.isFinite(r.predicted));
    assert.ok(r.after <= r.predicted);
    assert.ok(r.sourceShare >= 0 && r.sourceShare <= 1);
  }
});
