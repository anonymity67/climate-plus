import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingEngine } from '../routing/engine.mjs';

const point = (longitude, latitude = 22) => ({ latitude, longitude });
const A = point(89),
  B = point(89.001),
  C = point(89.002),
  D = point(89.001, 22.001);
function fixture() {
  const locations = { a: A, b: B, c: C, d: D, x: point(89.01), y: point(89.011) };
  const edge = (id, from, to, lengthM, highway = 'residential') => ({
    id,
    from,
    to,
    lengthM,
    highway,
    name: id,
    bidirectional: true,
    coordinates: [locations[from], locations[to]].map((p) => [p.longitude, p.latitude]),
  });
  return {
    schema: 'climate-plus/road-graph-v1',
    metadata: { graphVersion: 'test', maxSnapDistanceM: 250, sourceSha256: 'fixture' },
    nodes: Object.entries(locations).map(([id, p]) => ({
      id,
      coordinates: [p.longitude, p.latitude],
    })),
    edges: [
      edge('ab', 'a', 'b', 100),
      edge('bc', 'b', 'c', 100),
      edge('ad', 'a', 'd', 160),
      edge('dc', 'd', 'c', 160),
      edge('xy', 'x', 'y', 100),
    ],
  };
}

test('shortest route and a distinct connected alternative retain real ordered geometry', () => {
  const engine = createRoutingEngine(fixture());
  const result = engine.route({ origin: A, destination: C, assumedSpeedKmh: 20 });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.routes[0].edgeIds, ['ab', 'bc']);
  assert.equal(result.routes[0].distanceM, 200);
  assert.equal(result.routes[0].durationS, 36);
  assert.deepEqual(result.routes[0].geometry.coordinates, [
    [89, 22],
    [89.001, 22],
    [89.002, 22],
  ]);
  assert.deepEqual(result.routes[1].edgeIds, ['ad', 'dc']);
  assert.equal(result.routes[1].distanceM, 320);
  assert.deepEqual(engine.route({ origin: C, destination: A }).routes[0].edgeIds, ['bc', 'ab']);
  assert.deepEqual(engine.metadata.edgeIds, ['ab', 'ad', 'bc', 'dc', 'xy']);
});

test('closures exclude both directions, and a blocked network never returns a straight line', () => {
  const engine = createRoutingEngine(fixture());
  const result = engine.route({
    origin: A,
    destination: C,
    closures: [{ id: 'block', edgeIds: ['bc'] }],
  });
  assert.deepEqual(result.excludedEdgeIds, ['bc']);
  assert.deepEqual(result.routes[0].edgeIds, ['ad', 'dc']);
  assert.equal(result.routes.length, 1);
  assert.ok(result.warnings.some((w) => /alternative/i.test(w)));
  assert.deepEqual(
    engine.route({ origin: C, destination: A, closures: [{ edgeIds: ['bc'] }] }).routes[0].edgeIds,
    ['dc', 'ad'],
  );
  const blocked = engine.route({
    origin: A,
    destination: C,
    closures: [{ edgeIds: ['ab', 'ad'] }],
  });
  assert.equal(blocked.status, 'disconnected');
  assert.deepEqual(blocked.routes, []);
});

test('snap to an edge interior clips road geometry and excludes access gaps from ETA', () => {
  const engine = createRoutingEngine(fixture());
  const result = engine.route({
    origin: point(89.0002, 22.00001),
    destination: point(89.0008),
    assumedSpeedKmh: 20,
  });
  assert.equal(result.status, 'ok');
  assert.ok(Math.abs(result.routes[0].distanceM - 60) < 0.05);
  assert.ok(Math.abs(result.routes[0].durationS - 10.8) < 0.02);
  assert.ok(result.snap.origin.distanceM > 1 && result.snap.origin.distanceM < 2);
  assert.ok(Math.abs(result.routes[0].geometry.coordinates[0][0] - 89.0002) < 1e-8);
  assert.ok(Math.abs(result.routes[0].geometry.coordinates.at(-1)[0] - 89.0008) < 1e-8);
  const p = engine.pointAlongRoute(result.routes[0], 30);
  assert.ok(Math.abs(p.longitude - 89.0005) < 1e-6);
  assert.ok(Math.abs(p.heading - 90) < 1);
  assert.equal(engine.pointAlongRoute(null, 0), null);
});

