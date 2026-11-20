import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildPublishedVectors,
  observationsToFeatures,
  parsePointUpload,
} from '../src/mvp/pollution-vectors.mjs';
const bounds = [90.3, 23.8, 90.5, 24];
const header = 'date,latitude,longitude,ph,do_mg_l,cod_mg_l,source';
const csv = `${header}\n2025-10-01,23.9,90.4,7,,0,"Team, test only"`;
const options = { sourceKind: 'representational', bounds };
const measured = {
  id: 'DHA-1',
  date: '2020-01-01',
  latitude: 23.9,
  longitude: 90.4,
  location: 'Original station',
  river: 'Tongi Khal',
  ph: 7,
  do: 0,
  cod: 80,
  units: { do: 'mg/L', cod: 'mg/L' },
};
const source = {
  id: 'dhaka',
  authors: 'Dataset author',
  url: 'https://example.org/source',
  sha256: 'abc',
};
const context = {
  fields: ['id', 'latitude', 'longitude', 'publisherValue', 'publisherClass'],
  rows: [['KAG-1', 23.91, 90.41, 3.1, 'High']],
  provider: 'Publisher',
  url: 'https://example.org/context',
};

test('published vectors keep latest original record at each exact coordinate and count the hidden history', () => {
  assert.equal(typeof buildPublishedVectors, 'function');
  const latest = {
    ...measured,
    id: 'DHA-2',
    date: '2021-01-01',
    ph: 8,
    location: 'Renamed station',
  };
  const result = buildPublishedVectors(
    {
      observations: [latest, measured, { ...latest, id: 'bad', date: '2025-02-30' }],
      sources: [source],
    },
    context,
    bounds,
  );
  assert.equal(result.features.length, 2);
  const point = result.features[0];
  assert.deepEqual(point.geometry.coordinates, [90.4, 23.9]);
  assert.equal(point.properties.id, 'DHA-2');
  assert.equal(point.properties.ph, 8);
  assert.equal(point.properties.location, 'Renamed station');
  assert.equal(point.properties.sourceKey, 'dhaka');
  assert.deepEqual(point.properties.originalRecord, latest);
  assert.equal(point.properties.recordCount, 2);
  assert.equal(result.counts.historicalOtherRecords, 1);
  assert.equal(result.counts.invalidMeasuredRecords, 1);
});

test('publisher context never supplies a measurement or date and absent regional coverage stays empty', () => {
  const result = buildPublishedVectors(
    { observations: [measured], sources: [source] },
    context,
    bounds,
  );
  const p = result.features.find((f) => f.properties.sourceKind === 'publisher-context').properties;
  assert.equal(p.contextClass, 'High');
  assert.equal(p.publisherValue, 3.1);
  assert.equal(p.date, null);
  assert.equal(p.units, null);
  for (const field of ['ph', 'do', 'cod', 'screening', 'healthRating'])
    assert.equal(p[field], undefined);
  assert.equal(
    buildPublishedVectors({ observations: [measured] }, context, [89, 22, 89.5, 22.5]).features
      .length,
    0,
  );
});

test('published context cap reports records omitted without changing point geometry', () => {
  const rows = Array.from({ length: 1600 }, (_, i) => [
    `KAG-${i}`,
    23.9,
    90.4 + i * 0.000001,
    3,
    'High',
  ]);
  const result = buildPublishedVectors(null, { ...context, rows }, bounds);
  assert.equal(result.features.length, 1500);
  assert.equal(result.counts.contextInBounds, 1600);
  assert.equal(result.counts.omittedByCap, 100);
  assert.deepEqual(result.features[1499].geometry.coordinates, [90.401499, 23.9]);
});

test('private persisted observations retain provenance, hashes and partial screening', () => {
  const row = {
    ...measured,
    id: 'private-1',
    metadata: {
      sourceKind: 'field-entry',
      sourceLabel: 'Field team',
      method: 'Probe',
      evidenceUrl: 'https://example.org/evidence',
    },
    contentHash: 'content-hash',
    createdAt: '2025-10-01T01:00:00Z',
  };
  const [feature] = observationsToFeatures([row], bounds);
  assert.equal(feature.properties.sourceKind, 'field-entry');
  assert.equal(feature.properties.contentHash, 'content-hash');
  assert.deepEqual(feature.properties.metadata, row.metadata);
  assert.equal(feature.properties.screening.overallStatus, 'partial-screen');
  assert.equal(feature.properties.safeToDrink, undefined);
  assert.equal(observationsToFeatures([row], [88, 20, 89, 21]).length, 0);
});

test('CSV imports quoted attribution, preserves zero, and never turns missing measurements into zero', () => {
  const result = parsePointUpload(csv, options);
  assert.equal(result.observations.length, 1);
  const row = result.observations[0];
  assert.equal(row.ph, 7);
  assert.equal(row.cod, 0);
  assert.equal(row.do, undefined);
  assert.deepEqual(row.units, { cod: 'mg/L' });
  assert.equal(row.metadata.sourceLabel, 'Team, test only');
  assert.equal(result.features[0].properties.inBounds, true);
  assert.equal(result.features[0].properties.sourceKind, 'representational');
});

