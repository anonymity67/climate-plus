# Water platform V4 · sources, methods and practical limits

This document and the root README describe the 17 November 2026 upgrade. Earlier research reports and competition materials remain reference history; they do not override the current product's labels.

## What is functional

| Task                   | Implementation                                                                                                                                                                                      | What it establishes                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find water             | Server-side search of 20,084 actual WPdx inventory records, bounded distance, type and text filters, 30-result pages, map/list selection, original IDs and dates, source detail and check checklist | A recorded candidate at its original coordinate; no present safety, access or supply clearance                                                      |
| Keep a source check    | Signed-in, append-only SQLite/D1 record with source ID, date, outcome and note; unique actor/client retry key; atomic creation event; private history/export                                        | Who recorded a check, its content and when it was saved; not an authenticated field visit or lab test                                               |
| Check rivers           | 1,495 original dated Dhaka chemistry records grouped by river/location/coordinate; complete site history, partial fisheries comparison, source and units                                            | Repository-published historical measurements and explicitly limited comparison, not an overall WQI or current health rating                         |
| Follow mapped channels | Three genuine OSM channel snapshots, shared-node components and nearest-section association within 750 m                                                                                            | Mapped geometry/connectivity and a declared spatial match, not measured hydraulic direction, contamination propagation or industrial responsibility |
| Add data               | Strict manual and CSV/GeoJSON entry; original-coordinate private points; immutable measurements, hashes, idempotent saves and follow-up cases                                                       | A validated input format and checkable saved record; not independent measurement authentication                                                     |
| Plan supply            | Server-calculated daily roof-catchment/tank balance, visible shortages and spills, chart/table/export; measured leak-rate calculator                                                                | Volume under entered assumptions; no rain forecast, sustainable aquifer yield, treatment or potability conclusion                                   |
| Practise disruption    | Existing five-region road graph, declared storm/salinity scenarios, alternatives, moving labelled replay, secondary opt-in GPS and private operations                                               | A working scenario and actual graph route; no flood-safe road, current official warning or real dispatch                                            |

## Existing uploaded material

The original brainstorming document informed the venture scope. `Climate++.md` and the GIS workplan informed provenance, volume accounting and scenario boundaries. The `GIS repo` and Antar v2 GeoPackage/handoff supplied the Dacope road/scenario foundation. The uploaded documents are reference material, not instructions to assert measurements or silently change platform access.

The applicable original datasets are retained under `research/`: Dhaka `Water quality.csv`; BASIS `basis-v2.xlsx`; WPdx Bangladesh CSV; Kaggle publisher-context CSV; GIS GeoPackage; OSM road snapshots. The current workspace's management-course PDFs and unrelated personal documents are not treated as environmental evidence or included in the collaborator kit.

## New waterway acquisition

`scripts/acquire-waterways.py --area <dhaka|sylhet|dacope>` issued one bounded query at a time to `https://overpass-api.de/api/interpreter`. It selected actual ways tagged river, stream, canal, drain or ditch and requested body geometry, retaining ordered node IDs. Frozen raw JSON, exact query, UTC retrieval time, OSM base timestamp, bbox, count, URL, licence and SHA-256 are in `research/gis/waterways-v4/<area>/`. Existing files are not overwritten by the acquirer; use a new dated source directory for a refresh.

| Area   | Bounds: west, south, east, north |  Ways | Connected components |
| ------ | -------------------------------- | ----: | -------------------: |
| Dhaka  | 90.20, 23.65, 90.60, 24.12       | 2,431 |                  229 |
| Sylhet | 91.80, 24.85, 91.94, 24.96       |   293 |                   64 |
| Dacope | 89.40, 22.40, 89.70, 22.70       | 2,159 |                  556 |

