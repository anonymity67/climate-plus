import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rememberInvitation,
  consumeInvitation,
  tabStorage,
} from '../src/operations/invitation-handoff.mjs';
const token = 'a'.repeat(64);
function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
    values,
  };
}
test('an invitation survives sign-in in tab storage and is consumed once without a query token', () => {
  const s = storage();
  assert.equal(rememberInvitation('#join=' + token, s, 1000), true);
  assert.equal(consumeInvitation('', s, 2000), token);
  assert.equal(s.values.size, 0);
  assert.equal(consumeInvitation('', s, 2001), '');
});
test('pending invitation rejects expiry, malformed payloads and blocked storage', () => {
  const s = storage();
  rememberInvitation('#join=' + token, s, 1000);
  assert.equal(consumeInvitation('', s, 601001), '');
  assert.equal(s.values.size, 0);
  assert.equal(rememberInvitation('#join=<script>', s, 1000), false);
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  assert.equal(rememberInvitation('#join=' + token, blocked, 1000), false);
  assert.equal(consumeInvitation('#join=' + token, blocked, 1000), token);
  assert.equal(
    tabStorage({
      get sessionStorage() {
        throw Error('blocked');
      },
    }),
    null,
  );
});
