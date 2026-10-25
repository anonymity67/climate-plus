import test from 'node:test';
import assert from 'node:assert/strict';
import { markerColor } from '../src/map-style.mjs';

test('a map sample with no valid tested parameter uses a missing-data color', () => {
  assert.equal(markerColor({ ph: null, do: null, cod: -59 }), '#77817c');
  assert.notEqual(markerColor({}), markerColor({ ph: 7, do: 6, cod: 20 }));
});

test('survey markers use their hydraulic-layer color independently of quality', () => {
  assert.equal(markerColor({ ph: 2, do: 0, cod: 100 }, 'survey'), '#357e8d');
});