test('point-radius and polygon closures catch edge interiors, not only stored vertices', () => {
  const engine = createRoutingEngine(fixture());
  const radius = engine.route({
    origin: A,
    destination: C,
    closures: [{ latitude: 22, longitude: 89.0015, radiusM: 10 }],
  });
  assert.ok(radius.excludedEdgeIds.includes('bc'));
  assert.deepEqual(radius.routes[0].edgeIds, ['ad', 'dc']);
  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [89.0014, 21.9999],
        [89.0016, 21.9999],
        [89.0016, 22.0001],
        [89.0014, 22.0001],
        [89.0014, 21.9999],
      ],
    ],
  };
  const result = engine.route({ origin: A, destination: C, closures: [{ geometry: polygon }] });
  assert.deepEqual(result.excludedEdgeIds, ['bc']);
});

test('unsupported roads are excluded from the vehicle road profile', () => {
  const graph = fixture();
  graph.edges.find((e) => e.id === 'bc').highway = 'footway';
  const result = createRoutingEngine(graph).route({ origin: A, destination: C });
  assert.deepEqual(result.routes[0].edgeIds, ['ad', 'dc']);
  assert.ok(result.warnings.some((w) => /footway|footpath/i.test(w)));
});

test('invalid coordinates, speeds, profiles and malformed closures are rejected', () => {
  const engine = createRoutingEngine(fixture());
  for (const extra of [
    { origin: null },
    { origin: point(NaN) },
    { origin: point(181) },
    { destination: { latitude: '22', longitude: 89 } },
    { assumedSpeedKmh: 0 },
    { assumedSpeedKmh: Infinity },
    { assumedSpeedKmh: 150 },
    { profile: 'flying' },
    { closures: [{ radiusM: -1, latitude: 22, longitude: 89 }] },
  ]) {
    assert.equal(engine.route({ origin: A, destination: C, ...extra }).status, 'invalid_input');
  }
  assert.equal(engine.route({ origin: A, destination: point(90) }).status, 'off_graph');
  assert.equal(engine.route({ origin: A, destination: point(89.011) }).status, 'disconnected');
  assert.equal(
    createRoutingEngine({ nodes: [], edges: [] }).route({ origin: A, destination: C }).status,
    'unsupported_graph',
  );
});

test('parallel edges remain independently routable and alternatives are stable', () => {
  const graph = fixture();
  graph.edges = [graph.edges[0], { ...graph.edges[0], id: 'parallel', lengthM: 120 }];
  const engine = createRoutingEngine(graph);
  const a = engine.route({ origin: A, destination: B });
  assert.equal(a.routes.length, 2);
  assert.notEqual(a.routes[0].id, a.routes[1].id);
  assert.equal(a.routes[1].id, engine.route({ origin: A, destination: B }).routes[1].id);
});

test('road-type speed caps change ETA without changing the distance objective', () => {
  const graph = fixture();
  graph.edges.find((e) => e.id === 'ab').highway = 'service';
  graph.edges.find((e) => e.id === 'bc').highway = 'living_street';
  const route = createRoutingEngine(graph).route({
    origin: A,
    destination: C,
    assumedSpeedKmh: 100,
  }).routes[0];
  assert.deepEqual(route.edgeIds, ['ab', 'bc']);
  assert.equal(route.distanceM, 200);
  assert.equal(route.durationS, 60);
});

