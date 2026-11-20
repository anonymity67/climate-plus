import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRoutingEngine } from '../routing/engine.mjs';

function topology(rows) {
  const script = `import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('roads','scripts/build-road-graph.py')\nm=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(json.dumps(m.build_topology(json.load(sys.stdin))))`;
  return JSON.parse(
    execFileSync('python', ['-c', script], { input: JSON.stringify(rows), encoding: 'utf8' }),
  );
}
const road = (fid, coordinates, properties = {}) => ({
  fid,
  id: `way/${fid}`,
  highway: 'residential',
  oneway: null,
  bridge: null,
  layer: null,
  _geometry: { type: 'LineString', coordinates },
  ...properties,
});

test('builder joins shared vertices and retains full intervening road shape', () => {
  const graph = topology([
    road(1, [
      [89, 22],
      [89.0005, 22],
      [89.001, 22],
      [89.002, 22],
    ]),
    road(2, [
      [89.001, 22],
      [89.001, 22.001],
    ]),
  ]);
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.nodes.length, 4);
  const result = createRoutingEngine(graph).route({
    origin: { longitude: 89, latitude: 22 },
    destination: { longitude: 89.001, latitude: 22.001 },
  });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.routes[0].geometry.coordinates, [
    [89, 22],
    [89.0005, 22],
    [89.001, 22],
    [89.001, 22.001],
  ]);
});

test('builder preserves grade separation at interior shared vertices and un-noded crossings', () => {
  const graph = topology([
    road(1, [
      [89, 22],
      [89.001, 22],
      [89.002, 22],
    ]),
    road(
      2,
      [
        [89.001, 21.999],
        [89.001, 22],
        [89.001, 22.001],
      ],
      { bridge: 'yes', layer: '1' },
    ),
    road(3, [
      [89.0005, 21.999],
      [89.0005, 22.001],
    ]),
  ]);
  const engine = createRoutingEngine(graph);
  assert.equal(
    engine.route({
      origin: { longitude: 89, latitude: 22 },
      destination: { longitude: 89.001, latitude: 22.001 },
    }).status,
    'disconnected',
  );
  assert.equal(
    engine.route({
      origin: { longitude: 89, latitude: 22 },
      destination: { longitude: 89.0005, latitude: 22.001 },
    }).status,
    'disconnected',
  );
});

test('bridge endpoints connect to explicit adjoining road endpoints despite a layer transition', () => {
  const graph = topology([
    road(1, [
      [89, 22],
      [89.001, 22],
    ]),
    road(
      2,
      [
        [89.001, 22],
        [89.002, 22],
      ],
      { bridge: 'yes', layer: '1' },
    ),
  ]);
  assert.equal(graph.nodes.length, 3);
  const result = createRoutingEngine(graph).route({
    origin: { longitude: 89, latitude: 22 },
    destination: { longitude: 89.002, latitude: 22 },
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.routes[0].edges.length, 2);
});

test('a bridge endpoint can join a shared ground-road shape vertex, while bridge interiors stay separated', () => {
  const graph = topology([
    road(1, [
      [89, 22],
      [89.001, 22],
      [89.002, 22],
    ]),
    road(
      2,
      [
        [89.001, 22],
        [89.001, 22.001],
      ],
      { bridge: 'yes', layer: '-1' },
    ),
    road(
      3,
      [
        [89.0005, 22.0005],
        [89.001, 22.0005],
        [89.0015, 22.0005],
      ],
      { bridge: 'yes', layer: '1' },
    ),
    road(4, [
      [89.001, 22.0005],
      [89.002, 22.0005],
    ]),
  ]);
  const engine = createRoutingEngine(graph);
  assert.equal(
    engine.route({
      origin: { longitude: 89, latitude: 22 },
      destination: { longitude: 89.001, latitude: 22.001 },
    }).status,
    'ok',
  );
  assert.equal(
    engine.route({
      origin: { longitude: 89.0005, latitude: 22.0005 },
      destination: { longitude: 89.002, latitude: 22.0005 },
    }).status,
    'disconnected',
  );
});

test('actual Dacope export is reproducible and routes supplier to reserve with a real blockage detour', () => {
  const publicBytes = readFileSync(
    new URL('../public/data/dacope-road-graph.json', import.meta.url),
  );
  assert.deepEqual(
    publicBytes,
    readFileSync(new URL('../backend/data/dacope-road-graph.json', import.meta.url)),
  );
  const temporary = mkdtempSync(join(tmpdir(), 'climate-road-graph-'));
  try {
    execFileSync('python', ['scripts/build-road-graph.py', '--out', temporary]);
    assert.deepEqual(
      readFileSync(join(temporary, 'public/data/dacope-road-graph.json')),
      publicBytes,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const graph = JSON.parse(publicBytes);
  const digest = createHash('sha256')
    .update(readFileSync(new URL('../research/gis/v1/climate_gis.gpkg', import.meta.url)))
    .digest('hex');
  assert.equal(graph.metadata.sourceSha256, digest);
  assert.equal(graph.metadata.roadCount, 927);
  assert.ok(graph.metadata.roadComponentCount > 1);
  const engine = createRoutingEngine(graph);
  const origin = { longitude: 89.548391, latitude: 22.523947 },
    destination = { longitude: 89.505385, latitude: 22.555446 };
  const result = engine.route({ origin, destination });
  assert.equal(result.status, 'ok');
  assert.ok(result.routes[0].distanceM > 7000 && result.routes[0].distanceM < 10000);
  assert.ok(result.snap.origin.distanceM < 5 && result.snap.destination.distanceM < 5);
  assert.equal(result.routes.length, 2);
  const primary = result.routes[0],
    alternative = result.routes[1];
  const block = primary.edgeIds.find((id) => !alternative.edgeIds.includes(id));
  assert.ok(block, 'alternative must actually avoid a primary edge');
  const rerouted = engine.route({
    origin,
    destination,
    closures: [{ id: 'reported', edgeIds: [block] }],
  });
  assert.equal(rerouted.status, 'ok');
  assert.ok(rerouted.routes[0].distanceM > primary.distanceM);
  assert.ok(rerouted.routes.every((route) => !route.edgeIds.includes(block)));
  const blocked = engine.route({
    origin,
    destination,
    closures: [{ edgeIds: engine.metadata.edgeIds }],
  });
  assert.equal(blocked.status, 'disconnected');
  assert.deepEqual(blocked.routes, []);
});
