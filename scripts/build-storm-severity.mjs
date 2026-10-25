/**
 * Deterministic storm-severity layer for the five response regions.
 *
 *   node scripts/build-storm-severity.mjs           write the scenario files and update DATA-MANIFEST.json
 *   node scripts/build-storm-severity.mjs --root DIR   operate on another tree (used by the builder test)
 *   node scripts/build-storm-severity.mjs --check   fail if the committed files differ from a rebuild
 *
 * Dacope keeps the original Antar storm polygons. The roads touching each polygon become that
 * severity's declared closure, so detours come from the polygon, as in the QGIS run (moderate
 * 1.42x, severe 2.01x the clear trip). The four new regions have small, sparse road extents where
 * closing roads leaves no route at all, so their storm polygons instead SLOW the roads inside
 * them (moderate 50% speed, severe 20% speed). Polygons are octagons placed on the supplier to
 * reserve route; their radius is the smallest in RADII_M that reaches the target delay.
 * Everything is a scenario assumption: nothing here is a flood model or a measured road state.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRoutingEngine } from '../src/routing/engine.mjs';
import {
  applyStormDelay,
  classifyDelay,
  edgesTouching,
} from '../src/response-map/mvp/storm-delay.mjs';

const rootArg = process.argv.indexOf('--root');
const root =
  rootArg > 0
    ? path.resolve(process.argv[rootArg + 1]) + path.sep
    : fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const REGIONS = ['dacope', 'ukhia', 'chattogram', 'khulna', 'tongi'];
const SPEED = { moderate: 0.5, severe: 0.2 };
const TARGET = { moderate: 1.3, severe: 2.0 }; // modelled time vs the clear trip
const FRACTIONS = [0.5, 0.35, 0.65, 0.3, 0.7];
const RADII_M = [40, 60, 80, 100, 125, 150, 180, 220, 260, 320, 380, 450, 550, 650];
const DRIVE = { assumedSpeedKmh: 25, profile: 'road' };

const sortKeys = (o) =>
  Array.isArray(o)
    ? o.map(sortKeys)
    : o && typeof o === 'object'
      ? Object.fromEntries(
          Object.keys(o)
            .sort()
            .map((k) => [k, sortKeys(o[k])]),
        )
      : o;
const serialise = (o) => JSON.stringify(sortKeys(o)) + '\n';
const octagon = (c, metres) => {
  const lat = metres / 111320,
    lon = metres / (111320 * Math.cos((c[1] * Math.PI) / 180));
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return [+(c[0] + lon * Math.cos(a)).toFixed(6), +(c[1] + lat * Math.sin(a)).toFixed(6)];
  });
  return [...ring, ring[0]];
};
const polygon = (properties, ring) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties,
});
const asset = (scenario, role) => scenario.assets.find((a) => a.role === role);

function buildDacope(scenario, graph) {
  const edges = {};
  for (const severity of ['moderate', 'severe']) {
    edges[severity] = edgesTouching(graph.edges, scenario.hazards.storm[severity]);
    scenario.closures.storm[severity] = {
      edgeIds: edges[severity],
      provenance: 'representational',
      sourceLabel:
        'Declared closure: every road segment touching the Antar scenario storm polygon; not derived flood impact',
    };
  }
  const engine = createRoutingEngine(graph);
  const trip = {
    origin: asset(scenario, 'supplier'),
    destination: asset(scenario, 'reserve'),
    ...DRIVE,
  };
  const clear = engine.route(trip);
  const result = {};
  for (const severity of ['moderate', 'severe']) {
    const closed = engine.route({ ...trip, closures: [{ edgeIds: edges[severity] }] });
    if (closed.status !== 'ok') throw Error(`Dacope ${severity} closure leaves no route`);
    result[severity] = {
      status: classifyDelay(closed, clear).status,
      factor: classifyDelay(closed, clear).factor,
      distanceM: closed.routes[0].distanceM,
    };
  }
  scenario.source.hazardMeaning =
    'Fictional scenario polygons from the Antar handoff. Roads touching a storm polygon are closed (declared scenario assumption); the polygon is not a flood-impact model. Moderate and severe use different polygons and therefore different detours.';
  scenario.source.routeVerification = {
    ...scenario.source.routeVerification,
    baselineDistanceM: clear.routes[0].distanceM,
    closureDistanceM: result.moderate.distanceM,
    severeClosureDistanceM: result.severe.distanceM,
    moderateDelay: result.moderate.status,
    severeDelay: result.severe.status,
  };
  return result;
}

function buildSlowZones(id, scenario, graph) {
  const engine = createRoutingEngine(graph);
  const trip = {
    origin: asset(scenario, 'supplier'),
    destination: asset(scenario, 'reserve'),
    ...DRIVE,
  };
  const clear = engine.route(trip);
  if (clear.status !== 'ok') throw Error(`${id} has no clear route`);
  const line = clear.routes[0].geometry.coordinates;
  const factorFor = (ring, severity) =>
    classifyDelay(applyStormDelay(clear, polygon({}, ring), SPEED[severity]), clear).factor;
  for (const fraction of FRACTIONS) {
    const centre = line[Math.floor(line.length * fraction)];
    const moderate = RADII_M.find(
      (r) => factorFor(octagon(centre, r), 'moderate') >= TARGET.moderate,
    );
    if (!moderate) continue;
    const severe = RADII_M.find(
      (r) => r > moderate && factorFor(octagon(centre, r), 'severe') >= TARGET.severe,
    );
    if (!severe) continue;
    const rings = { moderate: octagon(centre, moderate), severe: octagon(centre, severe) };
    const out = {};
    for (const severity of ['moderate', 'severe']) {
      const previous = scenario.hazards.storm[severity].properties;
      scenario.hazards.storm[severity] = polygon(
        {
          ...previous,
          radiusM: severity === 'moderate' ? moderate : severe,
          sourceLabel:
            'Synthetic storm slow zone placed on the scenario route; not an official warning, measured extent or flood model',
        },
        rings[severity],
      );
      const status = classifyDelay(
        applyStormDelay(clear, scenario.hazards.storm[severity], SPEED[severity]),
        clear,
      );
      if (severity === 'moderate' && status.status !== 'delayed')
        throw Error(`${id} moderate is ${status.status}`);
      if (severity === 'severe' && status.status !== 'extreme_delay')
        throw Error(`${id} severe is ${status.status}`);
      out[severity] = {
        status: status.status,
        factor: status.factor,
        radiusM: severity === 'moderate' ? moderate : severe,
      };
    }
    scenario.delays = {
      storm: Object.fromEntries(
        ['moderate', 'severe'].map((severity) => [
          severity,
          {
            speedFactor: SPEED[severity],
            provenance: 'representational',
            sourceLabel: `Synthetic delay: roads touching the storm polygon are modelled at ${SPEED[severity] * 100}% of normal speed; not measured road conditions`,
          },
        ]),
      ),
    };
    scenario.source.hazardMeaning =
      'Synthetic storm slow zones on the supplier to reserve route. Roads touching a polygon are modelled at 50% (moderate) or 20% (severe) speed. This extent has too little spare road for a closure to leave a route, so a delay is modelled instead. Not a flood model.';
    scenario.source.routeVerification = {
      ...scenario.source.routeVerification,
      moderateDelay: out.moderate,
      severeDelay: out.severe,
      polygonCentreFraction: fraction,
    };
    return out;
  }
  throw Error(`${id}: no polygon reaches both delay targets`);
}

const manifestPath = path.join(root, 'DATA-MANIFEST.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let differs = false;
for (const id of REGIONS) {
  const file = `public/data/regions/${id}-scenario.json`;
  const original = readFileSync(path.join(root, file), 'utf8');
  const scenario = JSON.parse(original);
  const graph = JSON.parse(
    readFileSync(path.join(root, `public/data/regions/${id}-graph.json`), 'utf8'),
  );
  const summary =
    id === 'dacope' ? buildDacope(scenario, graph) : buildSlowZones(id, scenario, graph);
  const text = serialise(scenario);
  console.log(id.padEnd(11), JSON.stringify(summary));
  if (text !== original) differs = true;
  if (!check) {
    writeFileSync(path.join(root, file), text);
    const entry = manifest.files.find((f) => f.path === file);
    const bytes = Buffer.from(text);
    entry.bytes = bytes.length;
    entry.sha256 = createHash('sha256').update(bytes).digest('hex');
  }
}
if (check) {
  if (differs) {
    console.error('Committed scenario files differ from build-storm-severity output.');
    process.exit(1);
  }
} else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
