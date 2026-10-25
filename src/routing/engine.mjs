/** Bounded road routing. No network requests, traffic model or straight-line fallback. */
const RAD = Math.PI / 180;
const EARTH_M = 6371008.8;
const ROAD_CAPS = {
  tertiary: 40,
  residential: 25,
  unclassified: 25,
  service: 15,
  living_street: 10,
  livingstreet: 10,
};
const MAX_SNAP_M = 250;
const EPS = 1e-9;
const round = (n) => Math.round(n * 1000) / 1000;
const xy = (p) => [p.longitude, p.latitude];
const objectPoint = (p) => ({ longitude: p[0], latitude: p[1] });
const validXY = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
const validPoint = (p) =>
  p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && validXY(xy(p));
const equal = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

function metres(a, b) {
  const dlat = (b[1] - a[1]) * RAD,
    dlon = (b[0] - a[0]) * RAD;
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function closestOnSegment(p, a, b) {
  const cos = Math.cos(p[1] * RAD),
    dx = (b[0] - a[0]) * cos,
    dy = b[1] - a[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * cos * dx + (p[1] - a[1]) * dy) / denominator))
    : 0;
  const coordinate = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return { t, coordinate, distanceM: metres(p, coordinate) };
}

function cumulative(coordinates) {
  const positions = [0];
  for (let i = 1; i < coordinates.length; i++)
    positions.push(positions.at(-1) + metres(coordinates[i - 1], coordinates[i]));
  return positions;
}

function bounds(points) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    box[0] = Math.min(box[0], p[0]);
    box[1] = Math.min(box[1], p[1]);
    box[2] = Math.max(box[2], p[0]);
    box[3] = Math.max(box[3], p[1]);
  }
  return box;
}
const boxesOverlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function atFraction(edge, fraction) {
  if (fraction <= 0) return edge.coordinates[0];
  if (fraction >= 1) return edge.coordinates.at(-1);
  const distance = fraction * edge.shapeLengthM;
  const i = edge.positions.findIndex((p, j) => j > 0 && p >= distance);
  const t = (distance - edge.positions[i - 1]) / (edge.positions[i] - edge.positions[i - 1]);
  const a = edge.coordinates[i - 1],
    b = edge.coordinates[i];
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function clip(edge, start, end) {
  const coordinates = [atFraction(edge, start)];
  for (let i = 1; i < edge.coordinates.length - 1; i++) {
    const fraction = edge.positions[i] / edge.shapeLengthM;
    if (fraction > start + EPS && fraction < end - EPS) coordinates.push(edge.coordinates[i]);
  }
  const last = atFraction(edge, end);
  if (!equal(coordinates.at(-1), last)) coordinates.push(last);
  return coordinates;
}

function snapPoint(point, edges) {
  const p = xy(point);
  let best = null;
  for (const edge of edges)
    for (let i = 1; i < edge.coordinates.length; i++) {
      const candidate = closestOnSegment(p, edge.coordinates[i - 1], edge.coordinates[i]);
      if (best && candidate.distanceM >= best.distanceM - 1e-7) continue;
      const segmentLength = edge.positions[i] - edge.positions[i - 1];
      best = {
        ...candidate,
        edgeId: edge.id,
        fraction: (edge.positions[i - 1] + candidate.t * segmentLength) / edge.shapeLengthM,
      };
    }
  return best;
}

// Binary heap keeps Dijkstra O((V+E) log V), with no whole-array sorting.
class Heap {
  items = [];
  push(item) {
    const a = this.items;
    let i = a.length;
    a.push(item);
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= item[0]) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++;
        if (a[c][0] >= last[0]) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return first;
  }
}

