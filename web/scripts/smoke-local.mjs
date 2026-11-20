/** Black-box integration against a running BUILT loopback Worker. Never use on a hosted origin. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:5191');
if (
  base.protocol !== 'http:' ||
  base.hostname !== '127.0.0.1' ||
  base.username ||
  base.password ||
  base.pathname !== '/'
)
  throw Error('Smoke tests require an explicit HTTP 127.0.0.1 loopback Worker.');
const owner = 'local_smoke_owner_' + crypto.randomUUID(),
  other = 'local_smoke_recipient_' + crypto.randomUUID();
const checks = [];
async function call(
  path,
  { actor = owner, method = 'GET', body, status = 200, origin = base.origin } = {},
) {
  const r = await fetch(new URL('/api' + path, base), {
    method,
    headers: {
      ...(actor
        ? {
            'oai-authenticated-user-id': actor,
            'oai-authenticated-user-email': actor + '@sites.test',
          }
        : {}),
      ...(method === 'GET' ? {} : { Origin: origin }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  assert.match(r.headers.get('cache-control') || '', /no-store/);
  return data;
}
const network = JSON.parse(
  readFileSync(new URL('../public/data/gis-network.json', import.meta.url)),
);
const endpoint = (id) => {
  const n = network.nodes.find((n) => n.id === id);
  return {
    latitude: n.lat,
    longitude: n.lon,
    label: n.name,
    provenance: 'representational integration fixture; not an operating water source',
  };
};
assert.equal((await call('/health', { actor: null })).database, 'connected');
await call('/me', { actor: null, status: 401 });
checks.push('actual HTTP adapter reaches D1; private API rejects unauthenticated caller');
const catalogue = await call('/catalogue', { actor: null });
assert.equal(catalogue.regions.length, 5);
const rootResponse = await fetch(new URL('/', base));
assert.equal(rootResponse.status, 200);
assert.match(await rootResponse.text(), /Find water, check rivers, plan supply/);
for (const region of catalogue.regions) {
  const input = { regionId: region.id, hazard: 'clear', destinationRole: 'reserve' };
  const normal = await call('/scenario-route', { actor: null, method: 'POST', body: input });
  const storm = await call('/scenario-route', {
    actor: null,
    method: 'POST',
    body: { ...input, hazard: 'storm' },
  });
  assert.equal(normal.calculation, 'server');
  assert.equal(normal.regionId, region.id);
  assert.equal(normal.sourceKind, 'representational');
  assert.equal(normal.waterSafety, 'unknown');
  assert.ok(normal.routes.length > 1);
  assert.ok(storm.routes[0].distanceM > normal.routes[0].distanceM);
  const makeEndpoint = (role) => {
    const a = region.assets.find((a) => a.role === role);
    return {
      latitude: a.latitude,
      longitude: a.longitude,
      label: a.name,
      provenance: 'representational regional HTTP fixture',
    };
  };
  const { trip: regionalTrip } = await call('/trips', {
    method: 'POST',
    status: 201,
    body: {
      name: `Representational ${region.name} HTTP replay`,
      mode: 'replay',
      regionId: region.id,
      origin: makeEndpoint('supplier'),
      destination: makeEndpoint('reserve'),
    },
  });
  assert.equal(regionalTrip.regionId, region.id);
  assert.equal(
    (await call(`/trips/${regionalTrip.id}/route`)).routes[0].distanceM,
    normal.routes[0].distanceM,
  );
  await call(`/trips/${regionalTrip.id}/replay`, { method: 'POST', body: { advanceSeconds: 10 } });
  assert.equal((await call('/trips/' + regionalTrip.id)).latestFixes[0].source, 'replay');
}
await call('/scenario-route', {
  actor: null,
  method: 'POST',
  status: 400,
  body: { regionId: 'unknown', hazard: 'clear', destinationRole: 'reserve' },
});
checks.push(
  'five-region unsigned server plans, actual storm detours, region-persisted private routes/replays, and built page entry',
);
const { trip } = await call('/trips', {
  method: 'POST',
  status: 201,
  body: {
    name: 'Local integration fixture — not operational',
    mode: 'operational',
    origin: endpoint('supplier'),
    destination: endpoint('reserve'),
    assumedSpeedKmh: 25,
  },
});
await call('/trips/' + trip.id, { actor: other, status: 404 });
await call('/trips', {
  method: 'POST',
  status: 403,
  origin: 'https://untrusted.invalid',
  body: { name: 'Rejected' },
});
const before = await call(`/trips/${trip.id}/route`);
assert.equal(before.status, 'ok');
assert.equal(before.routes[0].distanceM, 7892.528);
assert.ok(before.routes.length > 1);
const { closure } = await call(`/trips/${trip.id}/closures`, {
  method: 'POST',
  status: 201,
  body: {
    edgeIds: ['e-407214-0-9'],
    reason: 'Representational integration closure — no field report',
    expiresInMinutes: 5,
  },
});
const detour = await call(`/trips/${trip.id}/route`);
assert.equal(detour.routes[0].distanceM, 9740.886);
assert.ok(detour.routes.every((r) => !r.edgeIds.includes('e-407214-0-9')));
assert.ok(detour.routes[1]);
await call(`/trips/${trip.id}/preference`, {
  method: 'POST',
  body: { routeId: detour.routes[1].id },
});
assert.equal((await call(`/trips/${trip.id}/route`)).selectedRouteId, detour.routes[1].id);
checks.push('real graph routes, distinct alternative, persisted closure exclusion and preference');
const { token } = await call(`/trips/${trip.id}/invites`, {
  method: 'POST',
  status: 201,
  body: { role: 'recipient', expiresInMinutes: 5 },
});
await call('/invites/accept', { actor: other, method: 'POST', body: { token } });
assert.equal((await call('/trips/' + trip.id, { actor: other })).membershipRole, 'recipient');
await call('/invites/accept', { actor: other, method: 'POST', body: { token }, status: 409 });
checks.push('two independent HTTP actors join a scoped trip with single-use invitation');
const capturedAt = new Date().toISOString();
await call(`/trips/${trip.id}/fixes`, {
  actor: other,
  method: 'POST',
  status: 201,
  body: {
    role: 'recipient',
    source: 'device',
    clientFixId: crypto.randomUUID(),
    latitude: 23.7,
    longitude: 90.4,
    accuracyM: 5,
    capturedAt,
  },
});
const off = await call(`/trips/${trip.id}/route`);
assert.equal(off.status, 'off_graph');
assert.equal(off.routes.length, 0);
assert.equal(off.positionUse.recipient.used, true);
await call(`/trips/${trip.id}/fixes/recipient`, { actor: other, method: 'DELETE' });
assert.equal((await call('/trips/' + trip.id)).latestFixes.length, 0);
await call(`/trips/${trip.id}/closures/${closure.id}`, { method: 'DELETE' });
checks.push(
  'fixture device telemetry crosses HTTP; off-graph ETA withheld; role deletion acknowledged',
);
const { trip: replay } = await call('/trips', {
  method: 'POST',
  status: 201,
  body: {
    name: 'Representational replay fixture',
    mode: 'replay',
    origin: endpoint('supplier'),
    destination: endpoint('reserve'),
  },
});
await call(`/trips/${replay.id}/replay`, { method: 'POST', body: { advanceSeconds: 10 } });
assert.equal((await call('/trips/' + replay.id)).latestFixes[0].source, 'replay');
const { observation } = await call('/observations', {
  method: 'POST',
  status: 201,
  body: {
    date: new Date().toISOString().slice(0, 10),
    latitude: 22.57,
    longitude: 89.51,
    ph: 7.1,
    do: 3.2,
    cod: 65,
    units: { do: 'mg/L', cod: 'mg/L' },
    metadata: {
      sourceKind: 'representational',
      sourceLabel: 'Invented integration fixture — not measured',
    },
  },
});
assert.equal(observation.screening.failed, 2);
assert.equal(observation.screening.tested, 3);
assert.match(observation.contentHash, /^[a-f0-9]{64}$/);
const { case: investigation } = await call('/cases', {
  method: 'POST',
  status: 201,
  body: { title: 'Representational sampling workflow', observationId: observation.id },
});
await call('/cases/' + investigation.id, {
  method: 'PATCH',
  body: {
    status: 'sampling',
    note: 'Obtain independently verified laboratory evidence',
    expectedRevision: investigation.revision,
  },
});
await call('/cases/' + investigation.id, {
  method: 'PATCH',
  status: 409,
  body: { status: 'closed', expectedRevision: investigation.revision },
});
const exported = await call('/export');
assert.ok(exported.observations.some((o) => o.id === observation.id));
assert.ok(exported.cases.some((c) => c.id === investigation.id));
const privateOther = await call('/export', { actor: other });
assert.equal(privateOther.observations.length, 0);
assert.equal(privateOther.trips.length, 0);
checks.push(
  'replay stays labelled; immutable observation screening/hash, revision-safe cases and ownership export',
);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      checkedAt: new Date().toISOString(),
      baseOrigin: base.origin,
      checks,
      limits:
        'Local identity-header fixtures are not production authentication or real hardware GPS validation.',
    },
    null,
    2,
  ),
);
