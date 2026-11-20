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
for (const area of ['dhaka', 'sylhet', 'dacope']) {
  const base = 'research/gis/waterways-v4/' + area,
    source = read(base + '/source.json'),
    file = digest(base + '/osm.json');
  const entry = {
    id: 'osm-' + area + '-waterways-v4',
    title: 'OpenStreetMap waterway snapshot: ' + area,
    doi: null,
    version: source.osmBaseTimestamp,
    authors: 'OpenStreetMap contributors',
    url: source.endpoint,
    license: 'ODbL 1.0; ' + source.licenseUrl,
    acquired: source.acquiredAt,
    path: file.path,
    size: source.ways + ' waterway ways; bbox ' + source.bounds.join(', '),
    period: 'OSM map snapshot ' + source.osmBaseTimestamp,
    used: 'Real channel geometry, shared-node map connectivity and explicit proximity association to historical samples.',
    transform:
      'scripts/build-waterways.mjs preserves way/node identities and coordinates; undirected components from shared nodes only. No edge at a geometric crossing or between nearby samples. Nearest-channel matching at most 750 m; original sample coordinates never moved.',
    limits:
      'Bounded mapping coverage, not current flow or contamination transport. Tides, barriers, map completeness, sample-channel identity and present field conditions are unverified. No pollutant propagation or emitter attribution is inferred.',
    bytes: file.bytes,
    sha256: file.sha256,
  };
  datasets = datasets.filter((d) => d.id !== entry.id);
  datasets.push(entry);
}
writeFileSync(path.join(root, 'DATASETS.json'), JSON.stringify(datasets, null, 2) + '\n');
const register = read('public/data/source-register.json');
register.sources = datasets;
register.waterPlatform = {
  version: '4.0.0',
  tasks: [
    'Find recorded water points',
    'Check historical river evidence and mapped channel connections',
    'Calculate rainwater storage and shortages',
  ],
  streams: '/data/streams/index.json',
  sourceSafety: 'unknown',
  privateRecords: 'User-owned self-reported checks and measurements; no independent certification.',
};
writeFileSync(path.join(root, 'public/data/source-register.json'), JSON.stringify(register) + '\n');
const manifest = read('DATA-MANIFEST.json'),
  files = new Map(manifest.files.map((f) => [f.path, f]));
function walk(relative) {
  for (const name of readdirSync(path.join(root, relative))) {
    const p = relative + '/' + name;
    if (statSync(path.join(root, p)).isDirectory()) walk(p);
    else files.set(p, digest(p));
  }
}
for (const folder of ['research/gis/waterways-v4', 'backend/data/streams', 'public/data/streams'])
  walk(folder);
files.set('public/data/source-register.json', digest('public/data/source-register.json'));
manifest.files = [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
manifest.meaning =
  'Frozen original sources, derived assets and references. Hashes establish byte identity, not physical truth. V4 adds real bounded waterways and shared-node connections without inventing flow or relocating measurements.';
writeFileSync(path.join(root, 'DATA-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(datasets.length + ' registered sources; ' + manifest.files.length + ' frozen assets.');
