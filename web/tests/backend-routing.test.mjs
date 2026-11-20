import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createApi } from '../backend/api.mjs';
import { createSqliteStore } from '../backend/sqlite-store.mjs';
import { createRoutingEngine } from '../routing/engine.mjs';

test('real Dacope API closure reports reroute geometry, expire, and withhold off-graph GPS ETA', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
    const routing = createRoutingEngine(
      JSON.parse(
        readFileSync(new URL('../backend/data/dacope-road-graph.json', import.meta.url), 'utf8'),
      ),
    );
    let time = Date.parse('2026-10-24T06:00:00Z');
    const api = createApi({
      store: createSqliteStore(database),
      routing,
      catalogue: { assets: [] },
      clock: () => new Date(time),
    });
    const call = async (path, method = 'GET', input) => {
      const response = await api(
        new Request('https://climate.test/api' + path, {
          method,
          headers: { origin: 'https://climate.test', 'content-type': 'application/json' },
          body: input ? JSON.stringify(input) : undefined,
        }),
        { id: 'owner' },
      );
      const result = await response.json();
      assert.ok(response.status < 300, JSON.stringify(result));
      return result;
    };
    const trip = (
      await call('/trips', 'POST', {
        name: 'Dacope delivery',
        mode: 'operational',
        origin: {
          longitude: 89.548391,
          latitude: 22.523947,
          label: 'Supplier',
          provenance: 'Representational logistics preset',
        },
        destination: {
          longitude: 89.505385,
          latitude: 22.555446,
          label: 'Reserve',
          provenance: 'Representational logistics preset',
        },
      })
    ).trip;
    const before = await call(`/trips/${trip.id}/route`);
    assert.equal(before.status, 'ok');
    assert.equal(before.routes.length, 2);
    const excludedEdge = before.routes[0].edgeIds.find(
      (id) => !before.routes[1].edgeIds.includes(id),
    );
    await call(`/trips/${trip.id}/closures`, 'POST', {
      edgeIds: [excludedEdge],
      reason: 'Unverified member blockage report',
      expiresInMinutes: 1,
    });
    const after = await call(`/trips/${trip.id}/route`);
    assert.ok(after.routes[0].distanceM > before.routes[0].distanceM);
    assert.ok(after.routes.every((route) => !route.edgeIds.includes(excludedEdge)));
    time += 61000;
    assert.equal(
      (await call(`/trips/${trip.id}/route`)).routes[0].distanceM,
      before.routes[0].distanceM,
    );
    await call(`/trips/${trip.id}/fixes`, 'POST', {
      role: 'supplier',
      source: 'device',
      clientFixId: 'off-graph',
      latitude: 0,
      longitude: 0,
      accuracyM: 5,
      capturedAt: new Date(time).toISOString(),
    });
    const unavailable = await call(`/trips/${trip.id}/route`);
    assert.equal(unavailable.status, 'off_graph');
    assert.deepEqual(unavailable.routes, []);
    assert.equal(unavailable.selectedRouteId, null);
  } finally {
    database.close();
  }
});

