import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeepLink, parseDeepLink } from '../src/deeplink.mjs';

test('a valid link restores view, scenario and storm severity', () => {
  assert.deepEqual(parseDeepLink('?view=hazard&scenario=storm&condition=severe'), {
    view: 'hazard',
    scenario: 'storm',
    condition: 'severe',
  });
});

test('unknown or invalid values are ignored', () => {
  assert.deepEqual(parseDeepLink('?view=admin&scenario=flood&condition=extreme'), {});
  assert.deepEqual(parseDeepLink(''), {});
  assert.deepEqual(parseDeepLink('?view=compare'), { view: 'compare' });
});

test('building then parsing a link returns the same state', () => {
  const state = { view: 'hazard', scenario: 'storm', condition: 'moderate' };
  assert.deepEqual(parseDeepLink(buildDeepLink(state)), state);
});

test('storm severity is only written for the storm map', () => {
  assert.equal(
    buildDeepLink({ view: 'desk', scenario: 'salinity', condition: 'clear' }),
    '?view=desk&scenario=salinity',
  );
  assert.equal(
    buildDeepLink({ view: 'hazard', scenario: 'dry', condition: 'clear' }),
    '?view=hazard&scenario=dry',
  );
});
