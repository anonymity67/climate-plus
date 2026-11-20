/** Register intentionally added V3 snapshots and derived regional assets without changing raw bytes. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const digest = (p) => {
  const b = readFileSync(path.join(root, p));
  return { path: p, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
};
let datasets = read('DATASETS.json');
for (const id of ['ukhia', 'chattogram', 'khulna', 'tongi']) {
  const base = `research/gis/regions-v3/${id}`,
    source = read(`${base}/source.json`),
    raw = read(`${base}/${source.responseFile}`),
    f = digest(`${base}/${source.responseFile}`);
  const entry = {
    id: `osm-${id}-roads-v3`,
    title: `OpenStreetMap road snapshot: ${source.name}`,
    doi: null,
    version: source.osmBaseTimestamp,
    authors: 'OpenStreetMap contributors',
    url: source.requestUrl,
    license: `${source.licence}; ${source.licenceUrl}`,
    acquired: source.acquiredAt,
    path: f.path,
    size: `${raw.elements.filter((e) => e.type === 'way').length} source road ways; bounded WGS84 extent ${source.bounds.join(', ')}`,
    period: `OSM base timestamp ${source.osmBaseTimestamp}; retrieval is not a road-condition assessment`,
    used: 'Real local road geometry for V3 expandable scenario routes; invented service roles and hazards stay representational',
    transform:
      'scripts/build-regions.py clips source roads to recorded bounds, preserves supported road classes, source node coordinates, one-way and grade tags, then reuses the documented shared-vertex graph builder; scenario nodes selected on local connected roads',
    limits:
      'Limited demonstration extent, not full city coverage. OSM age/completeness, vehicle access, traffic, flood conditions and bridge capacity unverified. Scenario polygons are not live hazards; no safe route or drinking-water clearance follows.',
    bytes: f.bytes,
    sha256: f.sha256,
  };
  datasets = datasets.filter((d) => d.id !== entry.id);
  datasets.push(entry);
}
const dacope = datasets.find((d) => d.id === 'gis-dacope-network-v1');
dacope.used =
  'Antar Dacope calamity service-point template, retained historical library, and real road graph used by V3 response map and private operations';
dacope.transform +=
  ' V3 preserves Antar handoff-v2 service coordinates/hazard vertices; source references/hashes are retained at research/gis/antar-v2. Other towns use independent OSM roads, not translated Dacope geometry.';
// Avoid duplicating the audit sentence on repeated registration.
dacope.transform = dacope.transform.replace(
  /( V3 preserves Antar handoff-v2 service coordinates\/hazard vertices; source references\/hashes are retained at research\/gis\/antar-v2\. Other towns use independent OSM roads, not translated Dacope geometry\.)+/g,
  '$1',
);
writeFileSync(path.join(root, 'DATASETS.json'), JSON.stringify(datasets, null, 2) + '\n');
const register = read('public/data/source-register.json');
register.sources = datasets;
register.regionalExpansion = {
  index: '/data/regions/index.json',
  meaning:
    'Five bounded real road regions; six fictional service roles in each. Original pollution coordinates are never relocated.',
  assetTruth: 'Scenario assets/hazards, not surveyed facilities or live warnings',
  pollutionInput:
    'Validated CSV/GeoJSON point fields and authenticated private observations; entered values not independently authenticated',
};
writeFileSync(path.join(root, 'public/data/source-register.json'), JSON.stringify(register) + '\n');
const manifest = read('DATA-MANIFEST.json'),
  files = new Map(manifest.files.map((f) => [f.path, f]));
function walk(relative) {
  for (const name of readdirSync(path.join(root, relative))) {
    const p = relative + '/' + name;
    if (statSync(path.join(root, p)).isDirectory()) walk(p);
    else if (!p.includes('__pycache__')) files.set(p, digest(p));
  }
}
for (const p of [
  'research/gis/regions-v3',
  'research/gis/antar-v2',
  'public/data/regions',
  'backend/data/regions',
  'public/examples',
])
  walk(p);
files.set('public/data/source-register.json', digest('public/data/source-register.json'));
manifest.files = [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
manifest.meaning =
  'Frozen source, derived and reference assets; hashes establish byte identity, not measurement truth. V3 adds bounded regional road snapshots and preserves original pollution coordinates.';
writeFileSync(path.join(root, 'DATA-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `${datasets.length} dataset sources; ${manifest.files.length} frozen source/derived/reference files registered.`,
);
