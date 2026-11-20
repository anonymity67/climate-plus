import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, scenarioConfig } from '../src/engine.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const network = JSON.parse(read('public/data/gis-network.json'));
const geo = JSON.parse(read('public/data/gis-network.geojson'));
const bbox = { lonMin: 89.4, latMin: 22.4, lonMax: 89.7, latMax: 22.7 };

function* points(coords) {
  if (typeof coords[0] === 'number') yield coords;
  else for (const part of coords) yield* points(part);
}

test('GIS node and catchment ids match the planner network', () => {
  assert.deepEqual(
    network.nodes.map((n) => n.id),
    ['crew', 'pond', 'pump', 'reserve', 'school', 'supplier'],
  );
  assert.deepEqual(
    network.catchments.map((c) => c.id),
    ['east_catchment', 'west_catchment'],
  );
});

test('GIS capacities and demands equal the planner configuration', () => {
  const config = scenarioConfig('storm');
  const reserve = network.nodes.find((n) => n.id === 'reserve');
  assert.equal(reserve.capacityL, config.capacity);
  assert.equal(
    network.nodes.filter((n) => n.capacityL !== null).length,
    1,
    'only the reserve stores water',
  );
  assert.deepEqual(
    network.catchments.map((c) => c.demandLDay),
    config.demands.slice(0, 2),
  );
  assert.equal(network.nodes.find((n) => n.id === 'school').priority, 1);
});

test('derived blocked days and held sources reproduce the planner scenarios', () => {
  assert.deepEqual(network.derived.storm.blockedDays, SCENARIOS.storm.blockedDays);
  assert.deepEqual(network.derived.salinity.blockedDays, SCENARIOS.salinity.blockedDays);
  assert.deepEqual(network.derived.dry.blockedDays, SCENARIOS.dry.blockedDays);
  assert.deepEqual(
    network.derived.salinity.restrictedSourcesFromGeography,
    SCENARIOS.salinity.restrictedSources,
  );
  for (const day of network.derived.storm.blockedDays) {
    assert.ok(Number.isInteger(day) && day >= 0 && day <= 6);
  }
});

test('travel results are consistent and get slower with storm severity', () => {
  const { speedKmh, delayedFactor, blockedFactor } = network.assumptions;
  const clear = network.access.baseline.reserve;
  const moderate = network.access.storm_moderate.reserve;
  const severe = network.access.storm_severe.reserve;
  assert.ok(clear.distanceM < moderate.distanceM && moderate.distanceM < severe.distanceM);
  for (const r of [clear, moderate, severe]) {
    assert.ok(Math.abs(r.minutes - (r.distanceM / 1000 / speedKmh) * 60) < 0.1);
  }
  assert.equal(clear.status, 'open');
  assert.ok(moderate.detourFactor >= delayedFactor && moderate.detourFactor < blockedFactor);
  assert.equal(moderate.status, 'delayed');
  assert.ok(severe.detourFactor >= blockedFactor);
  assert.equal(severe.status, 'blocked');
});

test('every GIS feature is synthetic, located in the Dacope window and attributed', () => {
  assert.match(network.attribution, /OpenStreetMap/);
  assert.equal(geo.features.filter((f) => f.properties.kind === 'route').length, 3);
  for (const f of geo.features) {
    assert.equal(f.properties.status, 'synthetic', f.properties.id);
    for (const [lon, lat] of points(f.geometry.coordinates)) {
      assert.ok(lon >= bbox.lonMin && lon <= bbox.lonMax, f.properties.id + ' lon');
      assert.ok(lat >= bbox.latMin && lat <= bbox.latMax, f.properties.id + ' lat');
    }
  }
});

test('the committed GIS files are exactly what the build script produces', (t) => {
  const gpkg = path.join(root, 'research/gis/v1/climate_gis.gpkg');
  if (!existsSync(gpkg)) return t.skip('GeoPackage snapshot not present');
  const out = mkdtempSync(path.join(tmpdir(), 'gis-network-'));
  const script = path.join(root, 'scripts/build-gis-network.py');
  let run;
  for (const python of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    run = spawnSync(python, ['-I', script, '--out', out], { encoding: 'utf8' });
    if (!run.error) break;
  }
  if (run.error) return t.skip('Python is not available');
  assert.equal(run.status, 0, run.stderr);
  for (const name of ['public/data/gis-network.json', 'public/data/gis-network.geojson']) {
    assert.equal(readFileSync(path.join(out, name), 'utf8'), read(name), name);
  }
});
