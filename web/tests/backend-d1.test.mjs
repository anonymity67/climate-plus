import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createD1Store } from '../backend/store.mjs';
import { createApi } from '../backend/api.mjs';

test('real local D1 persists API records across runtime restart and rolls back failed batches', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'climate-d1-'));
  const options = convertV4MiniflareOptions({
    modules: true,
    script: "export default {fetch(){return new Response('test')}}",
    compatibilityDate: '2026-05-01',
    d1Databases: { DB: 'climate-test' },
  });
  // Miniflare5 uses one explicit resource persistence root; the V4 converter
  // intentionally does not translate the old per-plugin d1Persist option.
  options.resourcePersistencePath = directory;
  let runtime;
  try {
    runtime = new Miniflare(options);
    const database = await runtime.getD1Database('DB'),
      store = createD1Store(database);
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      const migration = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8');
      await database.batch(
        migration
          .split('--> statement-breakpoint')
          .map((sql) => sql.trim())
          .filter(Boolean)
          .map((sql) => database.prepare(sql)),
      );
      if (file.startsWith('0000_'))
        await database
          .prepare(
            'INSERT INTO trips(id,owner_id,name,mode,origin_json,destination_json,speed,profile,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            'before-v3',
            'owner',
            'D1 trip before regional migration',
            'replay',
            '{}',
            '{}',
            25,
            'road',
            '2026-10-24',
            '2026-10-24',
          )
          .run();
    }
    const api = createApi({
      store,
      routing: { metadata: { edgeIds: ['a'], graphVersion: 'test' } },
      catalogue: { assets: [] },
    });
    const response = await api(
      new Request('https://climate.test/api/trips', {
        method: 'POST',
        headers: { origin: 'https://climate.test', 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Persistent D1 trip',
          mode: 'operational',
          origin: {
            latitude: 22.5,
            longitude: 89.4,
            label: 'A',
            provenance: 'representational test',
          },
          destination: {
            latitude: 22.6,
            longitude: 89.5,
            label: 'B',
            provenance: 'representational test',
          },
        }),
      }),
      { id: 'owner' },
    );
    assert.equal(response.status, 201);
    const { trip } = await response.json();
    assert.equal(trip.regionId, 'dacope');
    await assert.rejects(
      store.batch([
        { sql: 'DELETE FROM events WHERE trip_id=?', params: [trip.id] },
        { sql: 'INSERT INTO table_that_does_not_exist VALUES(?)', params: ['fail'] },
      ]),
    );
    assert.equal(
      (await store.get('SELECT count(*) AS n FROM events WHERE trip_id=?', [trip.id])).n,
      1,
    );
    const catalogue = await (
      await api(new Request('https://climate.test/api/catalogue'), null)
    ).json();
    assert.equal(catalogue.routing.edgeIds, undefined);
    await runtime.dispose();
    runtime = new Miniflare(options);
    const reopened = createD1Store(await runtime.getD1Database('DB'));
    assert.equal(
      (await reopened.get('SELECT region_id FROM trips WHERE id=?', ['before-v3'])).region_id,
      'dacope',
    );
    assert.equal(
      (await reopened.get('SELECT region_id FROM trips WHERE id=?', [trip.id])).region_id,
      'dacope',
    );
    assert.equal(
      (await reopened.get('SELECT name FROM trips WHERE id=?', [trip.id])).name,
      'Persistent D1 trip',
    );
    assert.equal(
      (await reopened.all('SELECT user_id FROM memberships WHERE trip_id=?', [trip.id]))[0].user_id,
      'owner',
    );
  } finally {
    if (runtime) await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