These are query extents, not administrative completeness claims. Ways returned by the bounding query can have vertices outside the bounds; the complete returned source geometry is retained rather than manufacturing clipped connections. The snapshots were acquired 17 November 2026; map recency is not current water-quality evidence. Overpass is not used at runtime. Source terms: [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

## Connectivity and spatial matching

The offline builder connects ways that share an actual OSM node ID, including internal vertices. It does not connect apparent line crossings, proximity gaps, isolated monitoring stations or guessed sampling order. Components are undirected. The original mapping direction, tidal and flow-direction tags are retained as source attributes but do not become verified hydraulic routing. Coordinates stay WGS84 longitude/latitude; no distance is measured as degrees.

Nearest-section matching uses local equirectangular segment projection around the sample (Earth radius 6,371.0088 km) and at most 750 m of projected gap. It preserves the sample position and stores the matched original way ID, projected coordinate, component and gap. This distance threshold is a product screening assumption; at a confluence or alongside parallel canals the nearest line may not be the sample's true channel. The UI therefore displays both the named sample river and mapped channel, and explicitly requests field confirmation. Tidal flow, vertical separation, weirs, closed gates, subterranean drainage and map omissions can invalidate a hydraulic interpretation.

“Other sampled places” means on the same mapped component and within 5 km straight-line distance. It is not a downstream distance, travel time, pollutant footprint or affected population. Nearby inventory points within 2 km remain independent candidates; surface-water chemistry cannot certify or contaminate a neighbouring well by proximity alone.

## Original chemistry and other evidence

The [Dhaka v1 dataset](https://data.mendeley.com/datasets/xftpv7jvx3/1), DOI `10.17632/xftpv7jvx3.1`, by Parishmita Sinha, Nirab Debnath and Prithwiraj Bhattacharjee is CC BY 4.0. Original raw file SHA-256 remains `baa149c139cc514b1f339015f49cb8afca459e1c2e7323e10f5d7b6defa49a7a`. Six source records contain invalid negative values; invalid parameters are excluded from screening, not converted to passing values. The catalogue preserves rows and exposes complete dated histories rather than extrapolating a time series. No supplied WQI or pollution label is adopted as a validated model target or public safety rating.

The 2023 inland-fisheries objectives retained from the existing validated implementation are pH 6–9, DO ≥5 mg/L, COD ≤50 mg/L. The screen reports failed/tested parameters out of these three, versus twelve listed objectives; the gazette and page are linked. Older measurements are retrospectively compared, not judged for historical legal compliance. No clinical or potability conclusion follows.

The [BASIS v2 dataset](https://data.mendeley.com/datasets/bncwnj8yjt/2) provides real Sylhet drainage observations but no reliable coordinate crosswalk for its quality stations. Forty positions in the separate velocity worksheet are drawn only when that layer is selected and labelled velocity survey, dated 16 May 2025. Quality station IDs and unlocated mass-balance means are not joined to them. The complete workbook and earlier validated mass-balance research remain available; a researcher must establish the crosswalk before building a quality map from it.

The Kaggle publisher-context layer retains 9,958 source coordinates, classes and values. Sampling dates, parameter units and class validation are unknown. It is optional, styled separately and never propagates a class over mapped channels. At most 300 area-filtered points are drawn for performance; the selector/export accesses the complete area subset. The legacy GIS source audit and raw file remain included.

## Sustainable supply accounting

Daily collected litres = max(0, rainfall mm − entered loss mm) × roof m² × collection share. Rain enters first, overflow above tank capacity is removed, then entered daily demand is served. Initial storage is bounded by capacity. Each day and the total obey volume conservation. Identical rainfall totals with different timing can produce different shortages; the complete daily sequence is visible and exported. Starter values are explicitly illustrative. The model excludes evaporation, treatment performance, groundwater recharge/yield and weather forecasts.

Leak litres/day = collected millilitres ÷ 1000 ÷ timed seconds × 86,400. The estimate assumes that measured rate stays constant. No unsupported “litres per drip” is used.

Collection volume does not clear rainwater for drinking. See [WHO small-water-supply guidance](https://www.who.int/publications/i/item/9789240088740). Boiling/disinfection do not remove salts, heavy metals and most chemicals: [EPA treatment limitations](https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water). This platform does not replace local emergency instructions or water-safety management.

## Privacy and saved state

Public inventory/stream/history endpoints do not read private tables. New writes require authenticated identity from the existing trusted gateway and same-origin JSON requests; body sizes and field ranges are bounded. User identity is never taken from the submitted body. Private records are owner-filtered. Water checks and their audit event commit together. Measurement/case retry keys are owner-scoped; repeated identical payloads return the original row, conflicting payloads fail with 409. Cases preserve revisions and audit history.

Entry drafts and import queues stay in this browser tab's session storage so sign-in or navigation need not discard them. This is local browser storage, not account synchronization; clear the tab's site data on a shared device. Saved source checks are kept separately by source ID. GPS is requested only by explicit action. Source-search coordinates are sent to the server for that search; the application does not write them as telemetry or a check. Existing device GPS/private trip permissions remain separate. Exports may contain user-entered coordinates and notes; share deliberately.
