# Dacope bounded road graph and routing

The operational route engine uses the actual `roads_dacope` geometry in the supplied `research/gis/v1/climate_gis.gpkg`. It does not use the fictional water-network scenario lines as an operating road network. Road geometry is attributed to © OpenStreetMap contributors, ODbL 1.0, from the HOT extract embedded in that GeoPackage. Water assets and hazards remain representational project layers.

## Rebuild and verify

Requires Python 3 and Node 24, without third-party graph or geometry packages:

```sh
python scripts/build-road-graph.py
node --test tests/routing*.test.mjs
npm test
```

The builder reuses the existing GeoPackage/WKB decoder in `scripts/build-gis-network.py`, retaining source coordinate precision rather than the older six-decimal display export. It writes identical canonical UTF-8 JSON plus a newline to `public/data/dacope-road-graph.json` and `backend/data/dacope-road-graph.json`. These generated files must not be reformatted. `--gpkg PATH` selects another compatible source and `--out DIRECTORY` writes both copies under another root. The tests rebuild into a temporary directory and compare every byte with the checked-in output.

The supplied database has no uncheckpointed WAL bytes. The source SHA is the complete GeoPackage file; `roadsSha256` separately hashes the parsed source road rows. There are no generation timestamps, random IDs, network downloads or hidden proximity connections.

| Snapshot                             | Value                                                              |
| ------------------------------------ | ------------------------------------------------------------------ |
| Source GeoPackage SHA-256            | `033646cae59e23c55655668323a72bca7219e257d21050b05fa2ca96de2ced65` |
| Canonical parsed road rows SHA-256   | `9c6611a1b8cb76e38ed35d5cd5615805988bad8fc1ef2d276f985a96df4f0415` |
| Graph content SHA-256                | `e5a7726cecac44f91f12762ae5828f40bdb19d28e9edb0f252622d882e96af49` |
| Each exported file SHA-256           | `22d5a896ad278b01570748fe9589e205f4f4e3de4b75d54a356fca4908826d0f` |
| Each exported file bytes             | 905,352                                                            |
| Source features / shape vertices     | 927 LineStrings / 15,914                                           |
| Graph nodes / graph edges            | 1,425 / 1,563                                                      |
| Road-profile source features / edges | 884 / 1,514                                                        |
| Road-profile connected components    | 40                                                                 |
| Bounds `[west,south,east,north]`     | `[89.4052272,22.2215553,89.6351285,22.6508001]`                    |

`graphSha256` hashes only `{schema,nodes,edges}` using Python `json.dumps(sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)`, encoded as UTF-8. Metadata is excluded to avoid self-reference. `graphHashDefinition` records this definition in the export. File SHA includes metadata and the trailing newline.

## Topology and coverage assumptions

Coordinates are rounded to eight decimal degrees (at most about 1.1 mm per axis). Equal source vertices join only when `(layer,bridge)` grades match, when both original LineStrings end there, or when a bridge endpoint exactly meets an existing ground-road vertex. The last case assumes a bridge ramp junction; it does not require the ground LineString to end. It is necessary for supplied bridge `fid=406981` (`bridge=yes, layer=-1`) to meet road `fid=406999` at its existing interior vertex. That source combination is retained, not corrected to a guessed layer.

A missing layer defaults to 1 for bridge-tagged roads and 0 otherwise. Bridge interiors remain separate from ground roads. The builder records three shared coordinate locations with excluded grade connections and 259 endpoint grade-transition pairs. Different source vertices that merely lie close together are not joined. A line crossing without an explicitly shared vertex is not noded. This is conservative topology from geometry, not a recovery of original OSM node IDs or a field-validated junction inventory. Missing or inconsistent grade tags remain a limitation, and ramp transitions can require field confirmation.

Ordinary shape vertices are retained inside edges, with splits at source endpoints and shared junctions. This produces 1,563 usable edges rather than treating all 15,914 shape vertices as junctions. Each edge ID is `e-{sourceFid}-{startVertexIndex}-{endVertexIndex}`. Node IDs hash the rounded coordinate and its source-vertex group. Rebuilding the same source produces the same IDs and bytes.

The network has 40 road-profile components. Its three largest contain 450, 389 and 348 nodes, respectively. The rectangular bounds are a coverage envelope; they do not mean every location inside is connected or accessible. No ferry, canal crossing, missing road or off-road bridge is invented to connect these components.

All 927 source `oneway` values are absent. Their edges are inferred bidirectional, clearly disclosed in metadata and responses. The builder and engine can preserve an explicit one-way edge in other supported inputs, but the source cannot establish present legal direction or vehicle permission.

## Vehicle road profile and ETA

The only current profile is `road`. It conservatively excludes ten `footway`, 32 `path` and one `pedestrian` features. Supported source counts are 335 residential, 469 unclassified, 57 service, 22 tertiary and one living street. A highway tag does not prove vehicle access, width, loading capacity or current condition.

The primary objective is minimum distance, computed by Dijkstra over available road edges. Distances are Haversine shape lengths with mean Earth radius 6,371,008.8 m, without elevation adjustment. The input speed must be numeric and between 1 and 100 km/h. ETA uses the lesser of that assumed speed and each type's assumed cap:

| Highway                      | Cap km/h |
| ---------------------------- | -------- |
| tertiary                     | 40       |
| residential / unclassified   | 25       |
| service                      | 15       |
| living_street / livingstreet | 10       |

These are modelling caps, not measured speeds or posted limits. Stops, traffic, weather, flooding, bridge capacity, vehicle loading and road condition are unmodelled. A route establishes neither flood-safe travel nor water safety.

