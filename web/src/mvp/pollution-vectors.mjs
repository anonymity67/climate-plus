import { screenWater, validateObservation } from '../water-engine.mjs';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const coordinatesValid = (row) =>
  finite(row?.latitude) &&
  finite(row?.longitude) &&
  Math.abs(row.latitude) <= 90 &&
  Math.abs(row.longitude) <= 180;
const MAX_FEATURES = 1500;
const SOURCE_KINDS = ['field-entry', 'representational'];

function checkBounds(bounds) {
  if (bounds == null) return;
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    !bounds.every(finite) ||
    bounds[0] < -180 ||
    bounds[2] > 180 ||
    bounds[1] < -90 ||
    bounds[3] > 90 ||
    bounds[0] > bounds[2] ||
    bounds[1] > bounds[3]
  )
    throw Error('Bounds must be [west,south,east,north] in WGS84.');
}
function inside(row, bounds) {
  return (
    !bounds ||
    (row.longitude >= bounds[0] &&
      row.longitude <= bounds[2] &&
      row.latitude >= bounds[1] &&
      row.latitude <= bounds[3])
  );
}
function point(row, properties) {
  return {
    type: 'Feature',
    id: properties.id,
    geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
    properties,
  };
}
function measuredProperties(row) {
  return {
    id: row.id,
    name: row.location || row.site || row.river || 'Water observation',
    date: row.date,
    location: row.location,
    river: row.river,
    ...Object.fromEntries(
      ['ph', 'do', 'cod'].filter((key) => row[key] != null).map((key) => [key, row[key]]),
    ),
    units: row.units,
    screening: screenWater(row),
  };
}

/** Latest valid original measurement per exact coordinate, followed by publisher context. */
export function buildPublishedVectors(waterEvidence, riverContext, bounds) {
  checkBounds(bounds);
  const rows = Array.isArray(waterEvidence?.observations) ? waterEvidence.observations : [];
  const contextRows = Array.isArray(riverContext?.rows) ? riverContext.rows : [];
  const counts = {
    measuredRecords: rows.length,
    validMeasuredRecords: 0,
    invalidMeasuredRecords: 0,
    measuredSites: 0,
    measuredInBounds: 0,
    measuredShown: 0,
    historicalOtherRecords: 0,
    contextRecords: contextRows.length,
    invalidContextRecords: 0,
    contextInBounds: 0,
    contextShown: 0,
    omittedByCap: 0,
  };
  const sites = new Map();
  for (const row of rows) {
    if (!validateObservation(row).valid) {
      counts.invalidMeasuredRecords++;
      continue;
    }
    counts.validMeasuredRecords++;
    const key = `${row.longitude},${row.latitude}`;
    const site = sites.get(key);
    if (!site) sites.set(key, { row, count: 1 });
    else {
      site.count++;
      // On equal dates retain input order: no fabricated temporal precision.
      if (row.date > site.row.date) site.row = row;
    }
  }
  counts.measuredSites = sites.size;
  counts.historicalOtherRecords = counts.validMeasuredRecords - sites.size;
  const features = [];
  for (const { row, count } of sites.values()) {
    if (!inside(row, bounds)) continue;
    counts.measuredInBounds++;
    if (features.length >= MAX_FEATURES) {
      counts.omittedByCap++;
      continue;
    }
    // DHA is the explicit observation namespace of the packaged Dhaka source.
    // Unknown namespaces retain unknown attribution rather than borrowing another source.
    const sourceKey = row.sourceKey || (String(row.id).startsWith('DHA-') ? 'dhaka' : null);
    const source = waterEvidence?.sources?.find((item) => item.id === sourceKey);
    features.push(
      point(row, {
        ...measuredProperties(row),
        sourceKind: 'historical-measurement',
        sourceLabel:
          source?.authors || row.provenance || 'Published measurement; attribution unavailable',
        sourceKey,
        sourceUrl: source?.url || null,
        sourceHash: source?.sha256 || null,
        verification: 'repository-published-original-lab-qa-not-supplied',
        reason:
          'Latest valid dated source record at this exact coordinate. Historical partial screening; current conditions and potability are unknown.',
        recordCount: count,
        otherRecordCount: count - 1,
        originalRecord: row,
        inBounds: true,
      }),
    );
    counts.measuredShown++;
  }
  const fields = riverContext?.fields || [];
  for (const packed of contextRows) {
    const row = Array.isArray(packed)
      ? Object.fromEntries(fields.map((key, index) => [key, packed[index]]))
      : packed;
    if (!coordinatesValid(row)) {
      counts.invalidContextRecords++;
      continue;
    }
    if (!inside(row, bounds)) continue;
    counts.contextInBounds++;
    if (features.length >= MAX_FEATURES) {
      counts.omittedByCap++;
      continue;
    }
    features.push(
      point(row, {
        id: row.id,
        name: `Publisher context ${row.id}`,
        sourceKind: 'publisher-context',
        sourceLabel: riverContext?.provider || 'Publisher context',
        sourceKey: 'kaggle-river-context',
        sourceUrl: riverContext?.url || null,
        sourceHash: riverContext?.rawSha256 || null,
        date: null,
        units: null,
        contextClass: row.publisherClass || 'Unclassified',
        publisherValue: row.publisherValue,
        verification: 'publisher-classification-unverified',
        reason:
          riverContext?.qualification ||
          'Publisher classification only; sampling date, pollutant units and laboratory validation are unknown. No health rating or contamination boundary is inferred.',
        originalRecord: row,
        inBounds: true,
      }),
    );
    counts.contextShown++;
  }
  return { features, counts };
}

