import { validCoordinates } from '../gis-engine.mjs';

export function positionToFix(
  position,
  role,
  { now = Date.now(), uuid = () => crypto.randomUUID() } = {},
) {
  if (!['supplier', 'recipient'].includes(role))
    throw Error('Choose the role this device is sharing.');
  const coords = position?.coords;
  if (!validCoordinates(coords)) throw Error('The device did not provide valid coordinates.');
  if (!Number.isFinite(coords.accuracy) || coords.accuracy < 0 || coords.accuracy > 10000)
    throw Error('The device did not provide valid location accuracy.');
  if (
    !Number.isFinite(position.timestamp) ||
    position.timestamp > now + 10000 ||
    now - position.timestamp > 120000
  )
    throw Error('The device time is future-dated or stale. Wait for a fresh fix.');
  return {
    role,
    source: 'device',
    clientFixId: uuid(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyM: coords.accuracy,
    speedMps: Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null,
    heading:
      Number.isFinite(coords.heading) && coords.heading >= 0 && coords.heading < 360
        ? coords.heading
        : null,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

export function describeFix(fix, now = Date.now()) {
  if (!fix)
    return {
      live: false,
      routingEligible: false,
      freshness: 'missing',
      label: 'No position received',
      ageMs: null,
    };
  const captured = Date.parse(fix.capturedAt || '');
  const ageMs = Number.isFinite(captured) ? now - captured : null;
  const invalid = ageMs === null || ageMs < -10000;
  const fresh = !invalid && ageMs <= 30000;
  const device = fix.source === 'device';
  const precise = Number.isFinite(fix.accuracyM) && fix.accuracyM <= 100 && fix.accuracyM >= 0;
  return {
    live: device && fresh,
    routingEligible: device && fresh && precise,
    freshness: invalid ? 'invalid' : fresh ? 'fresh' : 'stale',
    source: fix.source,
    ageMs: ageMs === null ? null : Math.max(0, ageMs),
    accuracyM: fix.accuracyM,
    label:
      fix.source === 'replay'
        ? 'Replay position — not GPS'
        : invalid
          ? 'Invalid device time'
          : !fresh
            ? 'Stale device position'
            : !precise
              ? 'Device GPS — low precision'
              : 'Recent device GPS',
  };
}

export function startDeviceTracking({
  geolocation,
  role,
  publish,
  onState = () => {},
  now = () => Date.now(),
  uuid,
  throttleMs = 3000,
}) {
  if (!geolocation?.watchPosition) throw Error('GPS is unavailable in this browser.');
  let active = true,
    lastAttempt = -Infinity,
    pending = null;
  const watch = geolocation.watchPosition(
    async (position) => {
      if (!active || pending || now() - lastAttempt < throttleMs) return;
      let fix;
      try {
        fix = positionToFix(position, role, { now: now(), uuid });
      } catch (error) {
        onState({ status: 'invalid', message: error.message });
        return;
      }
      lastAttempt = now();
      onState({ status: 'sending', fix });
      pending = Promise.resolve().then(() => publish(fix));
      try {
        await pending;
        if (active) onState({ status: 'shared', fix });
      } catch (error) {
        if (active)
          onState({
            status: 'failed',
            message: error.message || 'The GPS fix was not acknowledged by the server.',
            fix,
          });
      } finally {
        pending = null;
      }
    },
    (error) => {
      if (active)
        onState({
          status: error.code === 1 ? 'permission-denied' : 'unavailable',
          message:
            error.code === 1
              ? 'Location permission was denied. Nothing is shared.'
              : 'The device could not obtain a location fix.',
        });
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
  return {
    stop() {
      active = false;
      geolocation.clearWatch(watch);
      onState({ status: 'stopped' });
      return pending ? pending.catch(() => {}) : Promise.resolve();
    },
  };
}
