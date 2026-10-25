import { screenWater } from './water-engine.mjs';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
export const validCoordinates = (point) =>
  Boolean(
    point &&
    finite(point.latitude) &&
    finite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180,
  );

export function distanceKm(a, b) {
  if (!validCoordinates(a) || !validCoordinates(b)) return null;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = radians(a.latitude),
    lat2 = radians(b.latitude);
  const halfChord =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, halfChord))));
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function waterPointEvidence(point, today = new Date().toISOString().slice(0, 10)) {
  const date = calendarDate(point?.assessedAt),
    now = calendarDate(today);
  let assessmentState = 'unknown';
  if (point?.assessedAt && (!date || !now || date > now)) assessmentState = 'invalid';
  else if (date && now)
    assessmentState = (now - date) / 86400000 > 30 ? 'historical' : 'recent-assessment';
  return {
    assessmentState,
    qualityStatus: 'not-verified',
    availability: 'confirmation-required',
    canRecommend: false,
    synthetic: point?.provenance === 'synthetic',
    reason:
      'Inventory presence, improved technology and assessment recency are not a current drinking-water clearance.',
  };
}

export function findWaterPoints(points, { center, query = '', radiusKm = 10, limit = 250 } = {}) {
  if (!validCoordinates(center)) throw Error('Enter valid latitude and longitude.');
  if (!finite(radiusKm) || radiusKm <= 0 || radiusKm > 1000)
    throw Error('Search radius must be between zero and 1,000 km.');
  if (!Array.isArray(points)) throw Error('Water-point records must be an array.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50000) throw Error('Invalid result limit.');
  const text = String(query).trim().toLocaleLowerCase();
  return points
    .filter((p) => p.provenance !== 'synthetic' && validCoordinates(p))
    .filter(
      (p) =>
        !text ||
        [
          p.id,
          p.name,
          p.district,
          p.subdistrict,
          p.division,
          p.locality,
          p.provider,
          p.sourceType,
          p.technology,
        ]
          .filter((v) => typeof v === 'string')
          .join(' ')
          .toLocaleLowerCase()
          .includes(text),
    )
    .map((p) => ({ ...p, distanceKm: distanceKm(center, p) }))
    .filter((p) => p.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

export function measuredPriority(observation) {
  const screen = screenWater(observation);
  const level =
    screen.index === null
      ? 'not-measured'
      : screen.failed >= 2
        ? 'multiple-exceedances'
        : screen.failed === 1
          ? 'one-exceedance'
          : 'within-tested-objectives';
  return {
    level,
    index: screen.index,
    failed: screen.failed,
    tested: screen.tested,
    safeToDrink: null,
  };
}

const contextClasses = {
  'Very High': { id: 'very-high', label: 'Very High', color: '#743d85', priority: true },
  High: { id: 'high', label: 'High', color: '#9460a0', priority: true },
  Moderate: { id: 'moderate', label: 'Moderate', color: '#ae8e4e', priority: false },
  Low: { id: 'low', label: 'Low', color: '#788aa0', priority: false },
  'Very Low': { id: 'very-low', label: 'Very Low', color: '#a3b0bd', priority: false },
};
export function contextClass(label) {
  return {
    ...(contextClasses[label] || {
      id: 'unknown',
      label: 'Unclassified',
      color: '#77817c',
      priority: false,
    }),
    safeToDrink: null,
    interpretation: 'publisher-classification-only',
  };
}

export function nearbyRecords(rows, center, radiusM) {
  if (!validCoordinates(center) || !finite(radiusM) || radiusM < 0 || radiusM > 5000)
    throw Error('Use valid coordinates and an investigation radius from 0 to 5,000 metres.');
  const records = rows
    .filter(validCoordinates)
    .map((r) => ({ ...r, distanceKm: distanceKm(center, r) }))
    .filter((r) => r.distanceKm * 1000 <= radiusM)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return { records, radiusM, interpretation: 'investigation-proximity-only', affectedPeople: null };
}

export function leakLossLitresPerDay(volumeMl, seconds) {
  if (!finite(volumeMl) || !finite(seconds) || volumeMl < 0 || seconds <= 0) return null;
  const result = (volumeMl / 1000 / seconds) * 86400;
  return Number.isFinite(result) ? result : null;
}
export function storagePlanLitres(people, days, litresPerPersonDay) {
  if (
    ![people, days, litresPerPersonDay].every((v) => finite(v) && v >= 0) ||
    !Number.isInteger(people)
  )
    return null;
  const result = people * days * litresPerPersonDay;
  return Number.isFinite(result) ? result : null;
}

export function decodeWaterInventory(data) {
  const keys = [
    'wpdx_id',
    'lat_deg',
    'lon_deg',
    'report_date',
    'status_id',
    'source',
    'clean_adm1',
    'clean_adm2',
    'clean_adm3',
    'clean_adm4',
    'water_source_clean',
    'water_tech_clean',
  ];
  if (
    data?.kind !== 'historical-confirmation-required-inventory' ||
    !Array.isArray(data.rows) ||
    !Array.isArray(data.fields) ||
    keys.some((k) => !data.fields.includes(k))
  )
    throw Error('Unsupported water inventory schema.');
  const index = Object.fromEntries(keys.map((k) => [k, data.fields.indexOf(k)]));
  return data.rows
    .map((row) => {
      const value = (k) => row[index[k]];
      const sourceType = value('water_source_clean') || 'Water point';
      return {
        id: value('wpdx_id'),
        latitude: value('lat_deg'),
        longitude: value('lon_deg'),
        assessedAt: value('report_date'),
        reportedPresence: value('status_id'),
        provider: value('source'),
        division: value('clean_adm1'),
        district: value('clean_adm2'),
        subdistrict: value('clean_adm3'),
        locality: value('clean_adm4'),
        sourceType,
        technology: value('water_tech_clean'),
        name: [sourceType, value('clean_adm4') || value('clean_adm3')].filter(Boolean).join(' · '),
        provenance: 'published-inventory',
      };
    })
    .filter(validCoordinates);
}
