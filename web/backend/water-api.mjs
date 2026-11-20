import { seasonalHarvest } from '../src/platform/harvest-model.mjs';
import { rainwaterPlan } from '../src/platform/water-model.mjs';
import { bangladeshDate } from '../src/date-context.mjs';
const reply = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
class InputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => {
  throw new InputError(400, message);
};
function numberQuery(url, key, min, max, defaultValue) {
  const raw = url.searchParams.get(key);
  if (raw === null && defaultValue !== undefined) return defaultValue;
  if (raw === null || !raw.trim()) bad('Enter ' + key + '.');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) bad(key + ' is outside the supported range.');
  return n;
}
const label = (value, name, max = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    bad(name + ' is required (maximum ' + max + ' characters).');
  return value.trim();
};
async function jsonBody(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json'))
    throw new InputError(415, 'Send JSON.');
  if (Number(request.headers.get('content-length')) > 32768)
    throw new InputError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) bad('A JSON body is required.');
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32768) {
        await reader.cancel();
        throw new InputError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (!b || Array.isArray(b) || typeof b !== 'object') bad('Send one JSON object.');
    if (['actorId', 'ownerId', 'userId'].some((k) => k in b)) bad('Identity comes from sign-in.');
    return b;
  } catch (e) {
    if (e instanceof InputError) throw e;
    bad('The JSON could not be read.');
  }
}
export function createWaterApi({
  catalogue,
  store,
  clock = () => new Date(),
  uuid = () => crypto.randomUUID(),
}) {
  const view = (r) => ({
    id: r.id,
    sourceId: r.source_id,
    status: r.status,
    visitDate: r.visit_date,
    note: r.note,
    createdAt: r.created_at,
    meaning: 'Your private record; not independent water-safety verification.',
  });
  return async (request, actor) => {
    const url = new URL(request.url),
      path = url.pathname.replace(/\/$/, ''),
      method = request.method;
    if (!path.startsWith('/api/water/')) return null;
    try {
      if (
        !['GET', 'HEAD'].includes(method) &&
        (request.headers.get('origin') !== url.origin ||
          request.headers.get('sec-fetch-site') === 'cross-site')
      )
        throw new InputError(403, 'This action requires the same website origin.');
      const query = url.searchParams.get('query') || '';
      if (query.length > 200) bad('Search text is too long.');
      if (method === 'GET' && path === '/api/water/meta') return reply(catalogue.meta());
      if (method === 'GET' && path === '/api/water/sources') {
        const offset = numberQuery(url, 'offset', 0, 100000, 0),
          limit = numberQuery(url, 'limit', 1, 100, 50);
        if (!Number.isInteger(offset) || !Number.isInteger(limit))
          bad('Pagination must use whole numbers.');
        if (url.searchParams.has('area')) {
          const result = catalogue.searchArea({
            area: url.searchParams.get('area'),
            query,
            offset,
            limit,
          });
          if (!result) throw new InputError(404, 'This area has no records in the inventory.');
          return reply(result);
        }
        return reply(
          catalogue.search({
            latitude: numberQuery(url, 'latitude', -90, 90),
            longitude: numberQuery(url, 'longitude', -180, 180),
            radiusKm: numberQuery(url, 'radiusKm', 0.1, 100, 5),
            query,
            sourceType: url.searchParams.get('sourceType') || '',
            offset,
            limit,
          }),
        );
      }
      if (method === 'POST' && path === '/api/water/nearby') {
        const { latitude, longitude, radiusKm, offset } = await jsonBody(request);
        if (
          typeof latitude !== 'number' ||
          !Number.isFinite(latitude) ||
          Math.abs(latitude) > 90 ||
          typeof longitude !== 'number' ||
          !Number.isFinite(longitude) ||
          Math.abs(longitude) > 180 ||
          ![2, 5, 10, 25, 50].includes(radiusKm) ||
          !Number.isInteger(offset) ||
          offset < 0 ||
          offset > 100000
        )
          bad('Check the location, distance and results page.');
        const { center, ...result } = catalogue.search({
          latitude,
          longitude,
          radiusKm,
          offset,
          limit: 20,
        });
        return reply(result);
      }
      if (method === 'GET' && path === '/api/water/source') {
        const result = catalogue.sourceDetail(url.searchParams.get('id'));
        if (!result) throw new InputError(404, 'Water point not found.');
        return reply(result);
      }
      if (method === 'GET' && path === '/api/water/sites')
        return reply({
          sites: catalogue.listSites({ river: url.searchParams.get('river') || '', query }),
          meaning: 'Historical surface-water chemistry; not current drinking-water safety.',
        });
      if (method === 'GET' && path === '/api/water/site') {
        const result = catalogue.siteDetail(url.searchParams.get('id'));
        if (!result) throw new InputError(404, 'Sampling site not found.');
        return reply(result);
      }
      if (method === 'GET' && path === '/api/water/streams') {
        const result = catalogue.stream(url.searchParams.get('area'));
        if (!result) throw new InputError(404, 'No acquired channel snapshot for this area.');
        return reply(result);
      }
      if (method === 'GET' && path === '/api/water/survey') return reply(catalogue.survey());
      if (method === 'POST' && path === '/api/water/rainwater/seasonal') {
        const input = await jsonBody(request);
        try {
          return reply({ input, result: seasonalHarvest(input) });
        } catch {
          bad('Check the region, rainfall scenario and tank inputs.');
        }
      }
      if (method === 'POST' && path === '/api/water/rainwater') {
        const input = await jsonBody(request);
        try {
          return reply({
            input,
            result: rainwaterPlan(input),
            calculatedAt: new Date(clock()).toISOString(),
          });
        } catch {
          bad('Check roof, tank, initial storage, daily demand and rainfall inputs.');
        }
      }
      if (path === '/api/water/checks') {
        if (!actor?.id) throw new InputError(401, 'Sign in to keep a private check record.');
        if (method === 'GET') {
          const sourceId = url.searchParams.get('sourceId');
          const checks = await store.all(
            'SELECT * FROM water_checks WHERE owner_id=?' +
              (sourceId ? ' AND source_id=?' : '') +
              ' ORDER BY created_at DESC,id DESC LIMIT 100',
            sourceId ? [actor.id, sourceId] : [actor.id],
          );
          return reply({
            checks: checks.map(view),
            limit: 100,
            meaning:
              'Up to 100 most recent private records. Export your records for a complete history.',
          });
        }
        if (method === 'POST') {
          const b = await jsonBody(request),
            sourceId = label(b.sourceId, 'Water point', 128),
            clientId = label(b.clientId, 'Retry identifier', 128),
            note = label(b.note, 'What needs checking or what you found', 1000);
          if (!/^[\w-]{8,128}$/.test(clientId)) bad('Use a valid retry identifier.');
          if (!catalogue.sourceDetail(sourceId)) bad('Choose a real point from this inventory.');
          if (!['needs-check', 'visited', 'unavailable', 'could-not-reach'].includes(b.status))
            bad('Choose a supported check status.');
          const visitDate = label(b.visitDate, 'Record date', 10),
            d = new Date(visitDate + 'T00:00:00Z');
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) ||
            !Number.isFinite(+d) ||
            d.toISOString().slice(0, 10) !== visitDate ||
            visitDate > bangladeshDate(new Date(clock()))
          )
            bad('Use a real date up to today in Bangladesh.');
          // The unique actor/client key makes retry safe even across concurrent requests.
          const checkId = uuid(),
            createdAt = new Date(clock()).toISOString();
          await store.batch([
            {
              sql: 'INSERT INTO water_checks(id,owner_id,source_id,client_id,status,visit_date,note,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,client_id) DO NOTHING',
              params: [checkId, actor.id, sourceId, clientId, b.status, visitDate, note, createdAt],
            },
            {
              sql: 'INSERT INTO events(id,trip_id,owner_id,actor_id,type,subject_id,payload_json,created_at) SELECT ?,NULL,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM water_checks WHERE id=? AND owner_id=?)',
              params: [
                uuid(),
                actor.id,
                actor.id,
                'water-check.created',
                checkId,
                JSON.stringify({
                  sourceId,
                  status: b.status,
                  visitDate,
                  meaning: 'Private self-reported check, not independent water-quality clearance.',
                }),
                createdAt,
                checkId,
                actor.id,
              ],
            },
          ]);
          const saved = await store.get(
            'SELECT * FROM water_checks WHERE owner_id=? AND client_id=?',
            [actor.id, clientId],
          );
          if (
            saved.source_id !== sourceId ||
            saved.status !== b.status ||
            saved.visit_date !== visitDate ||
            saved.note !== note
          )
            throw new InputError(
              409,
              'This retry identifier belongs to a different record. Retry the original or start a new record.',
            );
          return reply({ check: view(saved) }, 201);
        }
      }
      if (path === '/api/water/checks-export' && method === 'GET') {
        if (!actor?.id) throw new InputError(401, 'Sign in to export your private records.');
        const checks = await store.all(
          'SELECT * FROM water_checks WHERE owner_id=? ORDER BY created_at,id',
          [actor.id],
        );
        return reply({
          checks: checks.map(view),
          exportedAt: new Date(clock()).toISOString(),
          meaning: 'Private self-reported history; no independent water-quality clearance.',
        });
      }
      throw new InputError(404, 'Water platform endpoint not found.');
    } catch (error) {
      return reply(
        {
          error: {
            code: error instanceof InputError ? 'water_input' : 'water_unavailable',
            message:
              error instanceof InputError
                ? error.message
                : 'The water service could not finish this request. Check the database migrations and server logs.',
          },
        },
        error.status || 500,
      );
    }
  };
}
