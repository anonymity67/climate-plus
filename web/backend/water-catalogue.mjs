import inventory from '../public/data/water-access-candidates.json' with { type: 'json' };
import evidence from '../public/data/water-evidence.json' with { type: 'json' };
import { decodeWaterInventory, distanceKm } from '../src/gis-engine.mjs';
import { nearestChannel, nearby } from '../src/platform/water-model.mjs';
import { screenWater } from '../src/water-engine.mjs';

export function createWaterCatalogue({
  water = inventory,
  chemistry = evidence,
  streams = {},
} = {}) {
  const points = decodeWaterInventory(water),
    pointById = new Map(points.map((p) => [p.id, p]));
  const areaGroups = new Map();
  for (const point of points) {
    if (!point.district || !point.subdistrict) continue;
    const key = point.district + '/' + point.subdistrict;
    if (!areaGroups.has(key)) areaGroups.set(key, []);
    areaGroups.get(key).push(point);
  }
  const areas = [...areaGroups]
    .map(([key, records]) => ({
      key,
      district: records[0].district,
      subdistrict: records[0].subdistrict,
      count: records.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key, 'en'));
  const matches = (point, q) =>
    !q ||
    [point.id, point.name, point.district, point.subdistrict, point.locality, point.provider]
      .join(' ')
      .toLocaleLowerCase()
      .includes(q);
  const groups = new Map();
  for (const observation of chemistry.observations) {
    const key = [
      observation.river,
      observation.location,
      observation.latitude,
      observation.longitude,
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(observation);
  }
  const sites = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, observations], i) => {
      observations.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      const latest = observations.at(-1),
        history = observations.map((o) => ({ ...o, screening: screenWater(o) }));
      const match = streams.dhaka ? nearestChannel(latest, streams.dhaka.ways, 750) : null;
      return {
        id: 'site-' + (i + 1),
        river: latest.river,
        name: latest.location,
        latitude: latest.latitude,
        longitude: latest.longitude,
        firstDate: observations[0].date,
        latestDate: latest.date,
        samples: observations.length,
        latest: history.at(-1),
        channel: match
          ? {
              ...match,
              area: 'dhaka',
              meaning:
                'Nearest mapped channel within 750 m; spatial association, not proven sampling-channel identity.',
            }
          : null,
        history,
      };
    });
  const source = {
    provider: water.provider,
    url: water.url,
    license: water.licence,
    acquired: '2026-10-24',
    dates: water.assessment_dates,
    sha256: water.source_sha256,
    records: points.length,
    qualification:
      'Historical water-point inventory. Current supply, access, hours, price and drinking-water safety are unknown.',
  };
  function sourceDetail(id) {
    const point = pointById.get(id);
    if (!point) return null;
    const closest = nearby(sites, point, 2, 5).map(({ history, ...s }) => s);
    return {
      point,
      source,
      nearbySites: closest,
      meaning:
        'Nearby surface-water samples are investigation context only. They do not establish contamination of this water point; groundwater and surface water are different systems.',
      checklist: [
        'Confirm the point still exists and is open with its operator or local authority.',
        'Ask for a recent water-test report, sampling date and responsible contact.',
        'Check accessibility, queue, price and available quantity before travelling.',
        'During flooding or chemical/salt concerns, follow local authority advice and use an alternative verified supply.',
      ],
    };
  }
  return {
    source,
    points,
    sites,
    meta() {
      return {
        source,
        presets: water.presets,
        areas,
        sourceTypes: [...new Set(points.map((p) => p.sourceType))].sort(),
        rivers: [...new Set(sites.map((s) => s.river))].sort(),
        siteCount: sites.length,
        chemistrySources: chemistry.sources,
        streamAreas: Object.values(streams).map((s) => ({
          id: s.area,
          source: s.source,
          ways: s.ways.length,
          components: s.components,
        })),
        evidenceGaps: {
          unlocatedQualityRecords: chemistry.unlocatedSpatialSamples?.length ?? 0,
          velocitySurveyPoints: chemistry.survey.length,
          explanation:
            'BASIS water-quality stations lack a verified join to velocity-survey coordinates; they are not mapped as quality samples.',
        },
      };
    },
    sourceDetail,
    searchArea({ area, query = '', offset, limit }) {
      const group = areaGroups.get(area);
      if (!group) return null;
      const q = query.trim().toLocaleLowerCase();
      const result = group.filter((p) => matches(p, q));
      return {
        points: result.slice(offset, offset + limit),
        total: result.length,
        offset,
        limit,
        source,
        area,
      };
    },
    search({
      latitude,
      longitude,
      radiusKm = 5,
      query = '',
      sourceType = '',
      offset = 0,
      limit = 50,
    }) {
      const q = query.trim().toLocaleLowerCase();
      const filtered = points
        .filter((p) => (!sourceType || p.sourceType === sourceType) && matches(p, q))
        .map((p) => ({ ...p, distanceKm: distanceKm(p, { latitude, longitude }) }))
        .filter((p) => p.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
      return {
        points: filtered.slice(offset, offset + limit),
        total: filtered.length,
        offset,
        limit,
        source,
        center: { latitude, longitude },
        radiusKm,
        distanceMeaning:
          'Straight-line distance. Walking routes, access and water quality are unverified.',
      };
    },
    listSites({ river = '', query = '' } = {}) {
      const q = query.toLocaleLowerCase();
      return sites
        .filter(
          (s) =>
            (!river || s.river === river) &&
            (!q || [s.river, s.name].join(' ').toLocaleLowerCase().includes(q)),
        )
        .map(({ history, ...s }) => s);
    },
    siteDetail(id) {
      const site = sites.find((s) => s.id === id);
      if (!site) return null;
      const connected = site.channel
        ? sites
            .filter(
              (s) =>
                s.id !== id &&
                s.channel?.component === site.channel.component &&
                distanceKm(s, site) <= 5,
            )
            .map(({ history, ...s }) => ({ ...s, distanceKm: distanceKm(s, site) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
        : [];
      return {
        site,
        connectedSites: connected,
        nearbyWaterPoints: nearby(points, site, 2, 8),
        sources: chemistry.sources,
        limits:
          'Shared-node map connections and nearby records guide resampling. They do not establish flow direction, transport, health exposure, an affected population or an industrial source.',
        nextSteps: [
          'Re-sample the original location with a dated, documented laboratory panel.',
          'Check mapped adjoining channels and potential discharges in the field; do not accuse a facility from proximity.',
          'Collect concurrent upstream/downstream flow and concentration before testing a source-load explanation.',
        ],
      };
    },
    stream(area) {
      const s = streams[area];
      return s ? { ...s, ways: s.ways.map(({ nodes, ...w }) => w) } : null;
    },
    survey() {
      return {
        points: chemistry.survey,
        source: chemistry.sources.find((s) => s.id === 'basis'),
        hydraulics: chemistry.hydraulics,
        qualification:
          'Velocity-survey points are not water-quality samples. Unlocated mass-balance means must not be attached to these coordinates.',
      };
    },
  };
}
