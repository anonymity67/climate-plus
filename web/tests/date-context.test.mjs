import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObservation } from '../src/water-engine.mjs';

import { bangladeshDate } from '../src/date-context.mjs';
const observation = { date: '2026-10-25', latitude: 23.9, longitude: 90.4, ph: 7 };

test('Bangladesh sample day changes at 18:00 UTC, independently of the machine timezone', () => {
  assert.equal(typeof bangladeshDate, 'function');
  assert.equal(bangladeshDate('2026-10-24T17:59:59.999Z'), '2026-10-24');
  assert.equal(bangladeshDate('2026-10-24T18:00:00.000Z'), '2026-10-25');
  assert.equal(bangladeshDate(new Date('2026-10-24T18:00:00Z')), '2026-10-25');
  assert.equal(bangladeshDate(Date.parse('2026-10-24T18:00:00Z')), '2026-10-25');
  assert.equal(bangladeshDate('2026-10-25T00:00:00+06:00'), '2026-10-25');
});

test('Bangladesh calendar formatting handles month, year and leap-day rollover', () => {
  assert.equal(bangladeshDate('2026-12-31T18:00:00Z'), '2027-01-01');
  assert.equal(bangladeshDate('2024-02-28T18:00:00Z'), '2024-02-29');
  assert.equal(bangladeshDate('2024-02-29T18:00:00Z'), '2024-03-01');
  assert.equal(bangladeshDate(0), '1970-01-01');
  assert.match(bangladeshDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('invalid or ambiguous date-context inputs fail explicitly', () => {
  for (const value of [
    null,
    true,
    {},
    [],
    '',
    'bad date',
    '2026-10-25',
    '2026-10-25T00:00:00',
    '2025-02-30T00:00:00Z',
    NaN,
    Infinity,
    new Date(NaN),
  ])
    assert.throws(() => bangladeshDate(value), /valid.*instant|invalid.*instant/i);
});

test('observation dates allow the current Bangladesh day starting at local midnight', () => {
  assert.equal(validateObservation(observation, { now: '2026-10-24T17:59:59.999Z' }).valid, false);
  assert.equal(validateObservation(observation, { now: '2026-10-24T18:00:00.000Z' }).valid, true);
  assert.equal(validateObservation(observation, { now: '2026-10-25T00:00:00.000Z' }).valid, true);
  assert.equal(
    validateObservation({ ...observation, date: '2026-10-26' }, { now: '2026-10-24T18:00:00Z' })
      .valid,
    false,
  );
});

test('date-context extraction preserves strict real sample dates and historical observations', () => {
  const options = { now: '2026-10-24T18:00:00Z' };
  for (const date of [
    '2025-02-29',
    '2024-02-30',
    '2026-13-01',
    '2026-1-01',
    '2026-10-25T00:00:00Z',
  ])
    assert.equal(validateObservation({ ...observation, date }, options).valid, false);
  for (const date of ['2017-01-25', '2021-07-17', '2024-02-29'])
    assert.equal(validateObservation({ ...observation, date }, options).valid, true);
});
