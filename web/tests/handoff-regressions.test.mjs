import test from 'node:test';
import assert from 'node:assert/strict';
import { mixLoad, ccme } from '../src/water-engine.mjs';
import { scenarioConfig, plan, inspect } from '../src/engine.mjs';

const paired = { qu: 1, qs: 1, qd: 2, cu: 10, cs: 30, cd: 20 };

test('mixing rejects non-finite, negative or greater-than-one closure tolerances', () => {
  for (const tolerance of [NaN, Infinity, -0.1, 1.1, '0.2', null]) {
    assert.throws(() => mixLoad(paired, 0.5, tolerance), /tolerance/i);
  }
});

test('mixing rejects numerical overflow instead of exporting infinite results', () => {
  assert.throws(() => mixLoad({ ...paired, qs: 1e308, cs: 1e308 }), /finite|overflow/i);
});

test('CCME rejects reversed objective bounds explicitly', () => {
  const rows = [{ site: 'station', date: '2025-01-01', a: 7 }];
  assert.throws(() => ccme(rows, { a: { min: 9, max: 6 } }), /objective/i);
});

test('planner rejects missing arrays and invalid delivery quantities with a domain error', () => {
  for (const change of [
    { demands: null },
    { inflows: null },
    { deliveryCost: NaN },
    { deliverySize: Infinity },
    { blockedDays: [9] },
  ]) {
    assert.throws(
      () => plan({ ...scenarioConfig(), ...change }),
      /Invalid scenario|Invalid water|Invalid delivery/i,
    );
  }
});

test('inspection jobs cannot buy capacity using negative hours or NaN priorities', () => {
  assert.throws(
    () => inspect([{ hours: -1, priority: 1, accessible: true }], 0),
    /Invalid inspection/i,
  );
  assert.throws(
    () => inspect([{ hours: 1, priority: NaN, accessible: true }], 2),
    /Invalid inspection/i,
  );
});