test('unverified snap gaps above 50m warn and blocked nearest edges never snap to a farther road', () => {
  const engine = createRoutingEngine(fixture());
  const result = engine.route({ origin: point(88.9994), destination: C });
  assert.equal(result.status, 'ok');
  assert.ok(result.snap.origin.distanceM > 50);
  assert.ok(result.warnings.some((w) => /canals/.test(w)));
  const blocked = engine.route({
    origin: point(89.0005),
    destination: C,
    closures: [{ edgeIds: ['ab'] }],
  });
  assert.equal(blocked.status, 'disconnected');
  assert.equal(blocked.snap.origin.edgeId, 'ab');
  assert.equal(blocked.routes.length, 0);
});

test('a long distinct alternative is found when a fourfold primary penalty is insufficient', () => {
  const graph = fixture();
  graph.edges.find((e) => e.id === 'ad').lengthM = 1000;
  graph.edges.find((e) => e.id === 'dc').lengthM = 1000;
  const result = createRoutingEngine(graph).route({ origin: A, destination: C });
  assert.equal(result.routes.length, 2);
  assert.deepEqual(result.routes[1].edgeIds, ['ad', 'dc']);
  assert.equal(result.routes[1].distanceM, 2000);
});

test('one-way arcs and malformed graphs never become bidirectional fallback paths', () => {
  const graph = fixture();
  graph.edges = graph.edges.slice(0, 2).map((e) => ({ ...e, bidirectional: false }));
  const engine = createRoutingEngine(graph);
  assert.equal(engine.route({ origin: A, destination: C }).status, 'ok');
  assert.equal(engine.route({ origin: C, destination: A }).status, 'disconnected');
  const malformed = fixture();
  malformed.edges[0].to = 'unknown';
  assert.equal(
    createRoutingEngine(malformed).route({ origin: A, destination: C }).status,
    'unsupported_graph',
  );
});

test('malformed polygon, graph snap bounds and interpolation lengths are rejected', () => {
  const engine = createRoutingEngine(fixture());
  assert.equal(
    engine.route({
      origin: A,
      destination: C,
      closures: [{ edgeIds: ['ab'], geometry: { type: 'MultiPolygon', coordinates: null } }],
    }).status,
    'invalid_input',
  );
  const graph = fixture();
  graph.metadata.maxSnapDistanceM = NaN;
  assert.equal(
    createRoutingEngine(graph).route({ origin: A, destination: C }).status,
    'unsupported_graph',
  );
  assert.equal(
    engine.pointAlongRoute(
      {
        geometry: {
          coordinates: [
            [89, 22],
            [89.001, 22],
          ],
        },
      },
      10,
    ),
    null,
  );
});

test('combined polygon complexity is bounded before spatial intersection work', () => {
  const ring = Array.from({ length: 4000 }, (_, i) => [
    80 + 0.001 * Math.cos((i * Math.PI) / 2000),
    20 + 0.001 * Math.sin((i * Math.PI) / 2000),
  ]);
  ring.push(ring[0]);
  const closure = { geometry: { type: 'Polygon', coordinates: [ring] } };
  const result = createRoutingEngine(fixture()).route({
    origin: A,
    destination: C,
    closures: [closure, closure, closure],
  });
  assert.equal(result.status, 'invalid_input');
});

test('position interpolation follows bends, clamps to endpoints and rejects malformed route shapes', () => {
  const graph = fixture();
  graph.edges = [
    {
      ...graph.edges[0],
      coordinates: [
        [89, 22],
        [89, 22.001],
        [89.001, 22],
      ],
      lengthM: 300,
    },
  ];
  const engine = createRoutingEngine(graph),
    result = engine.route({ origin: A, destination: B }).routes[0];
  assert.deepEqual(
    { ...engine.pointAlongRoute(result, -10), heading: 0 },
    { latitude: 22, longitude: 89, heading: 0 },
  );
  assert.ok(Math.abs(engine.pointAlongRoute(result, 301).longitude - 89.001) < 1e-8);
  assert.ok(engine.pointAlongRoute(result, 100).latitude > 22.0005);
  assert.equal(
    engine.pointAlongRoute(
      {
        geometry: {
          coordinates: [
            [NaN, 22],
            [89, 22],
          ],
        },
      },
      10,
    ),
    null,
  );
});
