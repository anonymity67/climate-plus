import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  atlasDistricts,
  atlasMatches,
  samplesNearTrace,
} from '../src/platform/riverwatch-model.mjs';

const folder = new URL('../public/data/riverwatch/', import.meta.url);
const fetchData = (path) => JSON.parse(readFileSync(new URL(path, folder), 'utf8'));
const national = fetchData('national.json');
const pilot = fetchData('dhaka_pilot.json');
const shards = new Map();

function detail(run, site) {
  const path = run + '/' + site.group + '.json';
  if (!shards.has(path)) shards.set(path, fetchData(path));
  return shards.get(path)[site.id];
}

test('national atlas preserves each site and the difference between a priority lead and a trace', () => {
  assert.equal(national.sites.length, 4898);
  assert.equal(new Set(national.sites.map((s) => s.id)).size, national.sites.length);
  assert.equal(national.sites.filter((s) => s.linked).length, 4331);
  const priority = atlasMatches(national.sites, {
    district: '',
    category: '',
    query: '',
    priority: true,
  });
  assert.equal(priority.length, 171);
  assert.equal(priority.filter((s) => !s.traced).length, 31);
  let count = 0;
  for (const site of national.sites) {
    const evidence = detail('national', site);
    assert.ok(evidence, site.id);
    assert.equal(evidence.linkReviewed, false);
    assert.equal(evidence.pairs.length, 0);
    assert.equal(site.traced, evidence.trace.length > 0);
    assert.ok(site.point[0] > 88 && site.point[0] < 93 && site.point[1] > 20 && site.point[1] < 27);
    count += evidence.trace.length;
    for (const row of evidence.trace) assert.ok(row.toKm >= row.fromKm && row.toKm <= 10);
  }
  assert.equal(count, 21972);
});

test('Dhaka pilot keeps real paired dates at their site and keeps references out of the site count', () => {
  assert.equal(pilot.sites.length, 31);
  assert.equal(pilot.sites.filter((s) => s.reference).length, 2);
  assert.equal(pilot.ranked, 0);
  assert.equal(pilot.summary.mapped, 29);
  let pairs = 0;
  for (const site of pilot.sites) {
    const evidence = detail('dhaka_pilot', site);
    assert.equal(evidence.pairs.length, site.pairs);
    assert.deepEqual(
      evidence.sampling.map((p) => p.side),
      ['down', 'up'],
    );
    assert.equal(evidence.linkReviewed, false);
    for (const row of evidence.pairs) {
      assert.ok(row.date >= '2025-11-01' && row.date < '2026-05-01');
      assert.ok(Math.abs(row.down - row.up - row.delta) < 1e-9);
      assert.ok(row.upPixels >= 3 && row.downPixels >= 3);
    }
    pairs += site.pairs;
  }
  assert.equal(pairs, pilot.qa.valid_paired_dates);
  assert.equal(pairs, 109);
});

test('district and river filters retain stable site identity and nearby field samples stay at their coordinates', () => {
  assert.ok(atlasDistricts(national.sites).some(([name]) => name === 'Dhaka'));
  const matches = atlasMatches(national.sites, {
    district: 'Dhaka',
    category: 'industrial',
    query: 'buriganga',
    priority: false,
  });
  assert.ok(matches.length > 0);
  assert.ok(matches.every((s) => s.district === 'Dhaka' && s.category === 'industrial'));
  const sample = { id: 'dated-study-site', latitude: 23.6, longitude: 90.425 };
  const geometry = {
    type: 'LineString',
    coordinates: [
      [90.42, 23.6],
      [90.43, 23.6],
    ],
  };
  const nearby = samplesNearTrace([{ geometry }], [sample, { ...sample, latitude: 24 }]);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].longitude, sample.longitude);
  assert.equal(nearby[0].latitude, sample.latitude);
  assert.ok(nearby[0].distanceM < 1);
});

test('Bangladesh map includes all administrative areas with a bounded first load', () => {
  const baseMap = fetchData('bangladesh.json');
  assert.equal(baseMap.features.filter((f) => f.properties.layer === 'divisions').length, 8);
  assert.equal(baseMap.features.filter((f) => f.properties.layer === 'districts').length, 64);
  const firstLoad = ['bangladesh.json', 'national.json'].reduce(
    (sum, path) => sum + gzipSync(readFileSync(new URL(path, folder))).length,
    0,
  );
  assert.ok(firstLoad < 550000, 'First-load map data in bytes: ' + firstLoad);
});
