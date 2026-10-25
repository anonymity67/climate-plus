/** Storm delay scenarios: pure helpers shared by the browser, the API and the data builder.
 *  A scenario storm either closes the roads that touch its polygon (Dacope, a declared edge list)
 *  or slows them (`delays.storm.<severity>.speedFactor`). Both are scenario assumptions: the
 *  polygon is not a flood model and no measured road condition is implied. */
export const DELAY_RULE = Object.freeze({ delayedFactor: 1.2, extremeFactor: 1.75 });

const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const cross = (p1, p2, p3, p4) =>
  orient(p3, p4, p1) > 0 !== orient(p3, p4, p2) > 0 &&
  orient(p1, p2, p3) > 0 !== orient(p1, p2, p4) > 0;
function insideRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
/** True when any part of the polyline lies inside, or crosses the boundary of, the ring. */
export function lineTouchesRing(coordinates, ring) {
  if (!Array.isArray(coordinates) || !Array.isArray(ring) || ring.length < 4) return false;
  if (coordinates.some((c) => insideRing(c, ring))) return true;
  for (let i = 0; i < coordinates.length - 1; i++)
    for (let k = 0; k < ring.length - 1; k++)
      if (cross(coordinates[i], coordinates[i + 1], ring[k], ring[k + 1])) return true;
  return false;
}
export const polygonRing = (feature) => (feature?.geometry || feature)?.coordinates?.[0] || [];

/** Roads touching a polygon, for declared closures. */
export const edgesTouching = (edges, feature) =>
  edges.filter((e) => lineTouchesRing(e.coordinates, polygonRing(feature))).map((e) => e.id);

/** Slow the edges of each route that touch the storm polygon, then order routes by modelled time. */
export function applyStormDelay(result, feature, speedFactor) {
  if (!result || result.status !== 'ok' || !(speedFactor > 0 && speedFactor < 1)) return result;
  const ring = polygonRing(feature);
  const routes = result.routes
    .map((route) => {
      const metresPerSecond = route.distanceM / Math.max(1, route.durationS);
      const slowed = route.edges.filter((e) => lineTouchesRing(e.coordinates, ring));
      const extra = slowed.reduce(
        (sum, e) => sum + (e.lengthM / Math.max(0.01, metresPerSecond)) * (1 / speedFactor - 1),
        0,
      );
      return {
        ...route,
        normalDurationS: route.durationS,
        delayS: Math.round(extra * 1000) / 1000,
        slowedEdgeIds: slowed.map((e) => e.id),
        durationS: Math.round((route.durationS + extra) * 1000) / 1000,
      };
    })
    .sort((a, b) => a.durationS - b.durationS);
  return { ...result, routes };
}

/** Compare the selected scenario with the same trip on clear roads. */
export function classifyDelay(result, baseline, rule = DELAY_RULE) {
  const base = baseline?.routes?.[0];
  if (result?.status !== 'ok' || !result.routes?.[0])
    return { status: 'no_route', factor: null, rule };
  if (!(base?.durationS > 0) || !(result.routes[0].durationS > 0)) return null;
  const factor = Math.round((result.routes[0].durationS / base.durationS) * 1000) / 1000;
  return {
    status:
      factor >= rule.extremeFactor
        ? 'extreme_delay'
        : factor >= rule.delayedFactor
          ? 'delayed'
          : 'open',
    factor,
    baselineDurationS: base.durationS,
    baselineDistanceM: base.distanceM,
    rule,
  };
}
