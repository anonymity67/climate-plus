import test from 'node:test';
import assert from 'node:assert/strict';
import * as gps from '../src/operations/device-gps.mjs';

const now = Date.parse('2026-10-24T12:00:00Z');
const position = {
  timestamp: now,
  coords: { latitude: 22.54, longitude: 89.52, accuracy: 12, speed: 3, heading: 90 },
};
test('device fix preserves actual capture time, precision and explicit source', () => {
  const fix = gps.positionToFix(position, 'supplier', { now, uuid: () => 'fix-1' });
  assert.equal(fix.source, 'device');
  assert.equal(fix.capturedAt, '2026-10-24T12:00:00.000Z');
  assert.equal(fix.accuracyM, 12);
  assert.equal(fix.role, 'supplier');
  assert.throws(
    () => gps.positionToFix({ ...position, timestamp: now + 60000 }, 'supplier', { now }),
    /future|time/i,
  );
  assert.throws(
    () =>
      gps.positionToFix(
        { ...position, coords: { ...position.coords, latitude: 100 } },
        'supplier',
        { now },
      ),
    /coordinate/i,
  );
});
test('replayed, stale and imprecise telemetry is never displayed as fresh live GPS', () => {
  const fix = { source: 'device', capturedAt: new Date(now).toISOString(), accuracyM: 12 };
  assert.equal(gps.describeFix(fix, now).live, true);
  assert.equal(gps.describeFix({ ...fix, source: 'replay' }, now).live, false);
  assert.equal(gps.describeFix(fix, now + 61000).live, false);
  assert.equal(gps.describeFix(fix, now + 31000).live, false);
  assert.equal(gps.describeFix({ ...fix, accuracyM: 500 }, now).routingEligible, false);
  assert.equal(gps.describeFix(null, now).live, false);
});
test('tracker starts only when called, throttles updates and clears the actual watch on stop', async () => {
  let callback,
    cleared = null,
    watchCalls = 0;
  const published = [];
  const geo = {
    watchPosition(success) {
      watchCalls++;
      callback = success;
      return 37;
    },
    clearWatch(id) {
      cleared = id;
    },
  };
  assert.equal(watchCalls, 0);
  const tracker = gps.startDeviceTracking({
    geolocation: geo,
    role: 'supplier',
    publish: async (fix) => published.push(fix),
    now: () => now,
    uuid: () => 'fix',
  });
  assert.equal(watchCalls, 1);
  await callback(position);
  await callback(position);
  assert.equal(published.length, 1);
  tracker.stop();
  assert.equal(cleared, 37);
  await callback({ ...position, timestamp: now + 10000 });
  assert.equal(published.length, 1);
});
