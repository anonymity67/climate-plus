import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as gis from '../src/gis-engine.mjs';
const read = (name) => JSON.parse(readFileSync(new URL('../public/data/' + name, import.meta.url)));

test('water inventory decodes column contracts without claiming current clearance', () => {
  const data = read('water-access-candidates.json');
  const points = gis.decodeWaterInventory(data);
  assert.equal(points.length, 20084);
  assert.equal(points[0].id, '7MRF2M2X+QW2');
  assert.equal(points[0].latitude, 26.001895);
  assert.equal(points[0].longitude, 89.699775);
  assert.equal(points[0].assessedAt, '2014-11-20');
  assert.equal(new Set(points.map((r) => r.id)).size, 20084);
  assert.ok(points.every((r) => gis.waterPointEvidence(r, '2026-10-24').canRecommend === false));
  assert.throws(
    () => gis.decodeWaterInventory({ ...data, fields: ['wrong'] }),
    /inventory|schema/i,
  );
});

test('Kaggle context retains every source coordinate and the one unclassified point', () => {
  const data = read('river-pollution-context.json');
  assert.equal(data.rows.length, 9958);
  assert.equal(data.audit.classCounts.High + data.audit.classCounts['Very High'], 4154);
  assert.equal(data.rows.find((r) => r[0] === 'KAG-6106')[4], 'Unclassified');
  assert.equal(data.audit.samplingDatesSupplied, false);
  assert.equal(data.audit.laboratoryValidationSupplied, false);
  assert.ok(data.rows.every((r) => gis.validCoordinates({ latitude: r[1], longitude: r[2] })));
});
