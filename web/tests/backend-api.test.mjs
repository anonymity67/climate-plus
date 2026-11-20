import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const owner = { id: 'owner', displayName: 'Field operator' },
  other = { id: 'other' };
const endpoint = (longitude) => ({
  latitude: 22.5,
  longitude,
  label: 'Declared endpoint',
  provenance: 'representational preset',
});
const tripInput = {
  name: 'Delivery',
  mode: 'operational',
  origin: endpoint(89.4),
  destination: endpoint(89.5),
};
const routing = {
  metadata: { edgeIds: ['a', 'b'], graphVersion: 'test', limitations: ['fixture'] },
  route({ origin, closures }) {
    const blocked = closures.some((c) => c.edgeIds?.includes('a'));
    return {
      status: 'ok',
      routes: [
        {
          id: blocked ? 'alternative' : 'primary',
          distanceM: blocked ? 2000 : 1000,
          durationS: 144,
          edgeIds: [blocked ? 'b' : 'a'],
          geometry: {
            type: 'LineString',
            coordinates: [
              [origin.longitude, origin.latitude],
              [89.5, 22.5],
            ],
          },
          edges: [],
        },
      ],
      snap: {},
      excludedEdgeIds: blocked ? ['a'] : [],
      source: this.metadata,
      warnings: [],
    };
  },
  pointAlongRoute(_route, distanceM) {
    return { latitude: 22.5, longitude: 89.4 + distanceM / 100000, heading: 90 };
  },
};
async function setup(t, filename = ':memory:', selectedRouting = routing) {
  const { createApi } = await import('../backend/api.mjs');
  const { createSqliteStore } = await import('../backend/sqlite-store.mjs');
  const db = new DatabaseSync(filename);
  db.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  let now = Date.parse('2026-10-24T06:00:00.000Z');
  const store = createSqliteStore(db);
  const api = createApi({
    store,
    routing: selectedRouting,
    catalogue: { assets: [] },
    clock: () => new Date(now),
  });
  const call = async (path, method = 'GET', body, actor = owner, headers = {}) => {
    const response = await api(
      new Request('https://climate.test/api' + path, {
        method,
        headers: {
          ...(!['GET', 'HEAD'].includes(method) ? { origin: 'https://climate.test' } : {}),
          ...(body !== undefined
            ? { 'content-type': 'application/json', origin: 'https://climate.test' }
            : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      actor,
    );
    return { status: response.status, body: await response.json() };
  };
  const create = async (input = tripInput) => {
    const result = await call('/trips', 'POST', input);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body.trip;
  };
  const fix = (extra = {}) => ({
    role: 'supplier',
    source: 'device',
    clientFixId: crypto.randomUUID(),
    latitude: 22.5,
    longitude: 89.41,
    accuracyM: 5,
    capturedAt: new Date(now).toISOString(),
    ...extra,
  });
  return { db, store, api, call, create, fix, advance: (ms) => (now += ms) };
}

test('region-bound trips route, close edges and replay only in their selected engine', async (t) => {
  const calls = [];
  const regional = {
    ...routing,
    metadata: { edgeIds: ['ukhia-edge'], graphVersion: 'ukhia-fixture' },
    route(input) {
      calls.push(input);
      return { ...routing.route(input), source: this.metadata };
    },
    pointAlongRoute() {
      return { latitude: 21.22, longitude: 92.1, heading: 10 };
    },
  };
  const pool = {
    metadata: routing.metadata,
    regionIds: ['dacope', 'ukhia'],
    forRegion: (regionId) => ({ dacope: routing, ukhia: regional })[regionId],
  };
  const s = await setup(t, ':memory:', pool);
  const legacy = await s.create();
  assert.equal(legacy.regionId, 'dacope');
  const trip = await s.create({ ...tripInput, mode: 'replay', regionId: 'ukhia' });
  assert.equal(trip.regionId, 'ukhia');
  assert.equal((await s.call('/trips/' + trip.id)).body.trip.regionId, 'ukhia');
  const route = await s.call(`/trips/${trip.id}/route`);
  assert.equal(route.status, 200);
  assert.equal(route.body.source.graphVersion, 'ukhia-fixture');
  assert.equal(route.body.source.edgeIds, undefined);
  assert.equal(route.body.regionId, 'ukhia');
  const closure = { edgeIds: ['a'], reason: 'Region isolation test', expiresInMinutes: 10 };
  assert.equal((await s.call(`/trips/${trip.id}/closures`, 'POST', closure)).status, 400);
  assert.equal(
    (await s.call(`/trips/${legacy.id}/closures`, 'POST', { ...closure, edgeIds: ['ukhia-edge'] }))
      .status,
    400,
  );
  assert.equal(
    (await s.call(`/trips/${trip.id}/closures`, 'POST', { ...closure, edgeIds: ['ukhia-edge'] }))
      .status,
    201,
  );
  await s.call(`/trips/${trip.id}/route`);
  assert.deepEqual(calls.at(-1).closures[0].edgeIds, ['ukhia-edge']);
  const replay = await s.call(`/trips/${trip.id}/replay`, 'POST', { advanceSeconds: 10 });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.position.latitude, 21.22);
  for (const regionId of ['unknown', '', null, 4]) {
    const invalid = await s.call('/trips', 'POST', { ...tripInput, regionId });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'invalid_region');
  }
  assert.equal((await s.call('/health')).body.release, '4.0.0');
  assert.equal((await s.call('/catalogue')).body.routing.edgeIds, undefined);
});

test('persistent trips isolate unknown users and reject client owner IDs and cross-origin writes', async (t) => {
  const s = await setup(t);
  const trip = await s.create();
  assert.equal((await s.call('/trips/' + trip.id, 'GET', undefined, other)).status, 404);
  assert.deepEqual((await s.call('/trips', 'GET', undefined, other)).body.trips, []);
  assert.equal((await s.call('/trips', 'POST', { ...tripInput, ownerId: 'other' })).status, 400);
  assert.equal(
    (await s.call('/trips', 'POST', tripInput, owner, { origin: 'https://evil.test' })).status,
    403,
  );
  assert.equal((await s.call('/me', 'GET', undefined, null)).status, 401);
  assert.equal((await s.call('/health', 'GET', undefined, null)).status, 200);
  const client2 = createSecondClient(s);
  assert.equal((await client2(trip.id)).trip.id, trip.id);
});
function createSecondClient(s) {
  return async (id) =>
    (await s.api(new Request('https://climate.test/api/trips/' + id), owner)).json();
}

test('a stale client case revision cannot overwrite a newer operator decision', async (t) => {
  const s = await setup(t);
  const observation = await s.call('/observations', 'POST', {
    date: '2026-10-20',
    latitude: 22.57,
    longitude: 89.51,
    ph: 7,
    metadata: { sourceKind: 'representational', sourceLabel: 'Revision test fixture' },
  });
  assert.equal(observation.status, 201);
  const created = await s.call('/cases', 'POST', {
    title: 'Sampling follow-up',
    observationId: observation.body.observation.id,
  });
  const path = '/cases/' + created.body.case.id,
    revision = created.body.case.revision;
  assert.equal(
    (
      await s.call(path, 'PATCH', {
        status: 'sampling',
        note: 'New decision',
        expectedRevision: revision,
      })
    ).status,
    200,
  );
  const stale = await s.call(path, 'PATCH', {
    status: 'closed',
    note: 'Outdated browser form',
    expectedRevision: revision,
  });
  assert.equal(stale.status, 409);
  assert.equal((await s.call('/cases')).body.cases[0].status, 'sampling');
  const cleared = await s.call(path, 'PATCH', {
    status: 'sampling',
    note: null,
    expectedRevision: revision + 1,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.case.note, null);
});

test('single-use expiring hashed invites restrict role and expose updates across clients', async (t) => {
  const s = await setup(t),
    trip = await s.create();
  const invite = await s.call(`/trips/${trip.id}/invites`, 'POST', {
    role: 'recipient',
    expiresInMinutes: 10,
  });
  assert.equal(invite.status, 201);
  const token = invite.body.token;
  assert.ok(
    !(await s.store.all('SELECT * FROM invites')).some((row) => Object.values(row).includes(token)),
  );
  assert.equal((await s.call('/invites/accept', 'POST', { token }, other)).status, 200);
  assert.equal((await s.call('/invites/accept', 'POST', { token }, { id: 'third' })).status, 409);
  assert.equal((await s.call(`/trips/${trip.id}/fixes`, 'POST', s.fix(), other)).status, 403);
  assert.equal(
    (await s.call(`/trips/${trip.id}/fixes`, 'POST', s.fix({ role: 'recipient' }), other)).status,
    201,
  );
  assert.equal((await s.call(`/trips/${trip.id}`)).body.latestFixes[0].role, 'recipient');
  const expired = (
    await s.call(`/trips/${trip.id}/invites`, 'POST', { role: 'viewer', expiresInMinutes: 1 })
  ).body.token;
  s.advance(61000);
  assert.equal(
    (await s.call('/invites/accept', 'POST', { token: expired }, { id: 'late' })).status,
    409,
  );
});

test('GPS rejects stale, future, malformed and nonmonotonic input; retries are idempotent', async (t) => {
  const s = await setup(t),
    trip = await s.create(),
    path = `/trips/${trip.id}/fixes`;
  for (const extra of [
    { accuracyM: -1 },
    { latitude: 91 },
    { speedMps: -1 },
    { source: 'replay' },
    { capturedAt: '2026-10-24T05:00:00Z' },
    { capturedAt: '2026-10-24T07:00:00Z' },
    { heading: 360 },
  ])
    assert.equal((await s.call(path, 'POST', s.fix(extra))).status, 400);
  const first = s.fix();
  assert.equal((await s.call(path, 'POST', first)).status, 201);
  assert.equal((await s.call(path, 'POST', first)).status, 200);
  assert.equal(
    (await s.call(path, 'POST', s.fix({ capturedAt: '2026-10-24T05:59:59Z' }))).status,
    409,
  );
  const fresh = (await s.call(`/trips/${trip.id}/route`)).body;
  assert.equal(fresh.positionUse.supplier.used, true);
  s.advance(31000);
  const stale = (await s.call(`/trips/${trip.id}/route`)).body;
  assert.equal(stale.positionUse.supplier.used, false);
  assert.equal(stale.positionUse.supplier.reason, 'stale');
  assert.equal((await s.call(path, 'POST', s.fix({ accuracyM: 300 }))).status, 201);
  assert.equal(
    (await s.call(`/trips/${trip.id}/route`)).body.positionUse.supplier.reason,
    'poor-accuracy',
  );
  assert.equal((await s.call(path + '/supplier', 'DELETE')).status, 200);
  assert.equal((await s.call(`/trips/${trip.id}`)).body.latestFixes.length, 0);
  const audit = await s.store.all("SELECT payload_json FROM events WHERE type='gps.deleted'");
  assert.ok(!JSON.stringify(audit).includes('89.41'));
});

test('closures change the selected route, expire and can be revoked only in their trip', async (t) => {
  const s = await setup(t),
    trip = await s.create(),
    second = await s.create();
  assert.equal(
    (await s.call(`/trips/${trip.id}/preference`, 'POST', { routeId: 'nonexistent' })).status,
    409,
  );
  assert.equal(
    (await s.call(`/trips/${trip.id}/preference`, 'POST', { routeId: 'primary' })).status,
    200,
  );
  const result = await s.call(`/trips/${trip.id}/closures`, 'POST', {
    edgeIds: ['a'],
    reason: 'Bridge reported blocked',
    expiresInMinutes: 1,
  });
  assert.equal(result.status, 201);
  assert.equal((await s.call(`/trips/${trip.id}/route`)).body.selectedRouteId, 'alternative');
  assert.equal(
    (await s.call(`/trips/${second.id}/closures/${result.body.closure.id}`, 'DELETE')).status,
    404,
  );
  s.advance(61000);
  assert.equal((await s.call(`/trips/${trip.id}/route`)).body.selectedRouteId, 'primary');
  assert.equal(
    (await s.call(`/trips/${trip.id}/closures/${result.body.closure.id}`, 'DELETE')).status,
    200,
  );
});

test('replay persists labelled positions and cannot write device telemetry', async (t) => {
  const s = await setup(t),
    trip = await s.create({ ...tripInput, mode: 'replay' });
  assert.equal((await s.call(`/trips/${trip.id}/fixes`, 'POST', s.fix())).status, 409);
  const response = await s.call(`/trips/${trip.id}/replay`, 'POST', { advanceSeconds: 20 });
  assert.equal(response.status, 200);
  assert.equal((await s.call(`/trips/${trip.id}`)).body.latestFixes[0].source, 'replay');
  assert.equal((await s.call(`/trips/${trip.id}/route`)).body.positionUse.supplier.used, false);
});

test('immutable observations preserve provenance, case links and private exports', async (t) => {
  const s = await setup(t);
  const observation = {
    date: '2026-10-23',
    latitude: 22.5,
    longitude: 89.4,
    do: 3,
    units: { do: 'mg/L' },
    metadata: { sourceKind: 'field-entry', sourceLabel: 'Handheld meter log', method: 'Probe' },
  };
  assert.equal((await s.call('/observations', 'POST', { ...observation, units: {} })).status, 400);
  const result = await s.call('/observations', 'POST', observation);
  assert.equal(result.status, 201);
  assert.match(result.body.observation.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(
    (
      await s.call(
        '/cases',
        'POST',
        { title: 'Review DO', observationId: result.body.observation.id },
        other,
      )
    ).status,
    404,
  );
  const c = await s.call('/cases', 'POST', {
    title: 'Review DO',
    observationId: result.body.observation.id,
  });
  assert.equal(c.status, 201);
  assert.equal(
    (
      await s.call('/cases/' + c.body.case.id, 'PATCH', {
        status: 'reviewed',
        note: 'Operator review only',
      })
    ).status,
    200,
  );
  assert.equal(
    (await s.call('/cases/' + c.body.case.id, 'PATCH', { status: 'closed' }, other)).status,
    404,
  );
  assert.deepEqual((await s.call('/export', 'GET', undefined, other)).body.observations, []);
  const exported = (await s.call('/export')).body;
  assert.equal(exported.observations.length, 1);
  assert.equal(exported.cases[0].status, 'reviewed');
  assert.ok(exported.events.some((e) => e.type === 'case.updated'));
});

test('fix retention is bounded per role and hides positions after 24 hours', async (t) => {
  const s = await setup(t),
    trip = await s.create();
  for (let i = 0; i < 105; i++) {
    s.advance(1000);
    assert.equal((await s.call(`/trips/${trip.id}/fixes`, 'POST', s.fix())).status, 201);
  }
  assert.equal((await s.store.get('SELECT count(*) AS n FROM fixes')).n, 100);
  s.advance(86400001);
  assert.deepEqual((await s.call(`/trips/${trip.id}`)).body.latestFixes, []);
  assert.equal((await s.store.get('SELECT count(*) AS n FROM fixes')).n, 100);
  assert.equal((await s.call(`/trips/${trip.id}/fixes/supplier`, 'DELETE')).status, 200);
  assert.equal((await s.store.get('SELECT count(*) AS n FROM fixes')).n, 0);
});

test('stopping GPS rejects delayed older uploads and permits a newly captured fix', async (t) => {
  const s = await setup(t),
    trip = await s.create(),
    path = `/trips/${trip.id}/fixes`;
  const queued = s.fix();
  s.advance(5000);
  assert.equal((await s.call(path + '/supplier', 'DELETE')).status, 200);
  assert.equal((await s.call(path, 'POST', queued)).status, 409);
  assert.deepEqual((await s.call(`/trips/${trip.id}`)).body.latestFixes, []);
  s.advance(1000);
  assert.equal((await s.call(path, 'POST', s.fix())).status, 201);
});

test('concurrent invite consumption gives membership to exactly one actor', async (t) => {
  const s = await setup(t),
    trip = await s.create();
  const { token } = (
    await s.call(`/trips/${trip.id}/invites`, 'POST', { role: 'supplier', expiresInMinutes: 2 })
  ).body;
  const responses = await Promise.all(
    ['one', 'two'].map((id) => s.call('/invites/accept', 'POST', { token }, { id })),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (
      await s.store.get(
        "SELECT count(*) AS n FROM memberships WHERE trip_id=? AND role='supplier'",
        [trip.id],
      )
    ).n,
    1,
  );
});

test('body limits, strict timestamps and unknown closure edges produce bounded errors', async (t) => {
  const s = await setup(t),
    trip = await s.create();
  assert.equal(
    (await s.call('/trips', 'POST', { ...tripInput, name: 'x'.repeat(33000) })).status,
    413,
  );
  assert.equal(
    (await s.call(`/trips/${trip.id}/fixes`, 'POST', s.fix({ capturedAt: '2026-02-30T06:00:00Z' })))
      .status,
    400,
  );
  assert.equal(
    (
      await s.call(`/trips/${trip.id}/closures`, 'POST', {
        edgeIds: ['unknown'],
        reason: 'Test',
        expiresInMinutes: 2,
      })
    ).status,
    400,
  );
});

test('concurrent identical device uploads remain idempotent', async (t) => {
  const s = await setup(t),
    trip = await s.create(),
    fix = s.fix();
  const results = await Promise.all([
    s.call(`/trips/${trip.id}/fixes`, 'POST', fix),
    s.call(`/trips/${trip.id}/fixes`, 'POST', fix),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  assert.equal((await s.store.get('SELECT count(*) AS n FROM fixes')).n, 1);
  assert.equal(
    (await s.store.get("SELECT count(*) AS n FROM events WHERE type='gps.received'")).n,
    1,
  );
});

test('concurrent replay advancement never inserts a position for a failed revision update', async (t) => {
  const s = await setup(t),
    trip = await s.create({ ...tripInput, mode: 'replay' });
  const results = await Promise.all([
    s.call(`/trips/${trip.id}/replay`, 'POST', { advanceSeconds: 20 }),
    s.call(`/trips/${trip.id}/replay`, 'POST', { advanceSeconds: 20 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await s.store.get('SELECT count(*) AS n FROM fixes')).n, 1);
});

test('SQLite transactions roll back mutation and audit together and survive reopen', async (t) => {
  const { createSqliteStore } = await import('../backend/sqlite-store.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'climate-backend-')),
    filename = join(directory, 'operations.sqlite');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const db = new DatabaseSync(filename);
  db.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
  const store = createSqliteStore(db);
  await store.run(
    'INSERT INTO observations(id,owner_id,data_json,metadata_json,content_hash,created_at) VALUES(?,?,?,?,?,?)',
    ['persisted', 'owner', '{}', '{}', 'hash', 'now'],
  );
  await assert.rejects(
    store.batch([
      { sql: 'DELETE FROM observations WHERE id=?', params: ['persisted'] },
      { sql: 'INSERT INTO missing_table VALUES(?)', params: ['fail'] },
    ]),
  );
  db.close();
  const reopened = new DatabaseSync(filename);
  try {
    assert.equal(
      (
        await createSqliteStore(reopened).get('SELECT id FROM observations WHERE id=?', [
          'persisted',
        ])
      ).id,
      'persisted',
    );
  } finally {
    reopened.close();
  }
});

test('test schema and deployable Drizzle migration define the same database', async () => {
  const fixture = new DatabaseSync(':memory:'),
    migration = new DatabaseSync(':memory:');
  try {
    fixture.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((name) => name.endsWith('.sql'))
      .sort())
      migration.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
    const schema = (db) =>
      db
        .prepare(
          "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
        )
        .all();
    assert.deepEqual(schema(fixture), schema(migration));
  } finally {
    fixture.close();
    migration.close();
  }
});

test('appended regional migration preserves an existing Dacope trip through SQLite reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'climate-migration-'));
  const filename = join(directory, 'trip.db');
  let database = new DatabaseSync(filename);
  try {
    database.exec(
      readFileSync(new URL('../drizzle/0000_nice_secret_warriors.sql', import.meta.url), 'utf8'),
    );
    database
      .prepare(
        'INSERT INTO trips(id,owner_id,name,mode,origin_json,destination_json,speed,profile,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        'old-trip',
        'owner',
        'Existing delivery',
        'replay',
        '{}',
        '{}',
        25,
        'road',
        '2026-10-24',
        '2026-10-24',
      );
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((name) => name.endsWith('.sql') && !name.startsWith('0000_'))
      .sort())
      database.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
    database.close();
    database = new DatabaseSync(filename);
    const trip = database.prepare('SELECT * FROM trips WHERE id=?').get('old-trip');
    assert.equal(trip.region_id, 'dacope');
    assert.equal(trip.name, 'Existing delivery');
    assert.equal(trip.revision, 1);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('concurrent case edits preserve accurate audit history and require refresh on a conflict', async (t) => {
  const s = await setup(t);
  const observationId = (
    await s.call('/observations', 'POST', {
      date: '2026-10-23',
      latitude: 22.5,
      longitude: 89.4,
      ph: 7,
      metadata: { sourceKind: 'field-entry', sourceLabel: 'Test meter' },
    })
  ).body.observation.id;
  const caseId = (await s.call('/cases', 'POST', { title: 'Concurrent review', observationId }))
    .body.case.id;
  const results = await Promise.all(
    ['sampling', 'reviewed'].map((status) => s.call(`/cases/${caseId}`, 'PATCH', { status })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const events = await s.store.all("SELECT payload_json FROM events WHERE type='case.updated'");
  assert.equal(events.length, 1);
  assert.equal(JSON.parse(events[0].payload_json).previousStatus, 'new');
});
test('measurement and case retries preserve one row and one audit event after an uncertain response', async (t) => {
  const s = await setup(t);
  const sample = {
    date: '2026-10-01',
    latitude: 23.89,
    longitude: 90.39,
    ph: 7,
    do: 3,
    cod: 60,
    units: { do: 'mg/L', cod: 'mg/L' },
    metadata: { sourceKind: 'representational', sourceLabel: 'Retry test fixture, no real sample' },
    clientId: 'measurement-retry-001',
  };
  const first = await s.call('/observations', 'POST', sample);
  assert.equal(first.status, 201);
  const repeated = await s.call('/observations', 'POST', sample);
  assert.equal(repeated.status, 201);
  assert.equal(first.body.observation.id, repeated.body.observation.id);
  assert.equal((await s.call('/observations')).body.observations.length, 1);
  assert.equal((await s.call('/observations', 'POST', { ...sample, ph: 8 })).status, 409);
  const body = {
    observationId: first.body.observation.id,
    title: 'Verify fixture',
    note: 'Resample the declared point.',
    clientId: 'case-retry-001',
  };
  const a = await s.call('/cases', 'POST', body),
    b = await s.call('/cases', 'POST', body);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.body.case.id, b.body.case.id);
  assert.equal((await s.call('/cases')).body.cases.length, 1);
  assert.equal((await s.call('/cases', 'POST', { ...body, title: 'Other title' })).status, 409);
  const exported = await s.call('/export');
  assert.equal(exported.body.events.filter((e) => e.type === 'observation.created').length, 1);
  assert.equal(exported.body.events.filter((e) => e.type === 'case.created').length, 1);
});
