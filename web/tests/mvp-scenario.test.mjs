import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialScenarioState,
  scenarioReducer,
  calculateScenario,
  insidePolygon,
  enteredPointsCollection,
} from '../src/mvp/scenario-model.mjs';

test('entered-point export keeps every staged coordinate irrespective of visible region or layer', () => {
  const entries = [
    {
      feature: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [89.5, 22.5] },
        properties: { sourceKind: 'representational' },
      },
    },
    {
      feature: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [90.4, 23.9] },
        properties: { sourceKind: 'field-entry' },
      },
    },
  ];
  const exported = enteredPointsCollection(entries);
  assert.equal(exported.features.length, 2);
  assert.deepEqual(exported.features[1].geometry.coordinates, [90.4, 23.9]);
  assert.equal(exported.properties.scope, 'all-entered-observations');
  assert.equal(exported.properties.includesDeviceGPS, false);
});
const assets = [
  { id: 'u-supplier', role: 'supplier', latitude: 21.2, longitude: 92.1 },
  { id: 'u-reserve', role: 'reserve', latitude: 21.21, longitude: 92.12 },
  { id: 'u-pond', role: 'pond', latitude: 21.205, longitude: 92.105 },
];
const square = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [92.104, 21.204],
        [92.106, 21.204],
        [92.106, 21.206],
        [92.104, 21.206],
        [92.104, 21.204],
      ],
    ],
  },
  properties: { provenance: 'representational' },
};
const scenario = {
  regionId: 'ukhia',
  assets,
  hazards: { salinity: square, storm: { moderate: square } },
  closures: { storm: { moderate: { edgeIds: ['closed'] } } },
};
test('changing region clears prior closures, playback, hazard and route preference', () => {
  const old = {
    ...initialScenarioState('dacope'),
    hazard: 'storm',
    blockedEdgeIds: ['old-road'],
    playing: true,
    distanceM: 100,
    chosenRouteId: 'old-route',
  };
  const next = scenarioReducer(old, { type: 'REGION', regionId: 'ukhia' });
  assert.equal(next.regionId, 'ukhia');
  assert.equal(next.hazard, 'clear');
  assert.equal(next.playing, false);
  assert.equal(next.distanceM, 0);
  assert.deepEqual(next.blockedEdgeIds, []);
  assert.equal(next.chosenRouteId, null);
});
test('calamity routing uses local assets and actual declared graph exclusions without moving coordinates', () => {
  let input;
  const engine = {
    route: (params) => {
      input = params;
      return { status: 'ok', routes: [{ id: 'r', distanceM: 1000, durationS: 144 }], warnings: [] };
    },
  };
  const state = {
    ...initialScenarioState('ukhia'),
    hazard: 'storm',
    blockedEdgeIds: ['manual-road'],
  };
  const result = calculateScenario(engine, scenario, state);
  assert.deepEqual(input.origin, assets[0]);
  assert.deepEqual(input.destination, assets[1]);
  assert.equal(input.assumedSpeedKmh, 25);
  assert.deepEqual(input.closures[0].edgeIds, ['closed', 'manual-road']);
  assert.equal(result.status, 'ok');
  assert.equal(result.sourceKind, 'representational');
  assert.deepEqual(assets[0], scenario.assets[0]);
  assert.throws(
    () => calculateScenario(engine, scenario, initialScenarioState('khulna')),
    /region/i,
  );
});
test('salinity flags a scenario water point and does not fabricate a road blockage or potability claim', () => {
  let input;
  const r = calculateScenario(
    {
      route: (p) => {
        input = p;
        return { status: 'ok', routes: [] };
      },
    },
    scenario,
    { ...initialScenarioState('ukhia'), hazard: 'salinity' },
  );
  assert.deepEqual(input.closures, []);
  assert.deepEqual(r.heldAssetIds, ['u-pond']);
  assert.equal(r.waterSafety, 'unknown');
  assert.equal(insidePolygon(assets[2], square), true);
  assert.equal(insidePolygon(assets[0], square), false);
});
test('playback clamps at arrival and invalid elapsed input cannot create a device fix', () => {
  const state = { ...initialScenarioState('ukhia'), playing: true, distanceM: 900 };
  const arrived = scenarioReducer(state, { type: 'ADVANCE', deltaM: 200, totalM: 1000 });
  assert.equal(arrived.distanceM, 1000);
  assert.equal(arrived.playing, false);
  assert.equal(arrived.source, 'replay');
  assert.deepEqual(scenarioReducer(state, { type: 'ADVANCE', deltaM: NaN, totalM: 1000 }), state);
  assert.equal(scenarioReducer(state, { type: 'HAZARD', hazard: 'salinity' }).distanceM, 0);
});
