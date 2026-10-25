import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateObservation, screenWater, mixLoad } from '../src/water-engine.mjs';
const load = (name) =>
  JSON.parse(readFileSync(new URL('../examples/' + name, import.meta.url), 'utf8'));

test('documented observation example imports and produces the documented partial index', () => {
  const observation = load('observation.json');
  assert.equal(validateObservation(observation).valid, true);
  assert.equal(screenWater(observation).failed, 2);
  assert.equal(screenWater(observation).tested, 3);
});

test('documented paired example has closed flow and finite conditional predictions', () => {
  const result = mixLoad(load('paired-measurements.json'), 0.5);
  assert.equal(result.flowClosure, 0);
  assert.ok(Number.isFinite(result.predicted));
  assert.ok(result.after < result.predicted);
});
