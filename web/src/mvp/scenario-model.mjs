const HAZARDS = ['clear', 'storm', 'salinity'];
export function enteredPointsCollection(entries) {
  return {
    type: 'FeatureCollection',
    properties: {
      scope: 'all-entered-observations',
      includesDeviceGPS: false,
      qualification:
        'All points entered in this page, including outside the current region. Declared source type is retained; not authenticated laboratory evidence.',
    },
    features: entries.map((e) => e.feature),
  };
}
export function initialScenarioState(regionId = 'dacope', options = {}) {
  return {
    regionId,
    hazard: HAZARDS.includes(options.hazard) ? options.hazard : 'clear',
    severity: 'moderate',
    destinationRole: 'reserve',
    blockedEdgeIds: [],
    playing: false,
    distanceM: 0,
    chosenRouteId: null,
    source: 'replay',
  };
}
const reset = (state) => ({ ...state, playing: false, distanceM: 0, chosenRouteId: null });
export function scenarioReducer(state, action) {
  switch (action.type) {
    case 'REGION':
      return initialScenarioState(action.regionId);
    case 'HAZARD':
      return HAZARDS.includes(action.hazard)
        ? { ...reset(state), hazard: action.hazard, blockedEdgeIds: [] }
        : state;
    case 'DESTINATION':
      return { ...reset(state), destinationRole: action.role };
    case 'ROUTE':
      return { ...reset(state), chosenRouteId: action.id };
    case 'BLOCK':
      return {
        ...reset(state),
        blockedEdgeIds: [...new Set([...state.blockedEdgeIds, action.id])].filter(Boolean),
      };
    case 'CLEAR_BLOCKS':
      return { ...reset(state), blockedEdgeIds: [] };
    case 'PLAY':
      return { ...state, playing: !state.playing };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'RESTART':
      return { ...state, playing: false, distanceM: 0 };
    case 'ADVANCE': {
      if (
        !state.playing ||
        !Number.isFinite(action.deltaM) ||
        action.deltaM < 0 ||
        !Number.isFinite(action.totalM) ||
        action.totalM < 0
      )
        return state;
      const distanceM = Math.min(action.totalM, state.distanceM + action.deltaM);
      return { ...state, distanceM, playing: distanceM < action.totalM, source: 'replay' };
    }
    default:
      return state;
  }
}
function insideRing(point, ring) {
  let inside = false;
  const x = point.longitude,
    y = point.latitude;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj)
    )
      return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function insidePolygon(point, feature) {
  const geometry = feature?.geometry || feature;
  const polygons =
    geometry?.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  return polygons.some(
    (rings) =>
      rings[0]?.length >= 4 &&
      insideRing(point, rings[0]) &&
      !rings.slice(1).some((r) => insideRing(point, r)),
  );
}
export function calculateScenario(engine, scenario, state) {
  if (!scenario || scenario.regionId !== state.regionId)
    throw Error('The scenario and selected region do not match.');
  const origin = scenario.assets.find((a) => a.role === 'supplier');
  const destination = scenario.assets.find(
    (a) => a.role === state.destinationRole || a.id === state.destinationRole,
  );
  if (!origin || !destination)
    throw Error('This scenario is missing its supplier or destination point.');
  const declared =
    state.hazard === 'storm' ? scenario.closures?.storm?.[state.severity]?.edgeIds || [] : [];
  const edgeIds = [...new Set([...declared, ...state.blockedEdgeIds])].sort();
  const closures = edgeIds.length ? [{ edgeIds }] : [];
  const result = engine.route({
    origin,
    destination,
    closures,
    assumedSpeedKmh: 25,
    profile: 'road',
  });
  return {
    ...result,
    origin,
    destination,
    sourceKind: 'representational',
    waterSafety: 'unknown',
    heldAssetIds:
      state.hazard === 'salinity'
        ? scenario.assets
            .filter(
              (a) =>
                ['pump', 'pond'].includes(a.role) && insidePolygon(a, scenario.hazards.salinity),
            )
            .map((a) => a.id)
        : [],
    activeHazard:
      state.hazard === 'storm'
        ? scenario.hazards.storm[state.severity]
        : state.hazard === 'salinity'
          ? scenario.hazards.salinity
          : null,
  };
}
