/** Deterministic offline converter. Shared OSM node IDs, never intersecting pixels, create links. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectChannels } from '../src/platform/channel-topology.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

function publish(relativePath, payload) {
  const file = path.join(root, relativePath);
  const text = JSON.stringify(payload) + '\n';
  if (check) {
    if (readFileSync(file, 'utf8') !== text)
      throw Error('Shipped channel asset differs: ' + relativePath);
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  try {
    writeFileSync(temporary, text);
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

const regions = [];
for (const area of ['dhaka', 'sylhet', 'dacope']) {
  const folder = path.join(root, 'research/gis/waterways-v4', area);
  if (!existsSync(path.join(folder, 'osm.json'))) continue;
  const bytes = readFileSync(path.join(folder, 'osm.json')),
    raw = JSON.parse(bytes),
    source = JSON.parse(readFileSync(path.join(folder, 'source.json')));
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw Error('Source checksum mismatch: ' + area);
  const ways = raw.elements
    .filter((w) => w.type === 'way' && w.nodes?.length > 1 && w.geometry?.length === w.nodes.length)
    .map((w) => {
      const coordinates = w.geometry.map((p) => [p.lon, p.lat]);
      if (coordinates.some((p) => !p.every(Number.isFinite)))
        throw Error('Invalid source geometry');
      return {
        id: 'osm-' + w.id,
        osmId: w.id,
        name: w.tags?.['name:en'] || w.tags?.name || w.tags?.waterway || 'Unnamed channel',
        kind: w.tags?.waterway,
        tidal: w.tags?.tidal ?? 'unknown',
        flowDirection: w.tags?.flow_direction ?? 'unverified',
        nodes: w.nodes,
        geometry: { type: 'LineString', coordinates },
        bounds: [
          Math.min(...coordinates.map((p) => p[0])),
          Math.min(...coordinates.map((p) => p[1])),
          Math.max(...coordinates.map((p) => p[0])),
          Math.max(...coordinates.map((p) => p[1])),
        ],
      };
    })
    .sort((a, b) => a.osmId - b.osmId);
  const connected = connectChannels(ways, area);
  for (let i = 0; i < ways.length; i++) ways[i].component = connected.ways[i].component;
  const output = {
    schema: 'climateplus/waterways-v1',
    area,
    source,
    method:
      'Undirected connected components from shared OpenStreetMap node IDs, including internal nodes. No links at unshared crossings. No proximity edges or inferred transport.',
    maxMatchDistanceM: 750,
    components: connected.components,
    ways,
  };
  for (const base of ['public/data/streams', 'backend/data/streams']) {
    publish(path.join(base, area + '.json'), output);
  }
  regions.push({
    id: area,
    name: { dhaka: 'Dhaka rivers', sylhet: 'Sylhet channels', dacope: 'Dacope waterways' }[area],
    bounds: source.bounds,
    ways: ways.length,
    components: connected.components,
    url: '/data/streams/' + area + '.json',
    source,
  });
}
if (!regions.length) throw Error('No acquired source; acquire-waterways.py first.');
publish('public/data/streams/index.json', { schema: 'climateplus/waterways-index-v1', regions });
console.log(regions.map((r) => ({ id: r.id, ways: r.ways, components: r.components })));