test('CSV batch validation rejects the whole upload with row and field context', () => {
  assert.throws(
    () => parsePointUpload(`${csv}\n2025-01-01,23.9,90.4,15,,,Team`, options),
    /row 3.*ph/i,
  );
  for (const [row, field] of [
    ['2025-02-30,23.9,90.4,7,,,Team', 'date'],
    ['2099-01-01,23.9,90.4,7,,,Team', 'future'],
    ['2025-01-01,,90.4,7,,,Team', 'latitude'],
    ['2025-01-01,91,90.4,7,,,Team', 'WGS84'],
    ['2025-01-01,23.9,90.4,,31,,Team', 'do'],
    ['2025-01-01,23.9,90.4,,,-1,Team', 'cod'],
    ['2025-01-01,23.9,90.4,,,,Team', 'parameter'],
    ['2025-01-01,23.9,90.4,7,,,', 'source'],
    ['2025-01-01,23.9,90.4,=7,,,Team', 'ph'],
  ])
    assert.throws(
      () => parsePointUpload(`${header}\n${row}`, options),
      new RegExp(`row 2.*${field}`, 'i'),
    );
  assert.throws(() => parsePointUpload(csv), /sourceKind/);
  assert.throws(
    () => parsePointUpload(csv.replace('"Team, test only"', '"unclosed'), options),
    /CSV.*row 2/i,
  );
});

test('CSV honors escaped quotes and rejects duplicate or ambiguous unit headers', () => {
  const result = parsePointUpload(csv.replace('"Team, test only"', '"Team ""A"", test"'), options);
  assert.equal(result.observations[0].metadata.sourceLabel, 'Team "A", test');
  assert.throws(() => parsePointUpload(csv.replace('do_mg_l', 'do'), options), /header.*do/i);
  assert.throws(() => parsePointUpload(csv.replace('do_mg_l', 'ph'), options), /duplicate/i);
});

const geo = (props = {}, geometry = { type: 'Point', coordinates: [90.4, 23.9] }) =>
  JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry,
        properties: {
          date: '2025-01-01',
          ph: 7,
          do: 2,
          units: { do: 'mg/L' },
          sourceLabel: 'Test data only',
          sourceKind: 'representational',
          ...props,
        },
      },
    ],
  });
test('GeoJSON validates Point coordinates, numeric measurement types, units, attribution and explicit provenance', () => {
  const result = parsePointUpload(geo(), { bounds });
  assert.deepEqual(result.features[0].geometry.coordinates, [90.4, 23.9]);
  assert.equal(result.observations[0].do, 2);
  assert.throws(() => parsePointUpload(geo({ units: { do: 'ppm' } })), /feature 1.*do.*mg\/L/i);
  assert.throws(() => parsePointUpload(geo({ do: '2' })), /feature 1.*do/i);
  assert.throws(
    () =>
      parsePointUpload(
        geo(
          {},
          {
            type: 'LineString',
            coordinates: [
              [90.4, 23.9],
              [90.5, 24],
            ],
          },
        ),
      ),
    /feature 1.*Point/i,
  );
  assert.throws(
    () => parsePointUpload(geo({}, { type: 'Point', coordinates: ['90.4', 23.9] })),
    /feature 1.*coordinate/i,
  );
  assert.throws(() => parsePointUpload(geo({ sourceKind: 'verified-lab' })), /sourceKind/);
  assert.throws(() => parsePointUpload(geo({ sourceLabel: '' })), /sourceLabel/);
});

test('out-of-region imports remain at supplied coordinates with explicit visibility state', () => {
  const result = parsePointUpload(csv, { ...options, bounds: [89, 22, 89.5, 22.5] });
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].properties.inBounds, false);
  assert.deepEqual(result.features[0].geometry.coordinates, [90.4, 23.9]);
});

test('uploads are bounded and empty batches never succeed', () => {
  assert.throws(() => parsePointUpload(' '.repeat(1048577), options), /1 MiB/);
  assert.throws(
    () =>
      parsePointUpload(
        `${header}\n${Array(201).fill('2025-01-01,23.9,90.4,7,,,Team').join('\n')}`,
        options,
      ),
    /200/,
  );
  assert.throws(() => parsePointUpload(header, options), /no.*rows/i);
  assert.throws(
    () => parsePointUpload(JSON.stringify({ type: 'FeatureCollection', features: [] })),
    /no.*features/i,
  );
  assert.throws(() => parsePointUpload(geo({ sourceLabel: 'বাংলা'.repeat(120000) })), /1 MiB/);
  const collection = JSON.parse(geo());
  collection.features = Array(201).fill(collection.features[0]);
  assert.throws(() => parsePointUpload(JSON.stringify(collection)), /200/);
});

test('upload optional provenance reaches POST data and evidence URL protocols stay bounded', () => {
  const [row] = parsePointUpload(
    geo({
      method: 'Calibrated probe, unverified entry',
      evidenceUrl: 'https://example.org/sample',
      location: '<b>literal label</b>',
      river: 'River',
    }),
  ).observations;
  assert.equal(row.metadata.method, 'Calibrated probe, unverified entry');
  assert.equal(row.metadata.evidenceUrl, 'https://example.org/sample');
  assert.equal(row.location, '<b>literal label</b>');
  assert.throws(() => parsePointUpload(geo({ evidenceUrl: 'javascript:alert(1)' })), /evidenceUrl/);
  assert.throws(
    () => parsePointUpload(geo({ evidenceUrl: 'https://user:pass@example.org' })),
    /evidenceUrl/,
  );
});

test('real packaged datasets retain their source measurements and do not invent Dacope coverage', async () => {
  const water = JSON.parse(
    await readFile(new URL('../public/data/water-evidence.json', import.meta.url)),
  );
  const river = JSON.parse(
    await readFile(new URL('../public/data/river-pollution-context.json', import.meta.url)),
  );
  const result = buildPublishedVectors(water, river);
  assert.equal(result.counts.measuredSites, 58);
  assert.equal(result.counts.measuredRecords, 1495);
  assert.equal(result.counts.contextRecords, 9958);
  assert.equal(
    result.features[0].properties.sourceUrl,
    'https://data.mendeley.com/datasets/xftpv7jvx3/1',
  );
  assert.equal(buildPublishedVectors(water, river, [89.45, 22.5, 89.6, 22.65]).features.length, 0);
});