function shortest(adjacency, start, end, penalized = new Set(), blockedId = null) {
  const distance = new Map([[start, 0]]),
    previous = new Map(),
    heap = new Heap();
  heap.push([0, start]);
  while (heap.items.length) {
    const [cost, node] = heap.pop();
    if (cost !== distance.get(node)) continue;
    if (node === end) {
      const arcs = [];
      let current = end;
      while (current !== start) {
        const arc = previous.get(current);
        arcs.push(arc);
        current = arc.from;
      }
      return arcs.reverse();
    }
    for (const arc of adjacency.get(node) || []) {
      if (arc.edge.id === blockedId) continue;
      const next = cost + arc.lengthM * (penalized.has(arc.edge.id) ? 4 : 1);
      if (next < (distance.get(arc.to) ?? Infinity) - 1e-8) {
        distance.set(arc.to, next);
        previous.set(arc.to, arc);
        heap.push([next, arc.to]);
      }
    }
  }
  return null;
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function insidePolygon(p, polygon) {
  return insideRing(p, polygon[0]) && !polygon.slice(1).some((r) => insideRing(p, r));
}
function intersects(a, b, c, d) {
  const cross = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  const within = (p, u, v) =>
    p[0] >= Math.min(u[0], v[0]) - 1e-12 &&
    p[0] <= Math.max(u[0], v[0]) + 1e-12 &&
    p[1] >= Math.min(u[1], v[1]) - 1e-12 &&
    p[1] <= Math.max(u[1], v[1]) + 1e-12;
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b);
  if (ac * ad < 0 && ca * cb < 0) return true;
  return (
    (Math.abs(ac) < 1e-14 && within(c, a, b)) ||
    (Math.abs(ad) < 1e-14 && within(d, a, b)) ||
    (Math.abs(ca) < 1e-14 && within(a, c, d)) ||
    (Math.abs(cb) < 1e-14 && within(b, c, d))
  );
}
function touchesPolygon(edge, polygon) {
  if (edge.coordinates.some((p) => insidePolygon(p, polygon))) return true;
  return polygon.some((ring) =>
    ring.some(
      (p, j) =>
        j &&
        edge.coordinates.some(
          (a, i) => i && intersects(edge.coordinates[i - 1], a, ring[j - 1], p),
        ),
    ),
  );
}
function closureShape(closure) {
  if (!closure || typeof closure !== 'object' || Array.isArray(closure))
    throw new Error('Closure must be an object.');
  if (
    closure.edgeIds !== undefined &&
    (!Array.isArray(closure.edgeIds) ||
      closure.edgeIds.length > 2000 ||
      closure.edgeIds.some((id) => typeof id !== 'string'))
  )
    throw new Error('Closure edgeIds must be a bounded array of strings.');
  let geometry = closure.geometry;
  if (geometry?.type === 'Feature') geometry = geometry.geometry;
  let point = null,
    polygons = null;
  if (geometry) {
    if (geometry.type === 'Point' && validXY(geometry.coordinates)) point = geometry.coordinates;
    else if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
    else if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
    else throw new Error('Closure geometry must be a Point, Polygon or MultiPolygon.');
    if (
      ['Polygon', 'MultiPolygon'].includes(geometry.type) &&
      (!Array.isArray(polygons) ||
        !polygons.length ||
        polygons.some(
          (poly) =>
            !Array.isArray(poly) ||
            !poly.length ||
            poly.some(
              (ring) =>
                !Array.isArray(ring) ||
                ring.length < 4 ||
                !ring.every(validXY) ||
                !equal(ring[0], ring.at(-1)),
            ),
        ))
    )
      throw new Error('Invalid closure polygon.');
    if (
      polygons &&
      polygons.reduce((sum, p) => sum + p.reduce((s, r) => s + r.length, 0), 0) > 5000
    )
      throw new Error('Closure polygon exceeds 5000 vertices.');
  }
  if (closure.latitude !== undefined || closure.longitude !== undefined) {
    if (!validPoint(closure)) throw new Error('Invalid closure coordinates.');
    point = xy(closure);
  }
  const radiusM = closure.radiusM ?? 30;
  if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 2000)
    throw new Error('Closure radius must be greater than zero and at most 2000 metres.');
  if (!point && !polygons && !closure.edgeIds?.length)
    throw new Error('Closure needs edge IDs or geometry.');
  const pointBounds = point
    ? (() => {
        const dy = (radiusM + 1) / 110000;
        const dx = dy / Math.max(0.00001, Math.cos(point[1] * RAD));
        return [point[0] - dx, point[1] - dy, point[0] + dx, point[1] + dy];
      })()
    : null;
  const polygonBounds = polygons?.map((p) => bounds(p.flat()));
  const vertexCount =
    polygons?.reduce((sum, p) => sum + p.reduce((s, r) => s + r.length, 0), 0) || 0;
  return {
    point,
    pointBounds,
    polygons,
    polygonBounds,
    vertexCount,
    radiusM,
    ids: closure.edgeIds || [],
  };
}