function privateFeature(row, bounds, index) {
  const metadata = row.metadata || {};
  return point(row, {
    ...measuredProperties(row),
    id: row.id || `import-${index + 1}`,
    sourceKind: metadata.sourceKind || 'field-entry',
    sourceLabel: metadata.sourceLabel || 'Private observation; attribution unavailable',
    sourceUrl: metadata.evidenceUrl || null,
    metadata,
    contentHash: row.contentHash || null,
    createdAt: row.createdAt || null,
    verification: row.verification || 'entered-result-not-authenticated-lab-evidence',
    reason:
      metadata.sourceKind === 'representational'
        ? 'Representational input for demonstrating the workflow; not an actual sample claim.'
        : 'Entered result; original laboratory evidence and current conditions are not independently verified. Partial screening does not establish potability.',
    inBounds: inside(row, bounds),
  });
}

/** Private API rows are flattened observations with nested provenance metadata. */
export function observationsToFeatures(rows, bounds) {
  checkBounds(bounds);
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => validateObservation(row).valid && inside(row, bounds))
    .map((row, index) => privateFeature(row, bounds, index));
}

function fail(place, message) {
  throw Error(`${place}: ${message}`);
}
function textLabel(value, field, place, max = 500, required = false) {
  if (value == null && !required) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(
      place,
      `${field} must be ${required ? 'nonempty ' : ''}text of at most ${max} characters.`,
    );
  return value.trim();
}
function decimal(value, field, place, required = false) {
  if (typeof value !== 'string') fail(place, `${field} must be a decimal number.`);
  const trimmed = value.trim();
  if (!trimmed && !required) return undefined;
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed) ||
    !Number.isFinite(Number(trimmed))
  )
    fail(place, `${field} must be a finite decimal number.`);
  return Number(trimmed);
}

// Small strict CSV reader: quoted commas/newlines and doubled quotes; no permissive repair.
function csvRecords(text) {
  const records = [];
  let record = [],
    value = '',
    state = 'start',
    line = 1,
    recordLine = 1;
  const field = () => {
    record.push(value);
    value = '';
    state = 'start';
  };
  const finish = () => {
    field();
    if (record.some((part) => part.trim())) records.push({ cells: record, line: recordLine });
    record = [];
    recordLine = line + 1;
  };
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else state = 'closed';
      } else {
        value += ch;
        if (ch === '\n') line++;
      }
      continue;
    }
    if (ch === ',') {
      field();
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[index + 1] === '\n') index++;
      finish();
      line++;
      continue;
    }
    if (state === 'closed') fail(`CSV row ${line}`, 'Unexpected character after a closing quote.');
    if (ch === '"') {
      if (state !== 'start') fail(`CSV row ${line}`, 'Quote must begin a field.');
      state = 'quoted';
    } else {
      value += ch;
      state = 'plain';
    }
  }
  if (state === 'quoted') fail(`CSV row ${recordLine}`, 'Unclosed quoted field.');
  if (record.length || value.length || state === 'closed') finish();
  return records;
}

