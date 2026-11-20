import { projectToLine } from './water-model.mjs';

const labels = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function atlasDistricts(sites) {
  const names = new Map();
  for (const site of sites) {
    if (site.district && !names.has(site.district)) names.set(site.district, site.division);
  }
  return [...names].sort(
    ([a, divisionA], [b, divisionB]) =>
      labels.compare(divisionA, divisionB) || labels.compare(a, b),
  );
}

export function atlasMatches(sites, { district, category, query, priority }) {
  const term = query.trim().normalize('NFKC').toLocaleLowerCase('en');
  return sites
    .filter(
      (site) =>
        (!district || site.district === district) &&
        (!category || site.category === category) &&
        (!priority || site.priority) &&
        (!term ||
          [site.name, site.river, site.district, site.division, site.id]
            .join(' ')
            .normalize('NFKC')
            .toLocaleLowerCase('en')
            .includes(term)),
    )
    .sort(
      (a, b) =>
        Number(b.priority) - Number(a.priority) ||
        labels.compare(a.name, b.name) ||
        labels.compare(a.id, b.id),
    );
}

/** Evidence nearby in map distance. Original coordinates and study identifiers stay intact. */
export function samplesNearTrace(trace, samples, limitM = 500) {
  const lines = trace.flatMap(({ geometry }) =>
    geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates,
  );
  return samples
    .flatMap((sample) => {
      let distanceM = Infinity;
      for (const line of lines) {
        const result = projectToLine(sample, line);
        if (result) distanceM = Math.min(distanceM, result.gapM);
      }
      return distanceM <= limitM ? [{ ...sample, distanceM }] : [];
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}
