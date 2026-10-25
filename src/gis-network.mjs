// Helpers for the GIS service-area layer (public/data/gis-network.json + .geojson).
// The layer is synthetic: a fictional network placed on real OpenStreetMap roads.

export const CONDITIONS = ['clear', 'moderate', 'severe'];

export function defaultCondition(scenario) {
  return scenario === 'storm' ? 'severe' : 'clear';
}

export function conditionScenario(gis, condition) {
  return gis.assumptions.conditionScenario[condition];
}

export function conditionRoute(gis, condition) {
  return gis.access[conditionScenario(gis, condition)]?.reserve ?? null;
}

export function conditionHazardId(gis, condition) {
  return gis.assumptions.conditionHazard[condition] ?? null;
}

export function routeCaption(gis, condition) {
  const r = conditionRoute(gis, condition);
  if (!r) return 'No route result for this condition.';
  if (!r.reachable) return 'Supplier to reserve: unreachable under this condition.';
  const km = (r.distanceM / 1000).toFixed(1);
  const min = r.minutes.toFixed(1);
  return `Supplier to reserve: ${km} km, ${min} min at an assumed ${gis.assumptions.speedKmh} km/h. Status: ${statusLabel(r.status)}.`;
}

// Inputs recorded in the receipt so the record names the geography it relied on.
export function gisReceiptInputs(gis, condition) {
  if (!gis) return null;
  const r = conditionRoute(gis, condition);
  return {
    schema: gis.schema,
    sourceSha256: gis.source.sha256,
    condition,
    route: r
      ? {
          distanceM: r.distanceM,
          minutes: r.minutes,
          status: r.status,
        }
      : null,
    provenance: 'synthetic network on OpenStreetMap roads',
  };
}

export const STATUS_COLOR = { open: '#3d7a66', delayed: '#a87920', extreme_delay: '#a74635' };
export const STATUS_LABEL = { open: 'open', delayed: 'delayed', extreme_delay: 'extreme delay' };
export const statusLabel = (s) => STATUS_LABEL[s] || s;
export const NODE_COLOR = {
  reserve: '#176b4c',
  pump: '#3d7a66',
  pond: '#2f6f8f',
  school: '#a87920',
  supplier: '#183b35',
  crew: '#6b5b95',
};

export const HAZARDS = ['storm', 'salinity'];

// Storm uses the chosen condition; salinity leaves the roads untouched (clear access).
export function effectiveCondition(hazard, condition) {
  return hazard === 'storm' ? condition : 'clear';
}

export function hazardPolygonId(gis, hazard, condition) {
  return hazard === 'salinity' ? 'salinity-1' : conditionHazardId(gis, condition);
}

export function accessRows(gis, condition) {
  const table = gis.access[conditionScenario(gis, condition)] || {};
  return gis.nodes
    .filter((n) => table[n.id])
    .map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      exposedSalinity: n.exposedSalinity,
      ...table[n.id],
    }));
}

export function hazardSummary(gis, hazard, condition) {
  if (hazard === 'salinity') {
    const held = gis.derived.salinity.restrictedSourcesFromGeography;
    return `Salinity area covers: ${held.length ? held.join(', ') : 'no source'}. These sources are held from the plan.`;
  }
  const r = conditionRoute(gis, condition);
  if (!r) return '';
  return `Supplier to reserve: ${statusLabel(r.status)} (${r.minutes.toFixed(1)} min, ${r.detourFactor}x the clear route).`;
}
