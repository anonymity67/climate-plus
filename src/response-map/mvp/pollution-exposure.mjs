/** Nearby publisher pollution-intensity context for a customer location.
 *  The grid is a publisher score (no sampling date, unit or lab validation). Results describe the
 *  nearest grid points only; they are not a water-quality, health or drinking-water rating. */
export const CLASS_ORDER = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
export const CLASS_COLOURS = {
  'Very Low': '#e9e3a8',
  Low: '#e8c15f',
  Moderate: '#e08a45',
  High: '#c24a2c',
  'Very High': '#6f1d2c',
  Unclassified: '#8a9297',
};
/** The published grid is spaced ~0.0083° (~0.9 km); beyond this the grid says nothing about a place. */
export const COVERAGE_LIMIT_M = 1500;
export const RADII_M = [1000, 2000, 5000];

const rank = (name) => CLASS_ORDER.indexOf(name);
export function distanceM(a, b) {
  const R = 6371008.8,
    rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** rows: [id, latitude, longitude, publisherValue, publisherClass] as in river-pollution-context.json */
export function rowObject(r) {
  return { id: r[0], latitude: r[1], longitude: r[2], value: r[3], cls: r[4] };
}
export function assessLocation(rows, place, radiusM = 2000) {
  if (!rows?.length || !Number.isFinite(place?.latitude) || !Number.isFinite(place?.longitude))
    return null;
  // A degree-box pre-filter keeps this fast for ~10,000 rows.
  const dLat = radiusM / 111320 + 0.02,
    dLon = dLat / Math.max(0.2, Math.cos((place.latitude * Math.PI) / 180));
  let nearest = null,
    nearestD = Infinity;
  const within = [];
  for (const r of rows) {
    if (Math.abs(r[1] - place.latitude) > Math.max(dLat, 0.1)) continue;
    if (Math.abs(r[2] - place.longitude) > Math.max(dLon, 0.1)) continue;
    const point = rowObject(r),
      d = distanceM(place, point);
    if (d < nearestD) {
      nearestD = d;
      nearest = point;
    }
    if (d <= radiusM) within.push({ ...point, distanceM: d });
  }
  if (!nearest || nearestD > COVERAGE_LIMIT_M)
    return {
      status: 'outside_coverage',
      nearestDistanceM: nearest ? Math.round(nearestD) : null,
      radiusM,
      count: 0,
    };
  const classed = within.filter((p) => rank(p.cls) >= 0);
  const counts = Object.fromEntries(CLASS_ORDER.map((c) => [c, 0]));
  classed.forEach((p) => (counts[p.cls] += 1));
  const worst = classed.reduce((w, p) => (rank(p.cls) > rank(w) ? p.cls : w), classed[0]?.cls);
  const mean = within.length ? within.reduce((s, p) => s + p.value, 0) / within.length : null;
  return {
    status: 'covered',
    radiusM,
    nearest: { ...nearest, distanceM: Math.round(nearestD) },
    count: within.length,
    counts,
    worstClass: worst || 'Unclassified',
    meanValue: mean == null ? null : Math.round(mean * 1000) / 1000,
    shareHighOrWorse: classed.length
      ? Math.round(((counts.High + counts['Very High']) / classed.length) * 100)
      : 0,
  };
}
const field = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v);
export function customersCsv(rows) {
  const head = [
    'name',
    'latitude',
    'longitude',
    'status',
    'nearest_class',
    'nearest_distance_m',
    'worst_class_in_radius',
    'mean_score_in_radius',
    'share_high_or_very_high_pct',
    'grid_points_in_radius',
    'radius_m',
  ];
  const lines = rows.map(({ customer, a }) =>
    [
      customer.name,
      customer.latitude,
      customer.longitude,
      a?.status ?? 'no_data',
      a?.nearest?.cls ?? '',
      a?.nearest?.distanceM ?? a?.nearestDistanceM ?? '',
      a?.worstClass ?? '',
      a?.meanValue ?? '',
      a?.shareHighOrWorse ?? '',
      a?.count ?? '',
      a?.radiusM ?? '',
    ]
      .map(field)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}
/** "name,lat,lon" lines (header row and blank lines ignored). */
export function parseCustomers(text) {
  const out = [],
    bad = [];
  String(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      const parts = line.split(/[,\t;]/).map((s) => s.trim().replace(/^"|"$/g, ''));
      const [name, lat, lon] =
        parts.length >= 3 ? [parts.slice(0, -2).join(' '), parts.at(-2), parts.at(-1)] : [];
      const latitude = Number(lat),
        longitude = Number(lon);
      if (i === 0 && !Number.isFinite(latitude) && /lat/i.test(line)) return;
      if (
        !name ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        bad.push(i + 1);
      else out.push({ name, latitude, longitude });
    });
  return { customers: out, badLines: bad };
}
