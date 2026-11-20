import { validateObservation, screenWater, OBJECTIVE_PROFILE } from '../src/water-engine.mjs';
import { calculateScenario } from '../src/mvp/scenario-model.mjs';

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
const fail = (status, code, message, details) => {
  throw new HttpError(status, code, message, details);
};
const ok = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = (v, name, max = 200) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(400, 'invalid_input', `${name} must be nonempty text up to ${max} characters.`);
  return v.trim();
};
const id = (v) => {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(v))
    fail(400, 'invalid_id', 'Invalid identifier.');
  return v;
};
const json = JSON.stringify;
const parse = JSON.parse;
const point = (v) => {
  if (!v || !number(v.latitude, -90, 90) || !number(v.longitude, -180, 180))
    fail(400, 'invalid_coordinates', 'Valid WGS84 coordinates required.');
  return { latitude: v.latitude, longitude: v.longitude };
};
const endpoint = (v) => ({
  ...point(v),
  label: text(v.label, 'Endpoint label'),
  provenance: text(v.provenance, 'Endpoint provenance', 500),
});
const canonical = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : '{' +
        Object.keys(v)
          .sort()
          .map((key) => json(key) + ':' + canonical(v[key]))
          .join(',') +
        '}'
    : json(v);
const hash = async (v) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
function timestamp(v, name) {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    fail(400, 'invalid_timestamp', `${name} requires a UTC ISO timestamp.`);
  const normalized = new Date(v).toISOString();
  if (normalized.slice(0, 19) !== v.slice(0, 19))
    fail(400, 'invalid_timestamp', `${name} is not a real date.`);
  return normalized;
}
function url(v) {
  if (v == null || v === '') return null;
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || v.length > 2000)
      throw Error();
    return u.href;
  } catch {
    fail(400, 'invalid_url', 'An HTTP(S) evidence URL without credentials is required.');
  }
}
const statement = (sql, params = []) => ({ sql, params });
const tripView = (r) => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  mode: r.mode,
  regionId: r.region_id ?? 'dacope',
  origin: parse(r.origin_json),
  destination: parse(r.destination_json),
  assumedSpeedKmh: r.speed,
  profile: r.profile,
  selectedRouteId: r.selected_route_id,
  replayDistanceM: r.replay_distance,
  revision: r.revision,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  membershipRole: r.membership_role,
});
const fixView = (r, now) => ({
  id: r.id,
  tripId: r.trip_id,
  actorId: r.actor_id,
  role: r.role,
  source: r.source,
  clientFixId: r.client_fix_id,
  latitude: r.latitude,
  longitude: r.longitude,
  accuracyM: r.accuracy_m,
  speedMps: r.speed_mps,
  heading: r.heading,
  capturedAt: r.captured_at,
  receivedAt: r.received_at,
  metadata: parse(r.metadata_json),
  stale: +now - Date.parse(r.captured_at) > 30000,
  ageSeconds: Math.max(0, (+now - Date.parse(r.captured_at)) / 1000),
});
const closureView = (r, now) => ({
  id: r.id,
  tripId: r.trip_id,
  actorId: r.actor_id,
  edgeIds: parse(r.edge_ids_json),
  latitude: r.latitude,
  longitude: r.longitude,
  radiusM: r.radius_m,
  reason: r.reason,
  sourceKind: r.source_kind,
  sourceLabel: r.source_label,
  sourceUrl: r.source_url,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
  createdAt: r.created_at,
  active: !r.revoked_at && r.expires_at > now.toISOString(),
  verification: 'unverified-report',
});
const eventView = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  actorId: r.actor_id,
  type: r.type,
  subjectId: r.subject_id,
  payload: parse(r.payload_json),
  createdAt: r.created_at,
});
const observationView = (r) => ({
  id: r.id,
  ownerId: r.owner_id,
  ...parse(r.data_json),
  metadata: parse(r.metadata_json),
  contentHash: r.content_hash,
  createdAt: r.created_at,
  screening: screenWater(parse(r.data_json)),
  verification: 'entered-result-not-authenticated-lab-evidence',
});
const caseView = (r) => ({
  id: r.id,
  ownerId: r.owner_id,
  observationId: r.observation_id,
  title: r.title,
  status: r.status,
  note: r.note,
  revision: r.revision,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  reviewMeaning:
    'Operator review; not independent laboratory validation or a drinking-water certificate.',
});
async function body(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json'))
    fail(415, 'unsupported_media_type', 'Send application/json.');
  if (Number(request.headers.get('content-length')) > 32768)
    fail(413, 'body_too_large', 'Request body exceeds 32 KiB.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'invalid_json', 'A JSON object is required.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      fail(413, 'body_too_large', 'Request body exceeds 32 KiB.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  let v;
  try {
    v = parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail(400, 'invalid_json', 'Malformed JSON.');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v))
    fail(400, 'invalid_json', 'A JSON object is required.');
  for (const key of ['ownerId', 'owner_id', 'actorId', 'actor_id', 'userId', 'user_id'])
    if (key in v) fail(400, 'untrusted_identity', 'Identity comes from the signed-in session.');
  return v;
}

export function createApi({
  store,
  routing,
  catalogue,
  clock = () => new Date(),
  uuid = () => crypto.randomUUID(),
}) {
  const { edgeIds: _internalEdgeIds, ...publicRoutingMetadata } = routing.metadata;
  const regionIds = routing.regionIds ?? ['dacope'];
  const engineFor = (regionId = 'dacope') => {
    if (typeof regionId !== 'string' || !regionIds.includes(regionId))
      fail(400, 'invalid_region', 'Choose a supported routing region.');
    const engine = routing.forRegion ? routing.forRegion(regionId) : routing;
    if (!engine) fail(400, 'invalid_region', 'Choose a supported routing region.');
    return engine;
  };
  const audit = (actor, trip, type, subjectId, payload, now, condition) => {
    const params = [
      uuid(),
      trip?.id ?? null,
      trip?.owner_id ?? actor.id,
      actor.id,
      type,
      subjectId,
      json(payload),
      now.toISOString(),
    ];
    return statement(
      `INSERT INTO events(id,trip_id,owner_id,actor_id,type,subject_id,payload_json,created_at) SELECT ?,?,?,?,?,?,?,?${condition ? ' WHERE ' + condition.sql : ''}`,
      [...params, ...(condition?.params ?? [])],
    );
  };
  const revision = (tripId, now, condition) =>
    statement(
      `UPDATE trips SET revision=revision+1,updated_at=? WHERE id=?${condition ? ' AND ' + condition.sql : ''}`,
      [now.toISOString(), tripId, ...(condition?.params ?? [])],
    );
  const prune = (tripId, role, now) =>
    statement(
      'DELETE FROM fixes WHERE trip_id=? AND role=? AND (captured_at<? OR id NOT IN (SELECT id FROM fixes WHERE trip_id=? AND role=? ORDER BY captured_at DESC,id DESC LIMIT 100))',
      [tripId, role, new Date(+now - 86400000).toISOString(), tripId, role],
    );
  async function access(tripId, actor) {
    id(tripId);
    const trip = await store.get(
      'SELECT t.*,m.role AS membership_role FROM trips t JOIN memberships m ON m.trip_id=t.id WHERE t.id=? AND m.user_id=?',
      [tripId, actor.id],
    );
    if (!trip) fail(404, 'not_found', 'Trip not found.');
    return trip;
  }
  const requireRole = (trip, roles) => {
    if (!roles.includes(trip.membership_role))
      fail(403, 'forbidden', 'Your trip role does not permit this action.');
  };
  async function latest(trip, now) {
    const rows = await store.all(
      'SELECT * FROM fixes WHERE trip_id=? AND captured_at>=? ORDER BY captured_at DESC,id DESC',
      [trip.id, new Date(+now - 86400000).toISOString()],
    );
    const seen = new Set();
    return rows.filter((r) => !seen.has(r.role) && seen.add(r.role)).map((r) => fixView(r, now));
  }
  async function closuresFor(trip, now) {
    return (
      await store.all('SELECT * FROM closures WHERE trip_id=? ORDER BY created_at DESC', [trip.id])
    ).map((r) => closureView(r, now));
  }
  async function calculate(trip, now) {
    const fixes = await latest(trip, now),
      closures = await closuresFor(trip, now),
      positionUse = {};
    const endpoints = {
      supplier: parse(trip.origin_json),
      recipient: parse(trip.destination_json),
    };
    for (const role of ['supplier', 'recipient']) {
      const fix = fixes.find((f) => f.role === role);
      const reason = !fix
        ? 'configured-endpoint'
        : fix.source !== 'device'
          ? 'replay'
          : fix.stale
            ? 'stale'
            : fix.accuracyM > 100
              ? 'poor-accuracy'
              : 'fresh-device';
      const used = reason === 'fresh-device';
      if (used) endpoints[role] = point(fix);
      positionUse[role] = {
        used,
        reason,
        source: fix?.source ?? 'configured',
        capturedAt: fix?.capturedAt ?? null,
        accuracyM: fix?.accuracyM ?? null,
      };
    }
    const activeClosures = closures
      .filter((c) => c.active)
      .map((c) => ({
        id: c.id,
        edgeIds: c.edgeIds,
        ...(c.latitude != null && c.longitude != null
          ? { latitude: c.latitude, longitude: c.longitude, radiusM: c.radiusM }
          : {}),
      }));
    const result = await engineFor(trip.region_id).route({
      origin: endpoints.supplier,
      destination: endpoints.recipient,
      closures: activeClosures,
      assumedSpeedKmh: trip.speed,
      profile: trip.profile,
    });
    const { edgeIds: _sourceEdgeIds, ...source } = result.source ?? {};
    return {
      ...result,
      source,
      regionId: trip.region_id ?? 'dacope',
      selectedRouteId:
        result.routes?.find((r) => r.id === trip.selected_route_id)?.id ??
        result.routes?.[0]?.id ??
        null,
      positionUse,
      serverTime: now.toISOString(),
      revision: trip.revision,
      mode: trip.mode,
      estimateMeaning:
        'Derived from mapped road geometry and an assumed speed; current traffic, flood safety and bridge capacity are unverified.',
    };
  }
  return async function api(request, actor) {
    try {
      const requestUrl = new URL(request.url),
        path = requestUrl.pathname.replace(/\/$/, ''),
        method = request.method.toUpperCase(),
        now = new Date(clock());
      if (!Number.isFinite(+now)) throw Error('Invalid server clock');
      if (!['GET', 'HEAD'].includes(method)) {
        const origin = request.headers.get('origin');
        if (origin !== requestUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site')
          fail(403, 'cross_origin', 'Mutations require the same Origin as this application.');
      }
      if (path === '/api/health' && method === 'GET') {
        await store.get('SELECT 1 AS connected');
        return ok({
          status: 'ok',
          database: 'connected',
          release: '4.0.0',
          serverTime: now.toISOString(),
        });
      }
      if (path === '/api/catalogue' && method === 'GET')
        return ok({
          ...catalogue,
          routing: publicRoutingMetadata,
          sourceKind: 'representational',
          sourceLabel: 'Representational regional planning catalogue',
          objectiveProfile: OBJECTIVE_PROFILE,
          warning:
            'Preset assets and hazards are representations, not current water-safety or access determinations.',
        });
      if (path === '/api/scenario-route' && method === 'POST') {
        const input = await body(request),
          regionId = input.regionId;
        if (typeof regionId !== 'string')
          fail(400, 'invalid_region', 'Choose a supported routing region.');
        const engine = engineFor(regionId),
          scenario = routing.scenarioForRegion?.(regionId);
        if (!scenario)
          fail(404, 'scenario_unavailable', 'No bundled scenario is available for this region.');
        if (!['clear', 'storm', 'salinity'].includes(input.hazard))
          fail(400, 'invalid_hazard', 'Choose clear, storm or salinity.');
        const severity = input.severity === undefined ? 'moderate' : input.severity;
        if (!['moderate', 'severe'].includes(severity))
          fail(400, 'invalid_severity', 'Choose moderate or severe.');
        if (!scenario.assets.some((asset) => asset.role === input.destinationRole))
          fail(400, 'invalid_destination', 'Choose a destination role from this region scenario.');
        const blockedEdgeIds = input.blockedEdgeIds === undefined ? [] : input.blockedEdgeIds,
          knownEdgeIds = new Set(engine.metadata.edgeIds ?? []);
        if (
          !Array.isArray(blockedEdgeIds) ||
          blockedEdgeIds.length > 100 ||
          blockedEdgeIds.some((edgeId) => typeof edgeId !== 'string' || !knownEdgeIds.has(edgeId))
        )
          fail(
            400,
            'invalid_edges',
            'Blockage edge IDs must exist in this regional graph (maximum 100).',
          );
        const result = calculateScenario(engine, scenario, {
          regionId,
          hazard: input.hazard,
          severity,
          destinationRole: input.destinationRole,
          blockedEdgeIds,
        });
        const { edgeIds: _sourceEdgeIds, ...source } = result.source ?? {};
        return ok({
          ...result,
          source,
          regionId,
          hazard: input.hazard,
          severity,
          calculation: 'server',
        });
      }
      if (!actor?.id || typeof actor.id !== 'string' || actor.id.length > 256)
        fail(401, 'unauthenticated', 'Sign in to access private operations.', {
          signInPath: '/signin-with-chatgpt?return_to=/',
        });
      if (path === '/api/me' && method === 'GET')
        return ok({
          actor: {
            id: actor.id,
            displayName: actor.displayName ?? null,
            email: actor.email ?? null,
          },
        });
      const input = ['POST', 'PATCH', 'PUT'].includes(method) ? await body(request) : null;
      if (path === '/api/trips') {
        if (method === 'GET')
          return ok({
            trips: (
              await store.all(
                'SELECT t.*,m.role AS membership_role FROM trips t JOIN memberships m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY t.updated_at DESC',
                [actor.id],
              )
            ).map(tripView),
            serverTime: now.toISOString(),
          });
        if (method === 'POST') {
          const name = text(input.name, 'Trip name', 120),
            mode = input.mode;
          if (!['operational', 'replay'].includes(mode))
            fail(400, 'invalid_mode', 'Choose operational or replay.');
          const regionId = input.regionId === undefined ? 'dacope' : input.regionId;
          engineFor(regionId);
          const origin = endpoint(input.origin),
            destination = endpoint(input.destination),
            speed = input.assumedSpeedKmh ?? 25,
            profile = input.profile ?? 'road';
          if (!number(speed, 1, 80) || profile !== 'road')
            fail(400, 'invalid_profile', 'Road profile with assumed speed 1–80 km/h required.');
          const tripId = uuid();
          await store.batch([
            statement(
              'INSERT INTO trips(id,owner_id,name,mode,origin_json,destination_json,speed,profile,created_at,updated_at,region_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
              [
                tripId,
                actor.id,
                name,
                mode,
                json(origin),
                json(destination),
                speed,
                profile,
                now.toISOString(),
                now.toISOString(),
                regionId,
              ],
            ),
            statement('INSERT INTO memberships(trip_id,user_id,role,created_at) VALUES(?,?,?,?)', [
              tripId,
              actor.id,
              'owner',
              now.toISOString(),
            ]),
            audit(
              actor,
              { id: tripId, owner_id: actor.id },
              'trip.created',
              tripId,
              {
                name,
                mode,
                regionId,
                sourceKind: mode === 'replay' ? 'representational' : 'user-entry',
                sourceLabel: 'Signed-in operator trip configuration',
              },
              now,
            ),
          ]);
          return ok({ trip: tripView(await access(tripId, actor)) }, 201);
        }
      }
      const match = path.match(/^\/api\/trips\/([^/]+)(?:\/(.*))?$/);
      if (match) {
        const trip = await access(match[1], actor),
          tail = match[2] ?? '';
        if (!tail && method === 'GET')
          return ok({
            trip: tripView(trip),
            membershipRole: trip.membership_role,
            latestFixes: await latest(trip, now),
            closures: await closuresFor(trip, now),
            events: (
              await store.all(
                'SELECT * FROM events WHERE trip_id=? ORDER BY created_at DESC,id DESC LIMIT 200',
                [trip.id],
              )
            ).map(eventView),
            serverTime: now.toISOString(),
            revision: trip.revision,
          });
        if (tail === 'route' && method === 'GET') return ok(await calculate(trip, now));
        if (tail === 'fixes' && method === 'POST') {
          if (!['supplier', 'recipient'].includes(input.role))
            fail(400, 'invalid_role', 'A supplier or recipient role is required.');
          requireRole(trip, ['owner', input.role]);
          if (trip.mode !== 'operational')
            fail(409, 'replay_only', 'Device fixes are accepted only by operational trips.');
          if (input.source !== 'device')
            fail(400, 'invalid_source', 'This endpoint accepts device positions only.');
          const coords = point(input),
            accuracy = input.accuracyM,
            capturedAt = timestamp(input.capturedAt, 'capturedAt'),
            clientFixId = id(input.clientFixId);
          if (
            !number(accuracy, 0, 10000) ||
            (input.speedMps != null && !number(input.speedMps, 0, 100)) ||
            (input.heading != null && !number(input.heading, 0, 359.999999))
          )
            fail(400, 'invalid_fix', 'Invalid accuracy, speed or heading units.');
          const age = +now - Date.parse(capturedAt);
          if (age > 120000 || age < -30000)
            fail(
              400,
              'fix_time_out_of_range',
              'Device fix must be no older than 120 seconds and no more than 30 seconds in the future.',
            );
          const existing = await store.get(
            'SELECT * FROM fixes WHERE trip_id=? AND role=? AND client_fix_id=?',
            [trip.id, input.role, clientFixId],
          );
          if (existing) {
            if (
              existing.actor_id !== actor.id ||
              existing.captured_at !== capturedAt ||
              existing.latitude !== coords.latitude ||
              existing.longitude !== coords.longitude ||
              existing.accuracy_m !== accuracy ||
              existing.speed_mps !== (input.speedMps ?? null) ||
              existing.heading !== (input.heading ?? null)
            )
              fail(409, 'idempotency_conflict', 'clientFixId already identifies a different fix.');
            return ok({ fix: fixView(existing, now), idempotent: true });
          }
          const fixId = uuid(),
            watermark = input.role === 'supplier' ? 'supplier_fix_at' : 'recipient_fix_at',
            inserted = { sql: 'EXISTS(SELECT 1 FROM fixes WHERE id=?)', params: [fixId] };
          await store.batch([
            statement(
              `INSERT INTO fixes(id,trip_id,actor_id,role,source,client_fix_id,latitude,longitude,accuracy_m,speed_mps,heading,captured_at,received_at,metadata_json) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND (${watermark} IS NULL OR ${watermark}<?))`,
              [
                fixId,
                trip.id,
                actor.id,
                input.role,
                'device',
                clientFixId,
                coords.latitude,
                coords.longitude,
                accuracy,
                input.speedMps ?? null,
                input.heading ?? null,
                capturedAt,
                now.toISOString(),
                json({
                  sourceKind: 'device',
                  sourceLabel: 'Browser geolocation reported by trip member',
                  independentlyValidated: false,
                }),
                trip.id,
                capturedAt,
              ],
            ),
            statement(
              `UPDATE trips SET ${watermark}=?,revision=revision+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM fixes WHERE id=?)`,
              [capturedAt, now.toISOString(), trip.id, fixId],
            ),
            audit(
              actor,
              trip,
              'gps.received',
              fixId,
              {
                role: input.role,
                sourceKind: 'device',
                sourceLabel: 'Browser device fix',
                capturedAt,
              },
              now,
              inserted,
            ),
            prune(trip.id, input.role, now),
          ]);
          const saved = await store.get('SELECT * FROM fixes WHERE id=?', [fixId]);
          if (!saved) {
            const retry = await store.get(
              'SELECT * FROM fixes WHERE trip_id=? AND role=? AND client_fix_id=?',
              [trip.id, input.role, clientFixId],
            );
            if (
              retry &&
              retry.actor_id === actor.id &&
              retry.captured_at === capturedAt &&
              retry.latitude === coords.latitude &&
              retry.longitude === coords.longitude &&
              retry.accuracy_m === accuracy &&
              retry.speed_mps === (input.speedMps ?? null) &&
              retry.heading === (input.heading ?? null)
            )
              return ok({ fix: fixView(retry, now), idempotent: true });
            fail(
              409,
              'nonmonotonic_fix',
              'A newer or equal position has already been received for this role.',
            );
          }
          return ok({ fix: fixView(saved, now) }, 201);
        }
        if (tail.startsWith('fixes/') && method === 'DELETE') {
          const role = tail.slice(6);
          if (!['supplier', 'recipient'].includes(role))
            fail(400, 'invalid_role', 'Invalid position role.');
          requireRole(trip, ['owner', role]);
          const watermark = role === 'supplier' ? 'supplier_fix_at' : 'recipient_fix_at';
          await store.batch([
            statement('DELETE FROM fixes WHERE trip_id=? AND role=?', [trip.id, role]),
            statement(
              `UPDATE trips SET ${watermark}=CASE WHEN ${watermark}>? THEN ${watermark} ELSE ? END,revision=revision+1,updated_at=? WHERE id=?`,
              [now.toISOString(), now.toISOString(), now.toISOString(), trip.id],
            ),
            audit(
              actor,
              trip,
              'gps.deleted',
              trip.id,
              {
                role,
                sourceKind: 'user-action',
                sourceLabel: 'Position sharing stopped and retained positions deleted',
              },
              now,
            ),
          ]);
          return ok({ deleted: true, role });
        }
        if (tail === 'closures' && method === 'POST') {
          requireRole(trip, ['owner', 'supplier']);
          const reason = text(input.reason, 'Closure reason', 1000),
            minutes = input.expiresInMinutes;
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
            fail(400, 'invalid_expiry', 'Closure expiry must be 1–1440 minutes.');
          const edges = input.edgeIds ?? [],
            knownEdgeIds = new Set(engineFor(trip.region_id).metadata.edgeIds ?? []);
          if (
            !Array.isArray(edges) ||
            edges.length > 100 ||
            edges.some((v) => typeof v !== 'string' || !knownEdgeIds.has(v))
          )
            fail(400, 'invalid_edges', 'Closure edge IDs must exist in this graph (maximum 100).');
          const hasPoint = input.latitude != null || input.longitude != null;
          const coords = hasPoint ? point(input) : null;
          if (!edges.length && !coords)
            fail(400, 'invalid_closure', 'Choose mapped edges or a point and radius.');
          const radius = coords ? (input.radiusM ?? 30) : null;
          if (coords && !number(radius, 1, 2000))
            fail(400, 'invalid_radius', 'Closure radius must be 1–2000 metres.');
          const closureId = uuid(),
            sourceKind = trip.mode === 'replay' ? 'representational' : 'user-report',
            sourceLabel =
              trip.mode === 'replay'
                ? 'Replay demonstration blockage'
                : 'Unverified member blockage report';
          await store.batch([
            statement(
              'INSERT INTO closures(id,trip_id,actor_id,edge_ids_json,latitude,longitude,radius_m,reason,source_kind,source_label,source_url,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
              [
                closureId,
                trip.id,
                actor.id,
                json([...new Set(edges)]),
                coords?.latitude ?? null,
                coords?.longitude ?? null,
                radius,
                reason,
                sourceKind,
                sourceLabel,
                url(input.sourceUrl),
                new Date(+now + minutes * 60000).toISOString(),
                now.toISOString(),
              ],
            ),
            revision(trip.id, now),
            audit(
              actor,
              trip,
              'closure.reported',
              closureId,
              { reason, sourceKind, sourceLabel },
              now,
            ),
          ]);
          return ok(
            {
              closure: closureView(
                await store.get('SELECT * FROM closures WHERE id=?', [closureId]),
                now,
              ),
            },
            201,
          );
        }
        if (tail.startsWith('closures/') && method === 'DELETE') {
          requireRole(trip, ['owner', 'supplier']);
          const closureId = id(tail.slice(9));
          const closure = await store.get('SELECT * FROM closures WHERE id=? AND trip_id=?', [
            closureId,
            trip.id,
          ]);
          if (!closure) fail(404, 'not_found', 'Closure not found.');
          await store.batch([
            statement('UPDATE closures SET revoked_at=? WHERE id=? AND trip_id=?', [
              now.toISOString(),
              closureId,
              trip.id,
            ]),
            revision(trip.id, now),
            audit(
              actor,
              trip,
              'closure.revoked',
              closureId,
              { sourceKind: 'user-action', sourceLabel: 'Member cleared a reported blockage' },
              now,
            ),
          ]);
          return ok({ revoked: true, closureId });
        }
        if (tail === 'preference' && method === 'POST') {
          requireRole(trip, ['owner', 'supplier']);
          const route = await calculate(trip, now);
          if (!route.routes.some((r) => r.id === input.routeId))
            fail(409, 'invalid_route_preference', 'Choose a currently available road route.');
          await store.batch([
            statement(
              'UPDATE trips SET selected_route_id=?,revision=revision+1,updated_at=? WHERE id=?',
              [input.routeId, now.toISOString(), trip.id],
            ),
            audit(
              actor,
              trip,
              'route.selected',
              trip.id,
              {
                routeId: input.routeId,
                sourceKind: 'user-action',
                sourceLabel: 'Member route preference',
              },
              now,
            ),
          ]);
          return ok({ selectedRouteId: input.routeId });
        }
        if (tail === 'invites' && method === 'POST') {
          requireRole(trip, ['owner']);
          if (!['supplier', 'recipient', 'viewer'].includes(input.role))
            fail(400, 'invalid_role', 'Invite role must be supplier, recipient or viewer.');
          if (
            !Number.isInteger(input.expiresInMinutes) ||
            input.expiresInMinutes < 1 ||
            input.expiresInMinutes > 10080
          )
            fail(400, 'invalid_expiry', 'Invite expiry must be 1–10080 minutes.');
          const token = uuid() + uuid(),
            inviteId = uuid(),
            expiresAt = new Date(+now + input.expiresInMinutes * 60000).toISOString();
          await store.batch([
            statement(
              'INSERT INTO invites(id,trip_id,token_hash,role,expires_at,created_at) VALUES(?,?,?,?,?,?)',
              [inviteId, trip.id, await hash(token), input.role, expiresAt, now.toISOString()],
            ),
            audit(actor, trip, 'invite.created', inviteId, { role: input.role, expiresAt }, now),
          ]);
          return ok({ token, role: input.role, expiresAt, siteAccessRequired: true }, 201);
        }
        if (tail === 'replay' && method === 'POST') {
          requireRole(trip, ['owner']);
          if (trip.mode !== 'replay')
            fail(409, 'operational_trip', 'Replay advancement is available only on replay trips.');
          if (!Number.isInteger(input.advanceSeconds) || !number(input.advanceSeconds, 1, 60))
            fail(400, 'invalid_advance', 'Advance 1–60 whole seconds.');
          const route = await calculate(trip, now),
            selected = route.routes.find((r) => r.id === route.selectedRouteId);
          if (!selected) fail(409, 'no_route', 'No road path is available for this replay.');
          const distance = Math.min(
              selected.distanceM,
              trip.replay_distance + (input.advanceSeconds * trip.speed) / 3.6,
            ),
            position = engineFor(trip.region_id).pointAlongRoute(selected, distance);
          if (!position) fail(409, 'no_route', 'No mapped replay position is available.');
          const fixId = uuid(),
            inserted = { sql: 'EXISTS(SELECT 1 FROM fixes WHERE id=?)', params: [fixId] };
          await store.batch([
            statement(
              'INSERT INTO fixes(id,trip_id,actor_id,role,source,client_fix_id,latitude,longitude,accuracy_m,heading,captured_at,received_at,metadata_json) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND revision=?)',
              [
                fixId,
                trip.id,
                actor.id,
                'supplier',
                'replay',
                fixId,
                position.latitude,
                position.longitude,
                0,
                position.heading ?? null,
                now.toISOString(),
                now.toISOString(),
                json({
                  sourceKind: 'representational',
                  sourceLabel: 'Computed road-route replay; not device telemetry',
                }),
                trip.id,
                trip.revision,
              ],
            ),
            statement(
              'UPDATE trips SET replay_distance=?,revision=revision+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM fixes WHERE id=?)',
              [distance, now.toISOString(), trip.id, fixId],
            ),
            audit(
              actor,
              trip,
              'replay.advanced',
              fixId,
              {
                advanceSeconds: input.advanceSeconds,
                distanceM: distance,
                sourceKind: 'representational',
                sourceLabel: 'Computed replay',
              },
              now,
              inserted,
            ),
            prune(trip.id, 'supplier', now),
          ]);
          if (!(await store.get('SELECT id FROM fixes WHERE id=?', [fixId])))
            fail(
              409,
              'revision_conflict',
              'Trip changed while replay was being advanced; refresh and retry.',
            );
          return ok({
            source: 'replay',
            position,
            distanceM: distance,
            label: 'Representational route replay',
          });
        }
      }
      if (path === '/api/invites/accept' && method === 'POST') {
        const token = text(input.token, 'Invite token', 256),
          tokenHash = await hash(token),
          nonce = uuid();
        const invite = await store.get('SELECT * FROM invites WHERE token_hash=?', [tokenHash]);
        if (!invite || invite.consumed_at || invite.expires_at <= now.toISOString())
          fail(409, 'invite_unavailable', 'Invite is expired, used or invalid.');
        const membership = await store.get(
          'SELECT * FROM memberships WHERE trip_id=? AND user_id=?',
          [invite.trip_id, actor.id],
        );
        if (membership) fail(409, 'already_member', 'You already belong to this trip.');
        const trip = await store.get('SELECT * FROM trips WHERE id=?', [invite.trip_id]);
        await store.batch([
          statement(
            'UPDATE invites SET consumed_at=?,consumed_by=?,accepted_nonce=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?',
            [now.toISOString(), actor.id, nonce, tokenHash, now.toISOString()],
          ),
          statement(
            'INSERT INTO memberships(trip_id,user_id,role,created_at) SELECT trip_id,?,role,? FROM invites WHERE token_hash=? AND accepted_nonce=?',
            [actor.id, now.toISOString(), tokenHash, nonce],
          ),
          revision(trip.id, now, {
            sql: 'EXISTS(SELECT 1 FROM invites WHERE accepted_nonce=?)',
            params: [nonce],
          }),
          audit(actor, trip, 'invite.accepted', invite.id, { role: invite.role }, now, {
            sql: 'EXISTS(SELECT 1 FROM invites WHERE accepted_nonce=?)',
            params: [nonce],
          }),
        ]);
        if (
          !(await store.get('SELECT id FROM invites WHERE token_hash=? AND accepted_nonce=?', [
            tokenHash,
            nonce,
          ]))
        )
          fail(409, 'invite_unavailable', 'Invite was consumed by another client.');
        return ok({ trip: tripView(await access(trip.id, actor)), role: invite.role });
      }
      if (path === '/api/observations') {
        if (method === 'GET')
          return ok({
            observations: (
              await store.all(
                'SELECT * FROM observations WHERE owner_id=? ORDER BY created_at DESC',
                [actor.id],
              )
            ).map(observationView),
            objectiveProfile: OBJECTIVE_PROFILE,
          });
        if (method === 'POST') {
          const validation = validateObservation(input);
          if (!validation.valid)
            fail(400, 'invalid_observation', 'Observation validation failed.', validation.errors);
          const m = input.metadata;
          if (!m || !['field-entry', 'representational'].includes(m.sourceKind))
            fail(400, 'invalid_provenance', 'Declare field-entry or representational sourceKind.');
          const metadata = {
            sourceKind: m.sourceKind,
            sourceLabel: text(m.sourceLabel, 'Source label', 500),
            method: m.method == null ? null : text(m.method, 'Method', 500),
            evidenceUrl: url(m.evidenceUrl),
            sampledAt: m.sampledAt == null ? null : timestamp(m.sampledAt, 'sampledAt'),
            actorId: actor.id,
            verification: 'entered-result-not-authenticated-lab-evidence',
          };
          if (metadata.sampledAt && Date.parse(metadata.sampledAt) > +now + 30000)
            fail(400, 'future_sample', 'Sample timestamp cannot be in the future.');
          const data = Object.fromEntries(
            ['date', 'latitude', 'longitude', 'location', 'river', 'ph', 'do', 'cod', 'units']
              .filter((k) => input[k] !== undefined)
              .map((k) => [k, input[k]]),
          );
          const observationId = uuid(),
            contentHash = await hash(canonical({ data, metadata })),
            clientId = input.clientId === undefined ? null : id(input.clientId);
          await store.batch([
            statement(
              'INSERT INTO observations(id,owner_id,data_json,metadata_json,content_hash,created_at,client_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_id,client_id) DO NOTHING',
              [
                observationId,
                actor.id,
                json(data),
                json(metadata),
                contentHash,
                now.toISOString(),
                clientId,
              ],
            ),
            audit(
              actor,
              null,
              'observation.created',
              observationId,
              { contentHash, sourceKind: metadata.sourceKind, sourceLabel: metadata.sourceLabel },
              now,
              {
                sql: 'EXISTS(SELECT 1 FROM observations WHERE id=? AND owner_id=?)',
                params: [observationId, actor.id],
              },
            ),
          ]);
          const savedObservation = await store.get(
            clientId
              ? 'SELECT * FROM observations WHERE owner_id=? AND client_id=?'
              : 'SELECT * FROM observations WHERE id=?',
            clientId ? [actor.id, clientId] : [observationId],
          );
          if (savedObservation.content_hash !== contentHash)
            fail(
              409,
              'retry_conflict',
              'This retry identifier belongs to a different measurement.',
            );
          return ok(
            {
              observation: observationView(savedObservation),
            },
            201,
          );
        }
      }
      if (path === '/api/cases') {
        if (method === 'GET')
          return ok({
            cases: (
              await store.all('SELECT * FROM cases WHERE owner_id=? ORDER BY updated_at DESC', [
                actor.id,
              ])
            ).map(caseView),
          });
        if (method === 'POST') {
          const observationId = id(input.observationId),
            observation = await store.get('SELECT id FROM observations WHERE id=? AND owner_id=?', [
              observationId,
              actor.id,
            ]);
          if (!observation) fail(404, 'not_found', 'Observation not found.');
          const caseId = uuid(),
            title = text(input.title, 'Case title', 200),
            note = input.note == null ? null : text(input.note, 'Case note', 4000),
            clientId = input.clientId === undefined ? null : id(input.clientId);
          await store.batch([
            statement(
              'INSERT INTO cases(id,owner_id,observation_id,title,status,note,created_at,updated_at,client_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,client_id) DO NOTHING',
              [
                caseId,
                actor.id,
                observationId,
                title,
                'new',
                note,
                now.toISOString(),
                now.toISOString(),
                clientId,
              ],
            ),
            audit(
              actor,
              null,
              'case.created',
              caseId,
              { observationId, status: 'new', note },
              now,
              {
                sql: 'EXISTS(SELECT 1 FROM cases WHERE id=? AND owner_id=?)',
                params: [caseId, actor.id],
              },
            ),
          ]);
          const savedCase = await store.get(
            clientId
              ? 'SELECT * FROM cases WHERE owner_id=? AND client_id=?'
              : 'SELECT * FROM cases WHERE id=?',
            clientId ? [actor.id, clientId] : [caseId],
          );
          if (
            savedCase.observation_id !== observationId ||
            savedCase.title !== title ||
            savedCase.note !== note
          )
            fail(
              409,
              'retry_conflict',
              'This retry identifier belongs to a different case or the case has since changed.',
            );
          return ok({ case: caseView(savedCase) }, 201);
        }
      }
      const caseMatch = path.match(/^\/api\/cases\/([^/]+)$/);
      if (caseMatch && method === 'PATCH') {
        const caseId = id(caseMatch[1]),
          current = await store.get('SELECT * FROM cases WHERE id=? AND owner_id=?', [
            caseId,
            actor.id,
          ]);
        if (!current) fail(404, 'not_found', 'Case not found.');
        if (
          input.expectedRevision !== undefined &&
          (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== current.revision)
        )
          fail(
            409,
            'revision_conflict',
            'The case changed since this form was loaded; refresh before applying this edit.',
          );
        if (!['new', 'sampling', 'reviewed', 'follow-up', 'closed'].includes(input.status))
          fail(400, 'invalid_status', 'Unknown investigation status.');
        const note =
          input.note === undefined
            ? current.note
            : input.note === null
              ? null
              : text(input.note, 'Case note', 4000);
        const event = audit(
          actor,
          null,
          'case.updated',
          caseId,
          {
            previousStatus: current.status,
            status: input.status,
            note,
            reviewMeaning: 'Operator review; not independent laboratory validation.',
          },
          now,
          {
            sql: 'EXISTS(SELECT 1 FROM cases WHERE id=? AND owner_id=? AND revision=?)',
            params: [caseId, actor.id, current.revision],
          },
        );
        const results = await store.batch([
          event,
          statement(
            'UPDATE cases SET status=?,note=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM events WHERE id=?)',
            [input.status, note, now.toISOString(), caseId, actor.id, event.params[0]],
          ),
        ]);
        if (results[0].changes !== 1)
          fail(
            409,
            'revision_conflict',
            'The case changed in another client; refresh before applying this edit.',
          );
        return ok({
          case: caseView(
            await store.get('SELECT * FROM cases WHERE id=? AND owner_id=?', [caseId, actor.id]),
          ),
        });
      }
      if (path === '/api/export' && method === 'GET') {
        const ownTrips = await store.all(
          'SELECT * FROM trips WHERE owner_id=? ORDER BY created_at',
          [actor.id],
        );
        const positions = await store.all(
          'SELECT f.* FROM fixes f JOIN trips t ON t.id=f.trip_id WHERE t.owner_id=? AND f.captured_at>=? ORDER BY f.captured_at',
          [actor.id, new Date(+now - 86400000).toISOString()],
        );
        return ok({
          exportedAt: now.toISOString(),
          actorId: actor.id,
          trips: ownTrips.map(tripView),
          fixes: positions.map((r) => fixView(r, now)),
          closures: (
            await store.all(
              'SELECT c.* FROM closures c JOIN trips t ON t.id=c.trip_id WHERE t.owner_id=?',
              [actor.id],
            )
          ).map((r) => closureView(r, now)),
          observations: (
            await store.all('SELECT * FROM observations WHERE owner_id=?', [actor.id])
          ).map(observationView),
          cases: (await store.all('SELECT * FROM cases WHERE owner_id=?', [actor.id])).map(
            caseView,
          ),
          events: (
            await store.all('SELECT * FROM events WHERE owner_id=? ORDER BY created_at', [actor.id])
          ).map(eventView),
          warning:
            'Private operational export; entered results and operator review do not establish drinking-water safety.',
        });
      }
      fail(404, 'not_found', 'API endpoint not found.');
    } catch (error) {
      if (error instanceof HttpError)
        return ok(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          },
          error.status,
        );
      console.error('Climate++ API failure:', error?.message);
      return ok(
        {
          error: {
            code: 'internal_error',
            message: 'The operation could not be completed. Retry or contact the operator.',
          },
        },
        500,
      );
    }
  };
}
