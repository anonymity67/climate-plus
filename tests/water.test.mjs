import test from 'node:test';
import assert from 'node:assert/strict';
import { screenWater, ccme, mixLoad, validateObservation, inferDO } from '../src/water-engine.mjs';
test('screening reports failed tests and limited coverage without calling water safe', () => {
  const r = screenWater({ ph: 7, do: 0.22, cod: 80 });
  assert.equal(r?.index, 200 / 3);
  assert.equal(r.tested, 3);
  assert.equal(r.failed, 2);
  assert.equal(r.overallStatus, 'partial-screen');
});
test('missing and negative measurements never become passing tests', () => {
  const r = screenWater({ ph: 7, do: null, cod: -59 });
  assert.equal(r?.tested, 1);
  assert.equal(r.excluded.length, 2);
  assert.equal(screenWater({})?.index, null);
});
test('CCME uses scope frequency and amplitude and refuses underspecified panels', () => {
  const objectives = { a: { max: 10 }, b: { max: 10 }, c: { max: 10 }, d: { max: 10 } };
  const rows = Array.from({ length: 4 }, (_, i) => ({
    site: 'test-station',
    date: `2025-01-0${i + 1}`,
    a: i === 3 ? 20 : 10,
    b: i === 3 ? 20 : 10,
    c: i === 3 ? 20 : 10,
    d: i === 3 ? 20 : 10,
  }));
  const r = ccme(rows, objectives);
  assert.ok(r);
  assert.equal(r.f1, 100);
  assert.equal(r.f2, 25);
  assert.equal(r.f3, 20);
  assert.ok(Math.abs(r.score - (100 - Math.sqrt(11025 / 3))) < 1e-9);
  assert.equal(ccme(rows, { a: { max: 10 } })?.score, null);
});
test('zero lower-bound measurement is handled explicitly without epsilon', () => {
  const o = { a: { min: 5 }, b: { max: 10 }, c: { max: 10 }, d: { max: 10 } },
    rows = Array.from({ length: 4 }, (_, i) => ({
      site: 'test-station',
      date: `2025-01-0${i + 1}`,
      a: 0,
      b: 1,
      c: 1,
      d: 1,
    }));
  const r = ccme(rows, o);
  assert.ok(r);
  assert.equal(r.f3, 100);
  assert.ok(Number.isFinite(r.score));
});
test('replicates on one date do not satisfy the sampling gate', () => {
  const o = { a: { max: 10 }, b: { max: 10 }, c: { max: 10 }, d: { max: 10 } },
    rows = Array(4).fill({ date: '2025-01-01', a: 1, b: 1, c: 1, d: 1 });
  assert.equal(ccme(rows, o)?.score, null);
});
test('mixing conserves incoming loads and shows a conditional reduction', () => {
  const r = mixLoad({ qu: 1, qs: 1, qd: 2, cu: 10, cs: 30, cd: 20 }, 0.5);
  assert.equal(r?.predicted, 20);
  assert.equal(r.after, 12.5);
  assert.equal(r.sourceShare, 0.75);
  assert.equal(r.flowClosure, 0);
  assert.equal(r.loadClosure, 0);
  assert.equal(r.status, 'within-screening-tolerance');
});
test('unmeasured water or load prevents source-attribution conclusions', () => {
  const r = mixLoad({ qu: 1, qs: 1, qd: 4, cu: 10, cs: 30, cd: 40 }, 0.5);
  assert.equal(r?.status, 'closure-failed');
  assert.equal(r.flowClosure, 1);
  assert.throws(() => mixLoad({ qu: 0, qs: 0, qd: 0, cu: 1, cs: 1, cd: 1 }), /flow/i);
});
test('observation validation rejects impossible dates, coordinates and units', () => {
  assert.ok(
    validateObservation({
      date: '2025-02-21',
      latitude: 24,
      longitude: 91,
      ph: 7,
      do: 5,
      cod: 50,
      units: { do: 'mg/L', cod: 'mg/L' },
    })?.valid,
  );
  assert.equal(
    validateObservation({
      date: '2025-02-30',
      latitude: 91,
      longitude: 181,
      ph: 20,
      do: -1,
      cod: 50,
      units: { do: 'ppm', cod: 'mg/L' },
    })?.valid,
    false,
  );
});
test('model abstains on out-of-range inputs and never receives target as predictor', () => {
  const model = {
    features: ['temp'],
    ranges: { temp: [20, 40] },
    kind: 'ridge',
    means: [30],
    scales: [10],
    coefficients: [2],
    intercept: 5,
    interval: 1,
  };
  assert.equal(inferDO(model, { temp: 30 })?.value, 5);
  assert.equal(inferDO(model, { temp: 50 })?.status, 'outside-domain');
});
test('observation display labels must be strings and future measurements are rejected', () => {
  const sample = {
    date: '2025-02-21',
    latitude: 24,
    longitude: 91,
    ph: 7,
    do: 5,
    cod: 50,
    units: { do: 'mg/L', cod: 'mg/L' },
  };
  assert.equal(validateObservation({ ...sample, location: { bad: 1 } }).valid, false);
  assert.equal(validateObservation({ ...sample, river: ['Balu'] }).valid, false);
  assert.equal(validateObservation({ ...sample, date: '2099-01-01' }).valid, false);
});
test('CCME cannot pool unrelated sites or count impossible dates', () => {
  const o = { a: { max: 10 }, b: { max: 10 }, c: { max: 10 }, d: { max: 10 } };
  const rows = Array.from({ length: 4 }, (_, i) => ({
    site: 'station-' + i,
    date: `2025-01-0${i + 1}`,
    a: 1,
    b: 1,
    c: 1,
    d: 1,
  }));
  assert.equal(ccme(rows, o).score, null);
  assert.equal(
    ccme(
      rows.map((r, i) => ({
        ...r,
        site: 'same',
        date: ['2025-02-28', '2025-02-29', '2025-02-30', '2025-02-31'][i],
      })),
      o,
    ).score,
    null,
  );
});
