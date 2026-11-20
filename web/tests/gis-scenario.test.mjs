import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioConfig, plan } from '../src/engine.mjs';
import * as adapter from '../src/gis-scenario.mjs';

const network = JSON.parse(
  readFileSync(new URL('../public/data/gis-network.json', import.meta.url)),
);
test('GIS-derived blocked days change planning feasibility and carry snapshot lineage', () => {
  const result = adapter.applyGISScenario(scenarioConfig('storm'), network);
  assert.deepEqual(result.blockedDays, [1]);
  assert.equal(result.gisEvidence.sourceSha256, network.source.sha256);
  assert.equal(result.gisEvidence.status, 'synthetic-scenario');
  assert.doesNotMatch(result.signal, /route is closed|tomorrow/i);
  assert.match(result.signal, /assumed|assumption/i);
  assert.deepEqual(result.restrictedSources, ['pump']);
  assert.deepEqual(result.gisEvidence.geographicRestrictedSources, []);
  const altered = structuredClone(network);
  altered.derived.storm.blockedDays = [0, 1, 2, 3, 4, 5, 6];
  const blocked = adapter.applyGISScenario(scenarioConfig('storm'), altered);
  assert.deepEqual(plan(blocked).schedule, []);
});
test('GIS adapter rejects missing source hash and out-of-horizon blocked days', () => {
  assert.throws(
    () => adapter.applyGISScenario(scenarioConfig('storm'), { ...network, source: {} }),
    /Invalid GIS/i,
  );
  const bad = structuredClone(network);
  bad.derived.storm.blockedDays = [7];
  assert.throws(() => adapter.applyGISScenario(scenarioConfig('storm'), bad), /Invalid GIS/i);
});
