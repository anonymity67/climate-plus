import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRoutingEngine } from '../src/routing/engine.mjs';
import {
  initialScenarioState,
  scenarioReducer,
  calculateScenario,
} from '../src/response-map/mvp/scenario-model.mjs';
import {
  DELAY_RULE,
  applyStormDelay,
  classifyDelay,
  edgesTouching,
  lineTouchesRing,
} from '../src/response-map/mvp/storm-delay.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const regions = read('../public/data/regions/index.json').regions.map((r) => r.id);
const load = (id) => ({
  engine: createRoutingEngine(read(`../public/data/regions/${id}-graph.json`)),
  scenario: read(`../public/data/regions/${id}-scenario.json`),
});
const run = (id, severity) => {
  const { engine, scenario } = load(id);
  return calculateScenario(engine, scenario, {
    ...initialScenarioState(id, { hazard: 'storm', severity }),
  });
};

test('the severity builder is deterministic and the committed scenario files are current', () => {
  const out = spawnSync(process.execPath, ['scripts/build-storm-severity.mjs', '--check'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test('every region: moderate storm is delayed and severe storm is an extreme delay', () => {
  for (const id of regions) {
    const moderate = run(id, 'moderate');
    const severe = run(id, 'severe');
    assert.equal(moderate.status, 'ok', id);
    assert.equal(moderate.delay.status, 'delayed', `${id} moderate`);
    assert.equal(severe.delay.status, 'extreme_delay', `${id} severe`);
    assert.ok(moderate.delay.factor >= DELAY_RULE.delayedFactor, id);
    assert.ok(moderate.delay.factor < DELAY_RULE.extremeFactor, id);
    assert.ok(severe.delay.factor >= DELAY_RULE.extremeFactor, id);
    assert.ok(severe.delay.factor > moderate.delay.factor, id);
  }
});

test('clear weather is open at 1.00x in every region', () => {
  for (const id of regions) {
    const { engine, scenario } = load(id);
    const result = calculateScenario(engine, scenario, initialScenarioState(id));
    assert.equal(result.status, 'ok');
    assert.equal(result.delay.status, 'open', id);
    assert.equal(result.delay.factor, 1, id);
  }
});

test('Dacope keeps the QGIS-verified detours: 1.42x moderate, 2.02x severe', () => {
  const moderate = run('dacope', 'moderate');
  const severe = run('dacope', 'severe');
  assert.equal(moderate.delay.factor.toFixed(2), '1.42');
  assert.ok(Math.abs(severe.delay.factor - 2.015) < 0.001, String(severe.delay.factor));
  assert.equal(Math.round(moderate.routes[0].distanceM), 11210);
  assert.equal(Math.round(severe.routes[0].distanceM), 15905);
});

test('other regions declare slow zones and label them as synthetic', () => {
  for (const id of regions.filter((r) => r !== 'dacope')) {
    const { scenario } = load(id);
    for (const severity of ['moderate', 'severe']) {
      const d = scenario.delays.storm[severity];
      assert.ok(d.speedFactor > 0 && d.speedFactor < 1, `${id} ${severity}`);
      assert.match(d.provenance, /synthetic|representational/, id);
      assert.ok(d.sourceLabel.length > 10, id);
    }
    assert.ok(
      scenario.delays.storm.severe.speedFactor < scenario.delays.storm.moderate.speedFactor,
    );
  }
});

test('classifyDelay applies the open / delayed / extreme-delay thresholds', () => {
  const baseline = { routes: [{ durationS: 600, distanceM: 4000 }] };
  const at = (s) => classifyDelay({ status: 'ok', routes: [{ durationS: s }] }, baseline).status;
  assert.equal(at(600), 'open');
  assert.equal(at(719), 'open');
  assert.equal(at(720), 'delayed');
  assert.equal(at(1049), 'delayed');
  assert.equal(at(1050), 'extreme_delay');
  assert.equal(classifyDelay({ status: 'no_route', routes: [] }, baseline).status, 'no_route');
});

test('applyStormDelay slows only edges inside the polygon and re-orders routes', () => {
  const square = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];
  const inside = {
    id: 'in',
    lengthM: 1000,
    coordinates: [
      [0.5, 1],
      [1.5, 1],
    ],
  };
  const outside = {
    id: 'out',
    lengthM: 1000,
    coordinates: [
      [5, 5],
      [6, 5],
    ],
  };
  assert.equal(lineTouchesRing(inside.coordinates, square), true);
  assert.equal(lineTouchesRing(outside.coordinates, square), false);
  assert.deepEqual(edgesTouching([inside, outside], { geometry: { coordinates: [square] } }), [
    'in',
  ]);
  const result = applyStormDelay(
    {
      status: 'ok',
      routes: [
        { id: 'a', distanceM: 1000, durationS: 100, edges: [inside] },
        { id: 'b', distanceM: 1200, durationS: 120, edges: [outside] },
      ],
    },
    { geometry: { coordinates: [square] } },
    0.5,
  );
  assert.deepEqual(
    result.routes.map((r) => r.id),
    ['b', 'a'],
  );
  assert.equal(result.routes[1].durationS, 200);
  assert.equal(result.routes[1].delayS, 100);
  assert.equal(result.routes[0].delayS, 0);
});

test('the SEVERITY action switches severity, resets the replay and ignores unknown values', () => {
  const start = { ...initialScenarioState('ukhia', { hazard: 'storm' }), distanceM: 50 };
  const severe = scenarioReducer(start, { type: 'SEVERITY', severity: 'severe' });
  assert.equal(severe.severity, 'severe');
  assert.equal(severe.distanceM, 0);
  assert.equal(scenarioReducer(severe, { type: 'SEVERITY', severity: 'biblical' }), severe);
});