function stableId(text) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `route-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

export function createRoutingEngine(graph) {
  const nodes = new Map(),
    edges = [],
    ids = new Set();
  let graphError = null;
  try {
    if (
      graph?.schema !== 'climate-plus/road-graph-v1' ||
      !Array.isArray(graph.nodes) ||
      graph.nodes.length < 2 ||
      !Array.isArray(graph.edges) ||
      !graph.edges.length ||
      graph.nodes.length > 100000 ||
      graph.edges.length > 150000
    )
      throw new Error('Unsupported or unusably small road graph.');
    if (
      graph.metadata?.maxSnapDistanceM !== undefined &&
      (!Number.isFinite(graph.metadata.maxSnapDistanceM) || graph.metadata.maxSnapDistanceM <= 0)
    )
      throw new Error('Invalid graph snap distance.');
    for (const node of graph.nodes) {
      if (typeof node.id !== 'string' || nodes.has(node.id) || !validXY(node.coordinates))
        throw new Error('Malformed graph node.');
      nodes.set(node.id, node);
    }
    for (const edge of graph.edges) {
      if (
        typeof edge.id !== 'string' ||
        ids.has(edge.id) ||
        !nodes.has(edge.from) ||
        !nodes.has(edge.to) ||
        !Number.isFinite(edge.lengthM) ||
        edge.lengthM <= 0 ||
        !Array.isArray(edge.coordinates) ||
        edge.coordinates.length < 2 ||
        !edge.coordinates.every(validXY) ||
        !equal(edge.coordinates[0], nodes.get(edge.from).coordinates) ||
        !equal(edge.coordinates.at(-1), nodes.get(edge.to).coordinates)
      )
        throw new Error('Malformed graph edge.');
      ids.add(edge.id);
      const positions = cumulative(edge.coordinates),
        shapeLengthM = positions.at(-1);
      if (shapeLengthM <= 0) throw new Error('Zero-length graph edge.');
      edges.push({ ...edge, positions, shapeLengthM, bounds: bounds(edge.coordinates) });
    }
    edges.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  } catch (error) {
    graphError = error.message;
  }
  const roadEdges = edges.filter((e) => Object.hasOwn(ROAD_CAPS, e.highway));
  const metadata = {
    ...graph?.metadata,
    edgeIds: [...ids].sort(),
    nodeCount: nodes.size,
    edgeCount: edges.length,
    maxSnapDistanceM: Math.min(MAX_SNAP_M, graph?.metadata?.maxSnapDistanceM ?? MAX_SNAP_M),
    profiles: ['road'],
    profileRules: {
      road: { excludedHighways: ['footway', 'path', 'pedestrian'], speedCapsKmh: ROAD_CAPS },
    },
    alternativeMethod: 'shared-edge penalty (4x); replacement-edge search if unchanged',
    supported: !graphError && roadEdges.length > 0,
  };

  function route(input = {}) {
    const {
      origin,
      destination,
      closures = [],
      assumedSpeedKmh = 25,
      profile = 'road',
    } = input || {};
    const warnings = [
      'Road geometry is not a current access, flood, traffic, bridge-capacity or water-safety determination.',
      'Missing one-way data is inferred bidirectional. Vehicle access is unverified; footways, paths and pedestrian ways are excluded.',
      'ETA uses your assumed speed with road-type caps; endpoint-to-network gaps are reported separately and excluded from distance and ETA.',
    ];
    const source = { ...metadata, assumedSpeedKmh, profile };
    const failure = (status, message, snap = null, excludedEdgeIds = []) => ({
      status,
      routes: [],
      snap,
      excludedEdgeIds,
      source,
      warnings: [...warnings, message],
    });
    if (
      !validPoint(origin) ||
      !validPoint(destination) ||
      !Number.isFinite(assumedSpeedKmh) ||
      assumedSpeedKmh < 1 ||
      assumedSpeedKmh > 100 ||
      profile !== 'road' ||
      !Array.isArray(closures) ||
      closures.length > 100
    )
      return failure(
        'invalid_input',
        'Use valid numeric coordinates, road profile, speed 1–100 km/h and at most 100 closures.',
      );
    if (graphError || !roadEdges.length)
      return failure('unsupported_graph', graphError || 'No supported vehicle road edges.');
    let shapes;
    try {
      shapes = closures.map(closureShape);
      if (shapes.reduce((n, s) => n + s.vertexCount, 0) > 10000)
        throw new Error('Closures exceed 10000 combined polygon vertices.');
      if (shapes.some((c) => c.ids.some((id) => !ids.has(id))))
        throw new Error('Closure references an unknown edge ID.');
    } catch (error) {
      return failure('invalid_input', error.message);
    }
    const excluded = new Set(shapes.flatMap((c) => c.ids));
    for (const edge of roadEdges) {
      if (excluded.has(edge.id)) continue;
      if (
        shapes.some(
          (c) =>
            (c.point &&
              boxesOverlap(edge.bounds, c.pointBounds) &&
              edge.coordinates.some(
                (p, i) =>
                  i && closestOnSegment(c.point, edge.coordinates[i - 1], p).distanceM <= c.radiusM,
              )) ||
            c.polygons?.some(
              (p, i) => boxesOverlap(edge.bounds, c.polygonBounds[i]) && touchesPolygon(edge, p),
            ),
        )
      )
        excluded.add(edge.id);
    }
    const excludedEdgeIds = [...excluded].sort();
    // Snap before closures: never jump a blocked road to a nearby road.
    const start = snapPoint(origin, roadEdges),
      end = snapPoint(destination, roadEdges);
    const externalSnap = (s) => ({
      edgeId: s.edgeId,
      coordinate: objectPoint(s.coordinate),
      distanceM: round(s.distanceM),
    });
    const snap = {
      origin: externalSnap(start),
      destination: externalSnap(end),
      maxDistanceM: metadata.maxSnapDistanceM,
    };
    if (start.distanceM > metadata.maxSnapDistanceM || end.distanceM > metadata.maxSnapDistanceM)
      return failure(
        'off_graph',
        'An endpoint is beyond the supported road-network snap distance; no road route is available.',
        snap,
        excludedEdgeIds,
      );
    if (start.distanceM > 50 || end.distanceM > 50)
      warnings.push(
        'An endpoint is over 50 metres from the network. Its off-road connector is unverified and may cross canals or inaccessible land; this is not a doorstep arrival ETA.',
      );
    const adjacency = new Map();
    const add = (arc) => {
      if (!adjacency.has(arc.from)) adjacency.set(arc.from, []);
      adjacency.get(arc.from).push(arc);
    };
    const locate = (s, label) => {
      const edge = roadEdges.find((e) => e.id === s.edgeId);
      if (s.fraction < EPS) return edge.from;
      if (s.fraction > 1 - EPS) return edge.to;
      return label;
    };
    const startId = locate(start, '@origin');
    let endId = locate(end, '@destination');
    if (start.edgeId === end.edgeId && Math.abs(start.fraction - end.fraction) < EPS)
      endId = startId;
    for (const edge of roadEdges) {
      if (excluded.has(edge.id)) continue;
      const splits = [
        { fraction: 0, id: edge.from },
        { fraction: 1, id: edge.to },
      ];
      if (start.edgeId === edge.id && startId === '@origin')
        splits.push({ fraction: start.fraction, id: startId });
      if (end.edgeId === edge.id && endId === '@destination')
        splits.push({ fraction: end.fraction, id: endId });
      splits.sort((a, b) => a.fraction - b.fraction);
      for (let i = 1; i < splits.length; i++) {
        const a = splits[i - 1],
          b = splits[i],
          lengthM = edge.lengthM * (b.fraction - a.fraction);
        if (lengthM <= EPS) continue;
        const coordinates = clip(edge, a.fraction, b.fraction);
        add({ from: a.id, to: b.id, edge, lengthM, coordinates });
        if (edge.bidirectional !== false)
          add({ from: b.id, to: a.id, edge, lengthM, coordinates: [...coordinates].reverse() });
      }
    }
    const primary = shortest(adjacency, startId, endId);
    if (!primary)
      return failure(
        'disconnected',
        'Endpoints are disconnected on the supported graph after active exclusions.',
        snap,
        excludedEdgeIds,
      );
    const signature = (arcs) => arcs.map((a) => `${a.edge.id}:${a.from}:${a.to}`).join('|');
    const primarySignature = signature(primary),
      primaryIds = new Set(primary.map((a) => a.edge.id));
    let alternative = shortest(adjacency, startId, endId, primaryIds);
    if (!alternative || signature(alternative) === primarySignature) {
      alternative = null;
      // Bound fallback work for pathological routes; report the limit explicitly.
      const candidates = [...primaryIds],
        limit = 64;
      if (candidates.length > limit)
        warnings.push(
          'Alternative replacement search is limited to 64 primary edges; another path may exist.',
        );
      for (const id of candidates.slice(0, limit)) {
        const candidate = shortest(adjacency, startId, endId, new Set(), id);
        if (
          candidate &&
          (!alternative ||
            candidate.reduce((s, a) => s + a.lengthM, 0) <
              alternative.reduce((s, a) => s + a.lengthM, 0))
        )
          alternative = candidate;
      }
    }
    const serialize = (arcs, method) => {
      const coordinates = [];
      for (const arc of arcs)
        for (const p of arc.coordinates)
          if (!coordinates.length || !equal(coordinates.at(-1), p)) coordinates.push(p);
      if (!coordinates.length) coordinates.push(start.coordinate, start.coordinate);
      const distanceM = arcs.reduce((s, a) => s + a.lengthM, 0);
      return {
        id: stableId(
          JSON.stringify([
            arcs.map((a) => [a.edge.id, a.from, a.to]),
            coordinates[0],
            coordinates.at(-1),
          ]),
        ),
        distanceM: round(distanceM),
        durationS: round(
          arcs.reduce(
            (s, a) => s + a.lengthM / (Math.min(assumedSpeedKmh, ROAD_CAPS[a.edge.highway]) / 3.6),
            0,
          ),
        ),
        edgeIds: arcs.map((a) => a.edge.id),
        geometry: { type: 'LineString', coordinates },
        edges: arcs.map((a) => ({
          id: a.edge.id,
          name: a.edge.name || a.edge.highway,
          coordinates: a.coordinates,
          lengthM: round(a.lengthM),
          highway: a.edge.highway,
        })),
        method,
      };
    };
    const routes = [serialize(primary, 'shortest distance on supported road graph')];
    if (alternative && signature(alternative) !== primarySignature)
      routes.push(serialize(alternative, metadata.alternativeMethod));
    else
      warnings.push(
        'No distinct alternative was found on the supported graph under active exclusions.',
      );
    return { status: 'ok', routes, snap, excludedEdgeIds, source, warnings };
  }

  function pointAlongRoute(selected, distanceM) {
    if (
      !selected?.geometry ||
      !Array.isArray(selected.geometry.coordinates) ||
      selected.geometry.coordinates.length < 2 ||
      !Number.isFinite(selected.distanceM) ||
      selected.distanceM < 0 ||
      !Number.isFinite(distanceM)
    )
      return null;
    const points = selected.geometry.coordinates;
    if (!points.every(validXY)) return null;
    // Scale geometry by declared network lengths for replay consistency.
    const parts = selected.edges?.length
      ? selected.edges
      : [{ coordinates: points, lengthM: selected.distanceM }];
    if (
      !Array.isArray(parts) ||
      parts.some(
        (p) =>
          !Number.isFinite(p.lengthM) ||
          p.lengthM < 0 ||
          !Array.isArray(p.coordinates) ||
          p.coordinates.length < 2 ||
          !p.coordinates.every(validXY),
      )
    )
      return null;
    let remaining = Math.max(0, Math.min(distanceM, selected.distanceM));
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k],
        positions = cumulative(part.coordinates),
        total = positions.at(-1);
      if (remaining > part.lengthM && k < parts.length - 1) {
        remaining -= part.lengthM;
        continue;
      }
      let target = part.lengthM > 0 ? Math.min(1, remaining / part.lengthM) * total : 0;
      for (let i = 1; i < part.coordinates.length; i++) {
        const length = positions[i] - positions[i - 1];
        if (target > length && i < part.coordinates.length - 1) {
          target -= length;
          continue;
        }
        const a = part.coordinates[i - 1],
          b = part.coordinates[i],
          t = length > 0 ? Math.min(1, target / length) : 0;
        const heading =
          (Math.atan2(
            Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD),
            Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) -
              Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD),
          ) /
            RAD +
            360) %
          360;
        return { latitude: a[1] + t * (b[1] - a[1]), longitude: a[0] + t * (b[0] - a[0]), heading };
      }
    }
    return null;
  }
  return { metadata, route, pointAlongRoute };
}
