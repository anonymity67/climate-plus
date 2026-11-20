# Five bounded response-map regions

V3 repeats Antar's calamity service-point workflow on actual local road geometry. This is a demonstration of expandable map architecture. The six service roles, hazard polygons and declared blockage effects are representational. They do not locate verified facilities, report current hazards, or certify routes or water safe. Playback is scenario movement, not GPS or live fleet tracking.

## Frozen sources and extents

Bounds below are `[west, south, east, north]` in WGS84. They are small demonstration extents, not administrative boundaries or complete city road networks.

| Region                  | Extent                                                      | Road source                                                                                                                      |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Dacope                  | Read exact graph bounds in `public/data/regions/index.json` | Existing canonical GeoPackage-derived Dacope graph; Antar asset/hazard coordinates unchanged                                     |
| Ukhia                   | `[92.118, 21.225, 92.150, 21.260]`                          | Frozen official FOSSGIS Overpass response                                                                                        |
| Chattogram (Chittagong) | `[91.812, 22.330, 91.850, 22.365]`                          | Frozen official FOSSGIS Overpass response                                                                                        |
| Khulna                  | `[89.548, 22.805, 89.585, 22.840]`                          | Frozen official FOSSGIS Overpass response                                                                                        |
| Tongi                   | `[90.385, 23.880, 90.425, 23.920]`                          | Frozen official FOSSGIS Overpass response; includes three retained Mendeley measurement sites without changing their coordinates |

For each new region, `research/gis/regions-v3/{id}/` contains the exact UTF-8 Overpass QL query, raw JSON response bytes and `source.json` with request URL, endpoint, response headers/status, acquisition start/completion in UTC, OSM base timestamp, SHA-256 of query/response, attribution and rights URLs. These records distinguish retrieval date from OSM source freshness. Khulna's main and lz4 endpoints returned HTTP 502; the official z endpoint succeeded; failed attempts are retained in its provenance. Tongi's initial extent and response remain in its `history/` directory after the southern-bound extension.

Road geometry is © OpenStreetMap contributors, licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with [OSM attribution and copyright information](https://www.openstreetmap.org/copyright). Preserve this attribution and the source records when redistributing the graph or a derivative database. Acquisition uses the [official Overpass interpreter interface](https://dev.overpass-api.de/command_line.html), only four bounded road queries, no tile downloads and no runtime Overpass calls. Original queries include all highway classes; the deterministic builder applies the restricted routing profile below.

`research/gis/antar-v2/` retains supplied HANDOFF-GIS.md, CalamityPanel.jsx, ContinuityMap.jsx and original service-network JSON/GeoJSON. Its source record lists original paths/hashes. Antar describes these points and hazards as fictional on real OSM roads. The original GeoPackage remains the existing canonical `research/gis/v1/climate_gis.gpkg`. Its Dacope boundary has unresolved HDX redistribution rights according to the handoff; V3 derives no boundary layer from it and displays no such boundary. ODbL applies to OSM roads, and does not establish a licence for the separately authored fictional assets.

## Build and contracts

Run from the project root with Python and Node on PATH:

```text
python scripts/acquire-regions.py
python scripts/build-road-graph.py
python scripts/build-regions.py
node --test tests/regions.test.mjs
python tests/regions-builder.test.py
```

Acquisition preserves existing frozen snapshots by default. Explicit `--refresh tongi` (or another region ID) archives prior source/query/response bytes under `history/{source-hash-prefix}/` before retrieving a replacement. Normal builds are offline and never update acquisition timestamps. `build-regions.py --out PATH` produces all regional files in another directory, enabling independent byte comparison. Dacope uses the existing production JavaScript routing engine for its fixed-endpoint closure proof; this is why Node is required by the builder.

`public/data/regions/index.json` declares five region IDs, names, centers, bounds, graph/scenario URLs and source metadata. Graphs follow the existing `climate-plus/road-graph-v1` schema. Each `{id}-graph.json` is byte-identical in `public/data/regions/` and `backend/data/regions/`. Scenario files follow `climate-plus/region-scenario-v1` with six assets carrying `id`, `role`, `name`, `latitude`, `longitude`, `provenance` and `sourceLabel`; storm moderate/severe and salinity GeoJSON Features; explicit storm closure `edgeIds`; and source/method/proof metadata. Other-town asset IDs are `{region}-{role}`; consumers should select by `role`, not assume Dacope IDs.

## Road topology and limits

The builder reuses `scripts/build-road-graph.py:build_topology`. It keeps original OSM coordinate vertices rounded to eight decimal places. A way crossing outside the extent is split into its contiguous inside-vertex runs; no boundary point interpolation, geometric snapping, synthetic bridges or connecting roads are added. Raw source way IDs stay on each edge. Shared source-coordinate vertices connect at compatible layer/bridge grade; original endpoints and bridge-to-ground endpoints can connect using the existing stated ramp assumption. Un-noded crossings remain disconnected. Grade tags can be incomplete or wrong; connectivity is not field verification.

The road profile permits tertiary, residential, unclassified, service and living_street/livingstreet. It excludes primary, secondary, trunk, motorway, footway, path and pedestrian classes; the resulting graphs can be fragmented and do not represent complete vehicle networks. Explicit `no`/`private` access, vehicle, motor_vehicle or motorcar ways are excluded for new-region snapshots. Missing access remains unverified; barriers, conditional access and turn restrictions are not modelled. OSM oneway tags are preserved, including reverse direction; roundabouts default one-way when direction is absent. Other missing direction is inferred bidirectional. Dacope retains the existing graph and its documented missing-direction assumptions.

New-region service points are actual local connected road nodes chosen deterministically, not facility geocodes. Supplier/reserve selection searches for a 0.5–2.5 km baseline and a replacement path at least 25 m longer. The other four roles are spaced connected local nodes. This template never translates Dacope coordinates. Original Dacope supplier/reserve/service coordinates and hazard polygon vertices are preserved exactly from the supplied handoff.

Each storm severity deliberately blocks a real edge with a demonstrated detour. Moderate and severe currently reuse that one declared edge; their different visual polygon sizes do not calculate or imply different measured road impacts. This choice avoids presenting an invented flood model. Salinity is a separate fictional polygon and declares no road closure. Source `issuedAt` in the original Dacope feature remains historical scenario metadata, not an official alert. `source.routeVerification` records deterministic baseline/detour lengths; production engine tests verify actual changed edge sequences, blocked-edge avoidance, alternatives and disconnected behavior. No straight-line fallback supplies a missing road route. Distances use spherical Haversine; route speeds/ETA are assumptions.

The coordinate-preserving pollution module is independent: absence of an observation inside a region remains absence. The Tongi extent was selected to include retained historical sites at `(23.88178903,90.40636019)`, `(23.88925303,90.42315448)` and `(23.8917228,90.38988667)`; site coordinates, dates, measurement units and source attribution are never moved or inferred from the scenario roles.
