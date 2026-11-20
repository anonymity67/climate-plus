import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRoutingEngine } from '../routing/engine.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('five separate sourced regions have local scenario assets and real closure detours', () => {
  const index = read('../public/data/regions/index.json');
  assert.deepEqual(
    index.regions.map((r) => r.id),
    ['dacope', 'ukhia', 'chattogram', 'khulna', 'tongi'],
  );
  const hashes = new Set();
  for (const region of index.regions) {
    const graphPath = `../public/data/regions/${region.id}-graph.json`;
    const bytes = readFileSync(new URL(graphPath, import.meta.url));
    assert.deepEqual(
      bytes,
      readFileSync(new URL(`../backend/data/regions/${region.id}-graph.json`, import.meta.url)),
    );
    const graph = JSON.parse(bytes);
    hashes.add(graph.metadata.graphSha256);
    const scenario = read(`../public/data/regions/${region.id}-scenario.json`);
    const [west, south, east, north] = region.bounds;
    assert.equal(scenario.regionId, region.id);
    assert.deepEqual(
      new Set(scenario.assets.map((a) => a.role)),
      new Set(['supplier', 'reserve', 'pump', 'pond', 'school', 'crew']),
    );
    for (const asset of scenario.assets) {
      assert.ok(
        asset.longitude >= west &&
          asset.longitude <= east &&
          asset.latitude >= south &&
          asset.latitude <= north,
      );
      assert.equal(asset.provenance, 'representational');
      assert.ok(asset.sourceLabel);
    }
    const routing = createRoutingEngine(graph);
    const origin = scenario.assets.find((a) => a.role === 'supplier');
    const destination = scenario.assets.find((a) => a.role === 'reserve');
    const baseline = routing.route({ origin, destination });
    assert.equal(baseline.status, 'ok', `${region.id} baseline`);
    assert.equal(baseline.routes.length, 2, `${region.id} alternative`);
    assert.notDeepEqual(baseline.routes[0].edgeIds, baseline.routes[1].edgeIds);
    for (const severity of ['moderate', 'severe']) {
      const edgeIds = scenario.closures.storm[severity].edgeIds;
      assert.ok(edgeIds.length > 0);
      assert.ok(edgeIds.every((id) => graph.edges.some((e) => e.id === id)));
      const closed = routing.route({
        origin,
        destination,
        closures: edgeIds.map((id, i) => ({ id: `scenario-${i}`, edgeIds: [id] })),
      });
      assert.equal(closed.status, 'ok', `${region.id} ${severity} detour`);
      assert.notDeepEqual(
        closed.routes[0].edgeIds,
        baseline.routes[0].edgeIds,
        `${region.id} ${severity} changes actual path`,
      );
      assert.ok(closed.routes[0].edgeIds.every((id) => !edgeIds.includes(id)));
    }
  }
  assert.equal(hashes.size, 5);
});

test('new region roads retain frozen OSM source vertices, direction and extent', () => {
  const index = read('../public/data/regions/index.json');
  for (const region of index.regions.filter((r) => r.id !== 'dacope')) {
    const base = `../research/gis/regions-v3/${region.id}/`;
    const source = read(base + 'source.json');
    const rawBytes = readFileSync(new URL(base + source.responseFile, import.meta.url));
    assert.equal(createHash('sha256').update(rawBytes).digest('hex'), source.sourceSha256);
    assert.equal(
      createHash('sha256')
        .update(readFileSync(new URL(base + source.queryFile, import.meta.url)))
        .digest('hex'),
      source.querySha256,
    );
    assert.equal(source.httpStatus, 200);
    assert.match(source.endpoint, /^https:\/\/(?:lz4\.|z\.)?overpass-api\.de\/api\/interpreter$/);
    assert.ok(source.acquiredAt && source.osmBaseTimestamp && source.licence.includes('ODbL'));
    const ways = new Map(JSON.parse(rawBytes).elements.map((w) => [`way/${w.id}`, w]));
    const graph = read(`../public/data/regions/${region.id}-graph.json`);
    const [west, south, east, north] = region.bounds;
    for (const edge of graph.edges) {
      const way = ways.get(edge.sourceId);
      assert.ok(way, `real source way ${edge.sourceId}`);
      const vertices = new Set(
        way.geometry.map((p) => `${Number(p.lon.toFixed(8))},${Number(p.lat.toFixed(8))}`),
      );
      for (const [x, y] of edge.coordinates) {
        assert.ok(vertices.has(`${x},${y}`), 'unaltered original source coordinate');
        assert.ok(x >= west && x <= east && y >= south && y <= north);
      }
      const direction = way.tags.oneway ?? (way.tags.junction === 'roundabout' ? 'yes' : '');
      assert.equal(edge.bidirectional, !['yes', '1', 'true', '-1'].includes(direction));
      assert.ok(!['no', 'private'].includes(way.tags.access));
    }
    const routing = createRoutingEngine(graph);
    const scenario = read(`../public/data/regions/${region.id}-scenario.json`);
    const origin = scenario.assets.find((a) => a.role === 'supplier');
    const destination = scenario.assets.find((a) => a.role === 'reserve');
    // Engine bounds each closure to 2000 IDs; split the largest graph explicitly.
    const bounded = routing.route({
      origin,
      destination,
      closures: Array.from({ length: Math.ceil(graph.edges.length / 2000) }, (_, i) => ({
        edgeIds: graph.edges.slice(i * 2000, (i + 1) * 2000).map((e) => e.id),
      })),
    });
    assert.equal(bounded.status, 'disconnected');
    assert.deepEqual(bounded.routes, []);
  }
});

test('Dacope preserves the original Antar point coordinates and hazard polygon vertices', () => {
  const original = read('../research/gis/antar-v2/gis-network.json');
  const rawFeatures = read('../research/gis/antar-v2/gis-network.geojson').features;
  const scenario = read('../public/data/regions/dacope-scenario.json');
  for (const point of original.nodes) {
    const asset = scenario.assets.find((a) => a.id === point.id);
    assert.equal(asset.longitude, point.lon);
    assert.equal(asset.latitude, point.lat);
  }
  for (const [id, feature] of [
    ['storm-1', scenario.hazards.storm.moderate],
    ['storm-3', scenario.hazards.storm.severe],
    ['salinity-1', scenario.hazards.salinity],
  ]) {
    assert.deepEqual(feature.geometry, rawFeatures.find((f) => f.properties.id === id).geometry);
    assert.equal(feature.properties.provenance, 'representational');
  }
});
