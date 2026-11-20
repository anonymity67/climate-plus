import { distanceKm, validCoordinates } from '../gis-engine.mjs';

const numeric = (v, min, max) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function projectToLine(point, coordinates) {
  if (!validCoordinates(point) || !Array.isArray(coordinates) || coordinates.length < 2)
    return null;
  const scale = Math.cos((point.latitude * Math.PI) / 180),
    metres = 111195.08;
  let best = null;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1],
      b = coordinates[i];
    if (![...a, ...b].every(Number.isFinite)) continue;
    const ax = (a[0] - point.longitude) * scale,
      ay = a[1] - point.latitude;
    const bx = (b[0] - point.longitude) * scale,
      by = b[1] - point.latitude;
    const dx = bx - ax,
      dy = by - ay,
      denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator)) : 0;
    const gapM = Math.hypot(ax + dx * t, ay + dy * t) * metres;
    if (!best || gapM < best.gapM)
      best = {
        gapM,
        coordinate: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        segment: i - 1,
      };
  }
  return best;
}

export function nearestChannel(point, ways, maxDistanceM = 750) {
  if (!validCoordinates(point) || !numeric(maxDistanceM, 0, 2000))
    throw Error('Invalid channel matching input.');
  let result = null;
  for (const way of ways) {
    const b = way.bounds;
    if (
      b &&
      (point.latitude < b[1] - 0.02 ||
        point.latitude > b[3] + 0.02 ||
        point.longitude < b[0] - 0.025 ||
        point.longitude > b[2] + 0.025)
    )
      continue;
    const projection = projectToLine(point, way.geometry.coordinates);
    if (
      projection &&
      projection.gapM <= maxDistanceM &&
      (!result ||
        projection.gapM < result.gapM ||
        (projection.gapM === result.gapM && way.id < result.id))
    )
      result = { id: way.id, name: way.name, component: way.component, ...projection };
  }
  return result;
}

/** Volume accounting for a sequence of days; 1 mm over 1 m² = 1 litre. */
export function rainwaterPlan(input) {
  if (
    !input ||
    !numeric(input.roofM2, 1, 10000) ||
    !numeric(input.runoff, 0.1, 1) ||
    !numeric(input.tankL, 0, 1000000) ||
    !numeric(input.startL, 0, input.tankL) ||
    !numeric(input.dailyDemandL, 1, 100000) ||
    !numeric(input.lossMm, 0, 20) ||
    !Array.isArray(input.rainfallMm) ||
    input.rainfallMm.length < 1 ||
    input.rainfallMm.length > 366 ||
    input.rainfallMm.some((v) => !numeric(v, 0, 2000))
  )
    throw Error(
      'Use a roof of 1–10,000 m², runoff 0.1–1, valid tank/start volumes, daily demand, per-rain-day loss and 1–366 daily rainfall values.',
    );
  let storage = input.startL,
    totalCollectedL = 0,
    totalSpillL = 0,
    totalServedL = 0,
    totalUnmetL = 0;
  const days = input.rainfallMm.map((rainfallMm, index) => {
    const collectedL = Math.max(0, rainfallMm - input.lossMm) * input.roofM2 * input.runoff;
    const spillL = Math.max(0, storage + collectedL - input.tankL);
    const available = Math.min(input.tankL, storage + collectedL);
    const servedL = Math.min(available, input.dailyDemandL),
      unmetL = input.dailyDemandL - servedL;
    storage = available - servedL;
    totalCollectedL += collectedL;
    totalSpillL += spillL;
    totalServedL += servedL;
    totalUnmetL += unmetL;
    return { day: index + 1, rainfallMm, collectedL, spillL, servedL, unmetL, closingL: storage };
  });
  return {
    days,
    totalCollectedL,
    totalSpillL,
    totalServedL,
    totalUnmetL,
    closingL: storage,
    demandL: input.dailyDemandL * days.length,
    coveragePercent: (totalServedL / (input.dailyDemandL * days.length)) * 100,
    dryDaysFromStart: Math.floor(input.startL / input.dailyDemandL),
    assumptions: {
      order: 'Rain enters the tank, excess spills, then daily demand is served.',
      losses:
        'Entered loss in millimetres is deducted once on every rainy day; this is a simplified collection-loss allowance, not treatment.',
      waterQuality: 'unknown',
      rainfall: 'Entered daily sequence; not a forecast.',
    },
  };
}

export function leakageEstimate(volumeMl, seconds, days = 30) {
  if (
    !numeric(volumeMl, 0, 1000000) ||
    !numeric(seconds, 0.1, 86400) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 366
  )
    throw Error('Enter a measured volume, positive collection time and 1–366 days.');
  const dailyLitres = (volumeMl / 1000 / seconds) * 86400;
  return {
    dailyLitres,
    totalLitres: dailyLitres * days,
    days,
    assumption: 'Measured leak rate stays constant; measure again after repair.',
  };
}

export function nearby(points, center, radiusKm = 2, limit = 10) {
  return points
    .map((p) => ({ ...p, distanceKm: distanceKm(p, center) }))
    .filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Population-weighted scenario index, using the same inputs as the RainHub R export. */
export function rainHubAccessIndex(blocks, { hubs, cleanup, effect }) {
  let num = 0,
    den = 0;
  for (const b of blocks) {
    const e = cleanup && b.cleaned ? b.e * (1 - effect) : b.e;
    const c = hubs ? b.c : 0;
    num += b.pop * (1 - e + e * c);
    den += b.pop;
  }
  return den ? num / den : 0;
}
