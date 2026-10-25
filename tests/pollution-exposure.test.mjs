import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessLocation,
  customersCsv,
  parseCustomers,
  distanceM,
} from '../src/response-map/mvp/pollution-exposure.mjs';

const context = JSON.parse(
  readFileSync(new URL('../public/data/river-pollution-context.json', import.meta.url), 'utf8'),
);
const rows = context.rows;

test('a customer standing on a grid point sees that point as nearest at 0 m', () => {
  const [id, latitude, longitude, , cls] = rows[0];
  const a = assessLocation(rows, { latitude, longitude }, 2000);
  assert.equal(a.status, 'covered');
  assert.equal(a.nearest.id, id);
  assert.equal(a.nearest.cls, cls);
  assert.equal(a.nearest.distanceM, 0);
  assert.ok(a.count >= 4);
  assert.equal(Object.values(a.counts).reduce((x, y) => x + y, 0) <= a.count, true);
});

test('places outside the published grid are reported as outside coverage, never as clean', () => {
  const dacope = assessLocation(rows, { latitude: 22.55, longitude: 89.5 }, 2000);
  assert.equal(dacope.status, 'outside_coverage');
  assert.equal(dacope.worstClass, undefined);
  assert.equal(dacope.nearestDistanceM, null);
});

test('radius changes the neighbourhood but not the nearest point', () => {
  const place = { latitude: 23.9, longitude: 90.405 };
  const small = assessLocation(rows, place, 1000),
    large = assessLocation(rows, place, 5000);
  assert.equal(small.nearest.id, large.nearest.id);
  assert.ok(large.count > small.count);
});

test('worst class and high-or-worse share follow the points within the radius', () => {
  const place = { latitude: rows[100][1], longitude: rows[100][2] };
  const a = assessLocation(rows, place, 5000);
  const near = rows.filter((r) => distanceM(place, { latitude: r[1], longitude: r[2] }) <= 5000);
  assert.equal(a.count, near.length);
  const high = near.filter((r) => r[4] === 'High' || r[4] === 'Very High').length;
  const classed = near.filter((r) => r[4] && r[4] !== 'Unclassified').length;
  assert.equal(a.shareHighOrWorse, Math.round((high / classed) * 100));
});

test('customer text import keeps valid rows, skips bad ones and exports CSV', () => {
  const { customers, badLines } = parseCustomers(
    'name,latitude,longitude\nKarim Store, 23.9, 90.4\n"Bad Row",abc,90\nShop, with comma, 23.91, 90.41\n',
  );
  assert.deepEqual(
    customers.map((c) => c.name),
    ['Karim Store', 'Shop with comma'],
  );
  assert.deepEqual(badLines, [3]);
  const csv = customersCsv(
    customers.map((customer) => ({ customer, a: assessLocation(rows, customer, 2000) })),
  );
  assert.match(csv.split('\n')[0], /^name,latitude,longitude,status/);
  assert.equal(csv.trim().split('\n').length, 3);
});
