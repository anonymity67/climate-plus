import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  conditionHazardId,
  conditionRoute,
  defaultCondition,
  gisReceiptInputs,
  routeCaption,
} from '../src/gis-network.mjs';

const gis = JSON.parse(readFileSync(new URL('../public/data/gis-network.json', import.meta.url)));

test('storm scenario opens on the severe condition, others on clear', () => {
  assert.equal(defaultCondition('storm'), 'severe');
  assert.equal(defaultCondition('salinity'), 'clear');
  assert.equal(defaultCondition('dry'), 'clear');
});

test('each condition maps to a route and the polygon that was removed', () => {
  assert.equal(conditionHazardId(gis, 'clear'), null);
  assert.equal(conditionHazardId(gis, 'moderate'), 'storm-1');
  assert.equal(conditionHazardId(gis, 'severe'), 'storm-3');
  assert.equal(conditionRoute(gis, 'clear').status, 'open');
  assert.equal(conditionRoute(gis, 'moderate').status, 'delayed');
  assert.equal(conditionRoute(gis, 'severe').status, 'extreme_delay');
});

test('caption states distance, minutes and the speed assumption', () => {
  const text = routeCaption(gis, 'severe');
  assert.match(text, /15\.9 km/);
  assert.match(text, /38\.1 min/);
  assert.match(text, /25 km\/h/);
});

test('receipt inputs name the source hash and stay free of undefined values', () => {
  const g = gisReceiptInputs(gis, 'moderate');
  assert.equal(g.sourceSha256, gis.source.sha256);
  assert.equal(g.route.status, 'delayed');
  assert.equal(JSON.stringify(g).includes('undefined'), false);
  assert.equal(gisReceiptInputs(null, 'clear'), null);
});