test('public stateless scenario endpoint uses all five bundled scenarios without database access', async () => {
  const { routingPool, regionalCatalogue } = await import('../routing/registry.mjs');
  const { calculateScenario } = await import('../src/mvp/scenario-model.mjs');
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
    const databaseCalls = [];
    const api = createApi({
      store: new Proxy(createSqliteStore(database), {
        get(target, property) {
          if (typeof target[property] !== 'function') return target[property];
          return (...args) => {
            databaseCalls.push(property);
            return target[property](...args);
          };
        },
      }),
      routing: routingPool,
      catalogue: regionalCatalogue,
    });
    const call = async (input, headers = {}, path = '/scenario-route') => {
      const response = await api(
        new Request('https://climate.test/api' + path, {
          method: 'POST',
          headers: {
            origin: 'https://climate.test',
            'content-type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(input),
        }),
        null,
      );
      return { status: response.status, body: await response.json() };
    };
    for (const regionId of routingPool.regionIds) {
      const scenario = JSON.parse(
        readFileSync(
          new URL('../public/data/regions/' + regionId + '-scenario.json', import.meta.url),
          'utf8',
        ),
      );
      assert.equal(routingPool.scenarioForRegion(regionId).regionId, regionId);
      for (const [hazard, severity] of [
        ['clear', 'moderate'],
        ['storm', 'moderate'],
        ['storm', 'severe'],
        ['salinity', 'moderate'],
      ]) {
        const input = {
          regionId,
          hazard,
          severity,
          destinationRole: 'reserve',
          blockedEdgeIds: [],
        };
        const response = await call(input);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const expected = calculateScenario(routingPool.forRegion(regionId), scenario, input);
        assert.equal(response.body.calculation, 'server');
        assert.equal(response.body.regionId, regionId);
        assert.equal(response.body.hazard, hazard);
        assert.equal(response.body.sourceKind, 'representational');
        assert.equal(response.body.source.edgeIds, undefined);
        assert.deepEqual(response.body.routes, expected.routes);
        assert.deepEqual(response.body.activeHazard, expected.activeHazard);
        assert.deepEqual(response.body.heldAssetIds, expected.heldAssetIds);
      }
      const closure = scenario.closures.storm.moderate.edgeIds;
      const closed = await call({
        regionId,
        hazard: 'clear',
        destinationRole: 'reserve',
        blockedEdgeIds: closure,
      });
      assert.equal(closed.status, 200);
      assert.ok(
        closed.body.routes.every((route) =>
          route.edgeIds.every((edgeId) => !closure.includes(edgeId)),
        ),
      );
    }
    const input = { regionId: 'dacope', hazard: 'clear', destinationRole: 'reserve' };
    const foreignEdge = routingPool.forRegion('ukhia').metadata.edgeIds[0];
    for (const patch of [
      { regionId: 'unknown' },
      { regionId: null },
      { regionId: undefined },
      { hazard: 'tsunami' },
      { hazard: null },
      { hazard: undefined },
      { severity: 'extreme' },
      { severity: null },
      { destinationRole: 'unknown' },
      { destinationRole: undefined },
      { blockedEdgeIds: [foreignEdge] },
      { blockedEdgeIds: null },
      { blockedEdgeIds: new Array(101).fill(routingPool.metadata.edgeIds[0]) },
      { blockedEdgeIds: [5] },
      { ownerId: 'spoof' },
    ])
      assert.equal((await call({ ...input, ...patch })).status, 400, JSON.stringify(patch));
    assert.equal((await call(input, { origin: 'https://evil.test' })).status, 403);
    assert.equal((await call(input, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await call({ ...input, extra: 'x'.repeat(32768) })).status, 413);
    assert.deepEqual(databaseCalls, []);
    for (const table of [
      'trips',
      'fixes',
      'closures',
      'events',
      'memberships',
      'invites',
      'observations',
      'cases',
    ])
      assert.equal(database.prepare('SELECT count(*) AS n FROM ' + table).get().n, 0);
    assert.equal((await call(input, {}, '/trips')).status, 401);
    assert.equal((await call(input, {}, '/trips/private/replay')).status, 401);
  } finally {
    database.close();
  }
});

test('bundled five-region API catalogue, route, closure and replay match each actual regional graph', async () => {
  const { routingPool, regionalCatalogue } = await import('../routing/registry.mjs');
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
    const api = createApi({
      store: createSqliteStore(database),
      routing: routingPool,
      catalogue: regionalCatalogue,
    });
    const call = async (path, method = 'GET', input) => {
      const response = await api(
        new Request('https://climate.test/api' + path, {
          method,
          headers: { origin: 'https://climate.test', 'content-type': 'application/json' },
          body: input === undefined ? undefined : JSON.stringify(input),
        }),
        { id: 'owner' },
      );
      return { status: response.status, body: await response.json() };
    };
    const catalogue = (await call('/catalogue')).body;
    assert.deepEqual(
      catalogue.regions.map((region) => region.id),
      ['dacope', 'ukhia', 'chattogram', 'khulna', 'tongi'],
    );
    assert.equal(catalogue.routing.edgeIds, undefined);
    assert.ok(catalogue.assets.every((asset) => asset.regionId === 'dacope'));
    for (const region of catalogue.regions) {
      assert.ok(region.bounds && region.source && region.graphUrl && region.scenarioUrl);
      assert.ok(region.assets.every((asset) => asset.regionId === region.id));
      const origin = region.assets.find((asset) => asset.role === 'supplier');
      const destination = region.assets.find((asset) => asset.role === 'reserve');
      const engine = routingPool.forRegion(region.id);
      const direct = engine.route({ origin, destination });
      assert.equal(direct.status, 'ok', region.id);
      const created = await call('/trips', 'POST', {
        name: region.name + ' replay',
        mode: 'replay',
        regionId: region.id,
        origin: { ...origin, label: origin.name },
        destination: { ...destination, label: destination.name },
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const trip = created.body.trip;
      assert.equal(trip.regionId, region.id);
      const path = '/trips/' + trip.id;
      const route = await call(path + '/route');
      assert.equal(route.body.regionId, region.id);
      assert.equal(route.body.source.edgeIds, undefined);
      assert.deepEqual(route.body.routes[0].geometry, direct.routes[0].geometry);
      const expected = engine.pointAlongRoute(direct.routes[0], (25 / 3.6) * 10);
      const replay = await call(path + '/replay', 'POST', { advanceSeconds: 10 });
      assert.equal(replay.status, 200, JSON.stringify(replay.body));
      assert.deepEqual(replay.body.position, expected);
      const scenario = JSON.parse(
        readFileSync(
          new URL('../public/data/regions/' + region.id + '-scenario.json', import.meta.url),
          'utf8',
        ),
      );
      const edgeIds = scenario.closures.storm.moderate.edgeIds;
      const blocked = await call(path + '/closures', 'POST', {
        edgeIds,
        reason: 'Representational regional blockage',
        expiresInMinutes: 10,
      });
      assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
      const detour = await call(path + '/route');
      assert.equal(detour.body.status, 'ok', region.id);
      assert.notDeepEqual(detour.body.routes[0].geometry, route.body.routes[0].geometry);
      assert.ok(detour.body.routes[0].edgeIds.every((edgeId) => !edgeIds.includes(edgeId)));
      const otherRegionId = region.id === 'dacope' ? 'ukhia' : 'dacope';
      const foreignEdge = routingPool
        .forRegion(otherRegionId)
        .metadata.edgeIds.find((edgeId) => !engine.metadata.edgeIds.includes(edgeId));
      assert.ok(foreignEdge);
      assert.equal(
        (
          await call(path + '/closures', 'POST', {
            edgeIds: [foreignEdge],
            reason: 'Wrong region',
            expiresInMinutes: 10,
          })
        ).status,
        400,
      );
    }
    assert.equal(routingPool.forRegion('unknown'), undefined);
  } finally {
    database.close();
  }
});
