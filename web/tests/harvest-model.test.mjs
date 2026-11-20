import test from 'node:test';
import assert from 'node:assert/strict';
import known from './fixtures/borsha-bandhu-published-equations.json' with { type: 'json' };
import { harvestReference, seasonalHarvest } from '../src/platform/harvest-model.mjs';

test('seasonal calculations match the Borsha-Bandhu engine across five profiles and three scales', () => {
  const near = (actual, reference) =>
    assert.ok(Math.abs(actual - reference) < 0.001, actual + ' vs ' + reference);
  for (const item of known) {
    const preset = harvestReference.presets.find(({ id }) => id === item.preset);
    const outcome = seasonalHarvest({ ...preset, profile: item.profile, rainfall: 'lower' });
    assert.equal(outcome.stable, true);
    assert.equal(outcome.months.length, 12);
    near(outcome.annualServedL, item.annualServedL);
    near(outcome.dryCoveragePct, item.dryCoveragePct);
    near(outcome.spillL, item.spillL);
    near(outcome.endL, item.endL);
    for (const month of outcome.months) {
      near(month.startL + month.collectedL, month.servedL + month.spillL + month.endL);
      near(month.servedL + month.shortL, month.demandL);
    }
  }
});

test('zero storage discloses the whole seasonal shortfall and invalid profiles are rejected', () => {
  const input = { roofM2: 60, tankL: 0, dailyDemandL: 15, profile: 'A', rainfall: 'lower' };
  const outcome = seasonalHarvest(input);
  assert.equal(outcome.shortL, 365 * 15);
  assert.equal(outcome.dryShortL, 212 * 15);
  assert.equal(outcome.dryCoveragePct, 0);
  for (const patch of [{ profile: 'unknown' }, { tankL: -1 }, { rainfall: 'forecast' }])
    assert.throws(() => seasonalHarvest({ ...input, ...patch }));
});
