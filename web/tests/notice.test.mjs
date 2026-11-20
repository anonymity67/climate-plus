import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoticeCurrent } from '../src/notice.mjs';
test('notices expire at 24 hours and invalid or future confirmations are withheld', () => {
  const at = '2026-10-20T00:00:00Z',
    now = Date.parse(at);
  assert.equal(isNoticeCurrent(at, now + 1000), true);
  assert.equal(isNoticeCurrent(at, now + 86400000), false);
  assert.equal(isNoticeCurrent(at, now - 1), false);
  assert.equal(isNoticeCurrent(null, now), false);
  assert.equal(isNoticeCurrent('invalid', now), false);
});
