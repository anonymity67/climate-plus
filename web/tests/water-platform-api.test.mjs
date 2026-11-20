import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStore } from '../backend/sqlite-store.mjs';
import { createWaterApi } from '../backend/water-api.mjs';
import { waterCatalogue } from '../backend/water-registry.mjs';
const owner = { id: 'owner' },
  stranger = { id: 'stranger' };
const catalogue = waterCatalogue();
function setup(db) {
  const store = createSqliteStore(db);
  const api = createWaterApi({ store, catalogue, clock: () => new Date('2026-11-17T12:00:00Z') });
  return async (path, method = 'GET', body, actor = owner, headers = {}) => {
    const r = await api(
      new Request('https://water.test/api/water/' + path, {
        method,
        headers: {
          origin: 'https://water.test',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      actor,
    );
    return { status: r.status, body: await r.json() };
  };
}
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
  return db;
}
const point = catalogue.points[0];
const entry = {
  sourceId: point.id,
  clientId: 'retry-water-001',
  status: 'needs-check',
  visitDate: '2026-11-17',
  note: 'Confirm opening hours and request recent test evidence.',
};
test('public inventory is genuinely sourced, paginated, bounded and requires no private reads', async () => {
  const api = createWaterApi({
    catalogue,
    store: new Proxy(
      {},
      {
        get() {
          throw Error('Private store touched');
        },
      },
    ),
  });
  const call = async (p) => {
    const r = await api(new Request('https://water.test/api/water/' + p), null);
    return { status: r.status, body: await r.json() };
  };
  const data = await call(
    `sources?latitude=${point.latitude}&longitude=${point.longitude}&radiusKm=1&limit=1`,
  );
  assert.equal(data.status, 200);
  assert.equal(data.body.points[0].id, point.id);
  assert.equal(data.body.points.length, 1);
  assert.ok(data.body.total >= 1);
  assert.equal(data.body.source.records, 20084);
  for (const query of [
    'latitude=&longitude=90',
    'latitude=abc&longitude=90',
    'latitude=91&longitude=90',
    'latitude=23&longitude=90&limit=0',
    'latitude=23&longitude=90&offset=.5',
  ])
    assert.equal((await call('sources?' + query)).status, 400);
  assert.equal((await call('source?id=made-up')).status, 404);
  assert.equal((await call('meta')).status, 200);
  assert.equal((await call('sites')).status, 200);
});
test('private checks persist, isolate actors, validate inputs and make retries idempotent', async (t) => {
  const db = database();
  t.after(() => db.close());
  const call = setup(db);
  assert.equal((await call('checks', 'POST', entry, null)).status, 401);
  assert.equal(
    (await call('checks', 'POST', entry, owner, { origin: 'https://evil.test' })).status,
    403,
  );
  const first = await call('checks', 'POST', entry);
  assert.equal(first.status, 201);
  const again = await call('checks', 'POST', entry);
  assert.equal(again.body.check.id, first.body.check.id);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='water-check.created'").get().n,
    1,
  );
  assert.equal((await call('checks')).body.checks.length, 1);
  assert.equal((await call('checks', 'GET', undefined, stranger)).body.checks.length, 0);
  assert.equal((await call('checks', 'POST', { ...entry, note: 'Changed' })).status, 409);
  for (const patch of [
    { status: 'safe' },
    { sourceId: 'invented' },
    { visitDate: '2026-02-30' },
    { visitDate: '2027-01-01' },
    { note: '' },
    { ownerId: 'stranger' },
  ])
    assert.equal(
      (await call('checks', 'POST', { ...entry, ...patch, clientId: 'retry-other-001' })).status,
      400,
    );
  assert.equal((await call('checks-export')).body.checks.length, 1);
});
test('append-only check survives reopening a file-backed database with generated migrations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'climate-water-'));
  let db;
  try {
    const file = join(dir, 'water.sqlite');
    db = new DatabaseSync(file);
    for (const name of readdirSync(new URL('../drizzle', import.meta.url))
      .filter((n) => n.endsWith('.sql'))
      .sort())
      db.exec(readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    const saved = await setup(db)('checks', 'POST', entry);
    assert.equal(saved.status, 201);
    db.close();
    db = new DatabaseSync(file);
    assert.equal((await setup(db)('checks')).body.checks[0].note, entry.note);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('site detail keeps dates and units, and connectivity cannot create a pollution certificate', async (t) => {
  const db = database();
  t.after(() => db.close());
  const call = setup(db);
  const site = catalogue.sites.find(
    (s) => s.river === 'Tongi Khal' && s.name === 'u/s Ijtema Field',
  );
  const result = await call('site?id=' + site.id);
  assert.equal(result.status, 200);
  assert.equal(result.body.site.latest.date, '2021-07-15');
  assert.equal(result.body.site.latest.do, 4.62);
  assert.equal(result.body.site.latest.units.do, 'mg/L');
  assert.ok(result.body.site.history.length > 1);
  assert.ok(result.body.limits.includes('do not establish'));
  assert.ok(result.body.site.channel.gapM <= 750);
  assert.equal((await call('streams?area=missing')).status, 404);
  const r = await call('streams?area=dhaka');
  assert.equal(r.body.ways.length, 2431);
  assert.ok(!('nodes' in r.body.ways[0]));
});