Each endpoint projects to the closest point on a supported road shape segment, including long segment interiors. A virtual split provides the exact partial-edge route. Snapping occurs against the supported network before closure exclusions, so a closed nearest road cannot silently move an endpoint onto a farther open road. Endpoint gaps over 250 m return `off_graph`; gaps over 50 m add an explicit unverified-connector/canal warning. The 250 m cap is a bounded search assumption, not proof that a connector is traversable. All gaps and snapped coordinates are returned separately; connector travel is excluded from route distance and time. Callers must show this and must assess GPS staleness and accuracy before replacing configured trip endpoints.

An alternative uses a fourfold shared-primary-edge penalty, and therefore is not claimed to be the exact second-shortest path. If that returns the primary unchanged, the engine searches replacements excluding one primary edge at a time, bounded to the first 64 primary edge IDs. That fallback limit is reported if reached. Every returned alternative is an actual, connected, distinct graph path. No distinct path found is explained in warnings. A disconnected or excluded network returns no road geometry, rather than a straight-line fallback.

## Shared module contract

`routing/engine.mjs` exports `createRoutingEngine(graph)` with `{metadata,route,pointAlongRoute}`. It uses only standard JavaScript and is usable in Node and Workers. `metadata.edgeIds` lists every valid graph edge ID for API closure validation; `metadata.maxSnapDistanceM` is 250. The graph schema is `climate-plus/road-graph-v1`, with nodes `{id,coordinates:[longitude,latitude]}` and edges `{id,from,to,coordinates,lengthM,highway,name,sourceId,sourceFid,bridge,layer,oneway,bidirectional}`. Metadata includes source hashes, coverage, counts, profile rules and limitations.

```js
const engine = createRoutingEngine(graph);
const result = engine.route({
  origin: { latitude: 22.523947, longitude: 89.548391 },
  destination: { latitude: 22.555446, longitude: 89.505385 },
  closures: [{ id: 'reported-blockage', edgeIds: ['e-407214-0-9'] }],
  assumedSpeedKmh: 25,
  profile: 'road',
});
```

Results have `{status,routes,snap,excludedEdgeIds,source,warnings}`. Statuses are `ok`, `invalid_input`, `unsupported_graph`, `off_graph` and `disconnected`. Failure statuses always have `routes:[]`. `source` carries the graph metadata and route assumptions, not a claim that a closure was independently verified.

Every route has `{id,distanceM,durationS,edgeIds,geometry,edges,method}`. Geometry is a GeoJSON LineString in travel order. Route edges have `{id,name,coordinates,lengthM,highway}`, with clipped first/last shapes. Stable route IDs depend on ordered traversed edges and snapped endpoints. A moving endpoint can therefore change a route ID; preferences need the backend's current-route validation and fallback. Snap results are `{origin:{edgeId,coordinate:{latitude,longitude},distanceM},destination:{...},maxDistanceM}`. Distances/times are returned to 0.001 units for computation, not to suggest measurement accuracy; the UI should round them appropriately.

Closures support known `edgeIds` and numeric `{latitude,longitude,radiusM}` or GeoJSON Point, Polygon and MultiPolygon geometry, optionally inside a Feature. Point radius defaults to 30 m and is bounded to `(0,2000]` m. Radius distance and polygon intersections check entire shape segments, including intersections between stored vertices. Geometry closures exclude every touched **whole graph edge**, not only a clipped portion; this conservative granularity can enlarge a detour. Direct edge IDs exclude both directions of a bidirectional edge. Unknown IDs and malformed closure coordinates/geometry return `invalid_input`. The caller is responsible for supplying only active, scoped, authorized closures; this module has no identity, expiry or report-validation authority. Up to 100 closure objects, 2,000 edge IDs per closure, 5,000 polygon vertices per closure and 10,000 polygon vertices per request are accepted. Bounding-box filters skip spatial intersection work for distant closures.

`pointAlongRoute(route,distanceM)` follows the routed geometry, scales within each edge's network length and returns `{latitude,longitude,heading}` in degrees. Distances clamp to route ends; no route or invalid geometry returns null. This supports separately labelled replay, not live device telemetry.

## Known route evidence

For the supplied representational supplier `(89.548391,22.523947)` and reserve `(89.505385,22.555446)`, endpoint gaps are 0.002 m and 0.030 m against source road geometry. At assumed 25 km/h:

| Condition                | Primary distance / time   | Distinct alternative distance / time |
| ------------------------ | ------------------------- | ------------------------------------ |
| No active closure        | 7,892.528 m / 1,136.524 s | 11,209.758 m / 1,614.205 s           |
| Exclude `e-407214-0-9`   | 9,740.886 m / 1,402.688 s | 11,209.758 m / 1,614.205 s           |
| Exclude every graph edge | disconnected; no route    | none                                 |

The old QGIS access-matrix value (7,881.0 m) is a separate historical scenario derivation. This graph independently measures its supplied WGS84 geometry and does not force equality with the old value.

Tests cover actual export reproducibility, source hashing, known route and blockage detour, shortest paths, true distinct alternatives, all-blocked and disconnected paths, off-graph endpoints, invalid input, grade crossings and bridge ramps, long-segment projection, clipped lengths and geometry, speed caps, one-way arcs, radius/polygon closures and replay interpolation. One local warmed Node 24 measurement of 100 supplier/reserve requests gave median 2.33 ms and p95 3.77 ms; this is developer-machine evidence, not a hosted Worker latency guarantee. The heap-based search has bounded alternative work and no external routing dependency.
