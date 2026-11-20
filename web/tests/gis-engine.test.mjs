import test from 'node:test';
import assert from 'node:assert/strict';
import * as gis from '../src/gis-engine.mjs';

test('distance uses kilometres and rejects invalid or numeric-string coordinates', () => {
  assert.ok(
    Math.abs(
      gis.distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111.195,
    ) < 0.01,
  );
  assert.equal(gis.distanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 1 }), null);
  assert.equal(
    gis.distanceKm({ latitude: '23', longitude: 90 }, { latitude: 23, longitude: 90 }),
    null,
  );
});

test('public functional status and recent assessment never become a drinking-water clearance', () => {
  const point = {
    id: 'W1',
    latitude: 23,
    longitude: 90,
    assessedAt: '2026-10-23',
    reportedStatus: 'Yes',
    provenance: 'published-inventory',
  };
  assert.equal(gis.waterPointEvidence(point, '2026-10-24').canRecommend, false);
  assert.equal(gis.waterPointEvidence(point, '2026-10-24').qualityStatus, 'not-verified');
  assert.equal(
    gis.waterPointEvidence({ ...point, assessedAt: '2019-01-01' }, '2026-10-24').assessmentState,
    'historical',
  );
  assert.equal(
    gis.waterPointEvidence({ ...point, assessedAt: null }, '2026-10-24').assessmentState,
    'unknown',
  );
  assert.equal(
    gis.waterPointEvidence({ ...point, assessedAt: '2099-01-01' }, '2026-10-24').assessmentState,
    'invalid',
  );
});

test('water search excludes synthetic and invalid points, filters and sorts on real distance', () => {
  const points = [
    {
      id: 'far',
      name: 'Cox station',
      district: 'Coxs Bazar',
      latitude: 23.1,
      longitude: 90,
      provenance: 'published-inventory',
    },
    {
      id: 'near',
      name: 'Cox station',
      district: 'Coxs Bazar',
      latitude: 23.01,
      longitude: 90,
      provenance: 'published-inventory',
    },
    { id: 'synthetic', name: 'Cox station', latitude: 23, longitude: 90, provenance: 'synthetic' },
    {
      id: 'invalid',
      name: 'Cox station',
      latitude: 123,
      longitude: 90,
      provenance: 'published-inventory',
    },
  ];
  const result = gis.findWaterPoints(points, {
    center: { latitude: 23, longitude: 90 },
    query: 'cox',
    radiusKm: 5,
    limit: 20,
  });
  assert.deepEqual(
    result.map((r) => r.id),
    ['near'],
  );
  assert.ok(result[0].distanceKm > 1 && result[0].distanceKm < 2);
  assert.throws(
    () => gis.findWaterPoints(points, { center: { latitude: 23, longitude: 90 }, radiusKm: -1 }),
    /radius/i,
  );
});

test('pollution priority uses measured partial objectives without declaring potability', () => {
  assert.equal(gis.measuredPriority({ ph: 7, do: 1, cod: 100 }).level, 'multiple-exceedances');
  assert.equal(gis.measuredPriority({ ph: 7, do: 6, cod: 10 }).level, 'within-tested-objectives');
  assert.equal(gis.measuredPriority({ ph: null, do: null, cod: null }).level, 'not-measured');
  assert.equal(gis.measuredPriority({ ph: 7, do: 6, cod: 10 }).safeToDrink, null);
});

test('Kaggle high classes are publisher context and missing classes stay unknown', () => {
  assert.equal(gis.contextClass('Very High').priority, true);
  assert.equal(gis.contextClass('#N/A').id, 'unknown');
  assert.equal(gis.contextClass('Low').safeToDrink, null);
});

test('nearby context is a distance filter, not an exposure footprint or safe zone', () => {
  const point = { latitude: 23, longitude: 90 };
  const rows = [
    { id: 'a', ...point },
    { id: 'b', latitude: 23.1, longitude: 90 },
  ];
  const result = gis.nearbyRecords(rows, point, 500);
  assert.deepEqual(
    result.records.map((r) => r.id),
    ['a'],
  );
  assert.equal(result.interpretation, 'investigation-proximity-only');
  assert.equal(result.affectedPeople, null);
});

test('conservation uses explicit measured volume and elapsed time with no invented savings', () => {
  assert.equal(gis.leakLossLitresPerDay(100, 60), 144);
  assert.equal(gis.leakLossLitresPerDay(0, 60), 0);
  assert.equal(gis.leakLossLitresPerDay(100, 0), null);
  assert.equal(gis.storagePlanLitres(4, 3, 15), 180);
  assert.equal(gis.storagePlanLitres(-1, 3, 15), null);
});