function normalizeObservation(row, options, place) {
  const sourceKind = row.sourceKind ?? options.sourceKind;
  if (!SOURCE_KINDS.includes(sourceKind))
    fail(place, 'sourceKind must explicitly declare field-entry or representational.');
  const metadata = {
    sourceKind,
    sourceLabel: textLabel(
      row.sourceLabel ?? options.sourceLabel,
      'sourceLabel/source',
      place,
      500,
      true,
    ),
  };
  for (const key of ['method', 'evidenceUrl']) {
    const value = textLabel(row[key] ?? options[key], key, place);
    if (value !== undefined) metadata[key] = value;
  }
  if (metadata.evidenceUrl) {
    let url;
    try {
      url = new URL(metadata.evidenceUrl);
    } catch {
      fail(place, 'evidenceUrl must be an http/https URL.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      fail(place, 'evidenceUrl must be an http/https URL without credentials.');
  }
  const observation = {
    date: row.date,
    latitude: row.latitude,
    longitude: row.longitude,
    units: row.units || {},
    metadata,
  };
  for (const key of ['ph', 'do', 'cod']) if (row[key] != null) observation[key] = row[key];
  for (const key of ['location', 'river']) {
    if (row[key] != null) observation[key] = textLabel(row[key], key, place, 200);
  }
  const validation = validateObservation(observation);
  if (!validation.valid) fail(place, validation.errors.join(' '));
  return observation;
}

function readCsv(text, options) {
  const records = csvRecords(text);
  if (records.length < 2) throw Error('CSV has no data rows.');
  const headers = records[0].cells.map((cell) => cell.trim());
  if (new Set(headers).size !== headers.length)
    throw Error('CSV header contains duplicate fields.');
  const required = ['date', 'latitude', 'longitude', 'ph', 'do_mg_l', 'cod_mg_l', 'source'];
  const optional = ['sourceKind', 'location', 'river', 'method', 'evidenceUrl'];
  if (
    required.some((key) => !headers.includes(key)) ||
    headers.some((key) => ![...required, ...optional].includes(key))
  )
    throw Error(
      'CSV header must contain date,latitude,longitude,ph,do_mg_l,cod_mg_l,source; do/cod require explicit mg/L headers.',
    );
  if (records.length - 1 > 200) throw Error('Upload exceeds 200 rows.');
  return records.slice(1).map(({ cells, line }) => {
    const place = `CSV row ${line}`;
    if (cells.length !== headers.length)
      fail(place, `Expected ${headers.length} fields, received ${cells.length}.`);
    const raw = Object.fromEntries(headers.map((key, index) => [key, cells[index]]));
    const row = { ...raw, sourceLabel: raw.source, units: {} };
    for (const key of ['latitude', 'longitude']) row[key] = decimal(raw[key], key, place, true);
    for (const [key, header] of [
      ['ph', 'ph'],
      ['do', 'do_mg_l'],
      ['cod', 'cod_mg_l'],
    ]) {
      row[key] = decimal(raw[header], key, place);
      if (key !== 'ph' && row[key] !== undefined) row.units[key] = 'mg/L';
    }
    return normalizeObservation(row, options, place);
  });
}

function readGeoJson(text, options) {
  let collection;
  try {
    collection = JSON.parse(text);
  } catch {
    throw Error('GeoJSON must be valid JSON.');
  }
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features))
    throw Error('GeoJSON must be a FeatureCollection.');
  if (!collection.features.length) throw Error('GeoJSON has no features.');
  if (collection.features.length > 200) throw Error('Upload exceeds 200 features.');
  if (collection.crs != null)
    throw Error('GeoJSON must use WGS84 coordinates without a custom CRS.');
  return collection.features.map((feature, index) => {
    const place = `GeoJSON feature ${index + 1}`;
    if (feature?.type !== 'Feature' || feature.geometry?.type !== 'Point')
      fail(place, 'A Point Feature is required.');
    const xy = feature.geometry.coordinates;
    if (!Array.isArray(xy) || xy.length !== 2 || !xy.every(finite))
      fail(place, 'Point coordinates must be exactly two finite numbers [longitude,latitude].');
    const properties = feature.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties))
      fail(place, 'properties object is required.');
    return normalizeObservation(
      { ...properties, longitude: xy[0], latitude: xy[1] },
      options,
      place,
    );
  });
}

/** Validate the whole bounded file before returning any POST-ready observations. */
export function parsePointUpload(text, options = {}) {
  if (typeof text !== 'string') throw Error('Upload must be text.');
  if (new TextEncoder().encode(text).byteLength > 1048576) throw Error('Upload exceeds 1 MiB.');
  checkBounds(options.bounds);
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw Error('Upload is empty.');
  const format = options.format?.toLowerCase();
  if (format && !['csv', 'geojson', 'json'].includes(format))
    throw Error('Upload format must be CSV or GeoJSON.');
  const isJson = ['geojson', 'json'].includes(format) || (!format && /^[{[]/.test(clean));
  const observations = isJson ? readGeoJson(clean, options) : readCsv(clean, options);
  return {
    observations,
    features: observations.map((row, index) => privateFeature(row, options.bounds, index)),
  };
}
