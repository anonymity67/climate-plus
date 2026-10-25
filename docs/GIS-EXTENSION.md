# Adding defensible GIS and data features

The working GIS already displays real source-labelled Dhaka quality coordinates and a separate Sylhet velocity survey. It intentionally has no invented factory attribution or quality-station geolocation.

## First useful extension

Build a versioned station catalogue and independently reviewed drainage connections for one pilot reach. Before coding, secure an openly licensed or authorized source with site ID, CRS, positional precision, date/version and provenance. Record field/laboratory QA and whether each point is a sampling station, suspected discharge, permitted outfall, intake or survey location. These concepts are not interchangeable.

1. Retain a new immutable raw snapshot under `research/<source>/<version>/`. Register provider, stable URL/DOI, version, rights, download date, units, coverage, caveats, byte count and SHA-256. Do not overwrite the supplied raw evidence.
2. Write an explicit adapter producing the documented observation fields. Check calendar dates, CRS, longitude/latitude order, duplicate site/time IDs, nulls, detection limits, units and plausible ranges. Log rejected cells/rows with reasons.
3. Keep observations without defensible coordinates in an unlocated table. Do not assign the nearest survey point merely because it exists. Matching IDs needs publisher documentation or a reviewed crosswalk.
4. Add tests for coordinate bounds, transformations, joins, counts, and known exclusions. Compare derived hashes and review a map against the published coordinate table.
5. Add the layer to `ResearchMap.jsx` with its own label/legend. Derive selection from stable IDs. Use keyboard-accessible alternatives to marker clicks. Preserve zoom on selection and distinguish missing data from passing tests.
6. Show sampling dates and uncertainty. Make the data freshness label source-specific; never show old samples as live conditions. Test filters with no matching rows and disconnected basemap access.
7. Version any changed objective profile with intended use, authority, page/table, units and chemical forms. Obtain scientific review before comparing new analytes or presenting regulatory status.

## Source tracing, in stages

**Implemented:** paired upstream/drain/downstream mixing and closure checks, with a conditional source-reduction scenario. Published hydraulic groups lack verified GIS connections. COD, DO and fecal coliform cannot uniquely fingerprint an industrial facility.

**Next pilot:** map documented outfall-to-drain-to-river connectivity. Collect authorized, time-matched upstream/outfall/downstream samples and flow, tide, rainfall, travel-time and custody metadata. Test sector-relevant analytes and alternative explanations (sewage, runoff, unmeasured tributaries, sediment release). A reviewer approves investigation hypotheses before escalation.

**Later research:** a directed drainage graph can rank connected candidate pathways using measured flow direction and uncertainty. Tidal reversals require time-dependent flow; steady shortest-path ranking is inadequate. Any source-ranking model needs known-source validation, negative controls and a predeclared evaluation protocol. Display candidate pathways as hypotheses, not confirmed polluters.

## Scaling and release gates

Move large layers to a versioned PostGIS/API or tile service with bbox/date queries; preserve raw immutable storage and lineage. Evaluate tile-provider policy, data permissions, restricted facility coordinates, authentication, authorized reporting and server-side validation before public use. Do not promise automatic enforcement, potable-water clearance, emissions savings or clinical benefit from a GIS overlay.

Acceptance for a new GIS dataset: source/rights registered; raw hash retained; CRS/unit/date validation passed; joins independently checked; uncertain locations retained as uncertain; legend and missing-data states tested; no historical-to-current implication; methods and limitations updated.
