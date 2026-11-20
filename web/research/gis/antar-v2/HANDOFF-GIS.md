# Climate++ GIS handoff (kit v0.2.0 + GIS layer)

From Ahnaf. This is an overlay for the v0.2.0 collaborator kit: 15 files added or changed, nothing deleted.
The engine (`src/engine.mjs`) and planner are unchanged. Everything is synthetic or labelled with its source.

## 1. Apply it (10 minutes)

1. Copy everything inside `repo/` over the kit root (the folder with `package.json`), choosing Replace.
2. `npm ci`, then `npm run check`. Expect 47 tests passing, a clean build and `20 frozen data/reference assets checked; 0 failures`.
3. `npm run dev`, open http://127.0.0.1:5173, click **Calamity & GIS**, press **Severe storm**.
4. `npm run verify:handoff` will now fail. That is expected after any edit (see the kit README); use `check`.
5. Optional Python tests for the router: `python -m unittest tests/test_route.py -v` (8 tests, standard library only).

`src/App.jsx` is a whole-file replacement of the v0.2.0 file. If you changed `App.jsx`, apply only the edits in section 3.

## 2. What is in the overlay

| File | Purpose |
| --- | --- |
| `research/gis/v1/climate_gis.gpkg` | The QGIS GeoPackage: roads, waterways, six nodes, two catchments, hazard polygons, route and access layers. Source of all GIS numbers. |
| `scripts/build-gis-network.py` | Stdlib script: GeoPackage to `public/data/gis-network.*`; `--register` updates both manifests. Deterministic. |
| `public/data/gis-network.json`, `.geojson` | What the browser reads: ids, capacities, access results per condition, derived planner inputs, geometry. |
| `src/gis-network.mjs` | Helpers: conditions, captions, status labels, receipt inputs. |
| `src/CalamityPanel.jsx`, `src/components/ContinuityMap.jsx`, `src/continuity-map.css` | The **Calamity & GIS** tab: Storm/Salinity, storm severity, clickable nodes and catchments, access table. |
| `src/deeplink.mjs` | `?view=hazard&scenario=storm&condition=severe` links; invalid values are ignored. |
| `scripts/route.py`, `tests/test_route.py` | General shortest-route tool with blockades (stored hazard, GeoJSON polygon, point and radius, road id). |
| `tests/gis-map.test.mjs`, `gis-network.test.mjs`, `deeplink.test.mjs` | Node tests, including ids and numbers matching the planner scenarios. |
| `DATA-MANIFEST.json`, `DATASETS.json` | Registered GIS source and outputs (entry `gis-dacope-network-v1`). |

## 3. Edits inside `src/App.jsx`

- Imports: `CalamityPanel`, `PollutionPanel`, `buildDeepLink`, `parseDeepLink`, `defaultCondition`, `gisReceiptInputs`, and the `MapPinned` icon.
- `NAV`: `['hazard', 'Calamity & GIS', MapPinned]` and `['pollution', 'Pollution monitoring', FlaskConical]` (the old "Pollution & GIS" tab, renamed, same panel).
- State: `link` (parsed URL), `gis`, `gisGeo`, `mapCondition`; `mapHazard` is derived from the scenario, so the Calamity tab follows the desk scenario.
- Effects: fetch `/data/gis-network.json` and `.geojson`; reset the storm severity when the scenario changes; write the address bar with `buildDeepLink`.
- `makeReceipt`: adds `geography: gisReceiptInputs(gis, mapCondition)` to the receipt.
- Render: the `hazard` and `pollution` views, headings and footer text for both, and a short paragraph under the Service network diagram linking to the map.

## 4. Decisions and honesty notes

- Network is fictional on real OSM roads (ODbL). The GIS layer is shown, not yet used by the planner.
- Travel time uses one assumed speed (25 km/h); no vehicle or traffic model.
- Status wording: open, delayed (detour at least 1.2x the clear route), extreme delay (at least 1.75x, or unreachable). Nothing is blockaded. The planner only knows usable or unusable days, so an extreme-delay day is treated as no delivery. This is a scenario assumption; thresholds and the storm schedule are for both of us to agree.
- The storm pump outage in the planner is not derived from geography (no storm polygon covers the pump).
- HDX Dacope boundary licence is still to be confirmed before public sharing.

## 5. Your task: the Pollution monitoring tab

The slot exists: **Pollution monitoring** shows the existing `PollutionPanel` (Dhaka measurements, Sylhet survey, source investigation, validation). It has no Dacope content by design.
To add the Kaggle river-pollution data (3 GB, I am inspecting it; it may cover Dhaka only, so it must not appear on the Dacope map):

1. Keep the raw file outside the repo. Check its licence and record author, version, URL and licence.
2. Reduce it with a stdlib script to one row per station, year and parameter (mean, min, max, n), a few MB at most, in `public/data/`.
3. Register it in `DATASETS.json` (source, licence, transformation, limits, SHA-256) and `DATA-MANIFEST.json`, then `npm run verify:data`.
4. Add it to `PollutionPanel.jsx` as a labelled layer, reusing `ResearchMap.jsx` and the existing screening wording (pH 6-9, DO at least 5, COD at most 50 mg/L, only where the dataset has those parameters).
5. The link `?view=pollution` already works (`deeplink.mjs` accepts it).

Rebuild GIS data after any GeoPackage change: `python scripts/build-gis-network.py --register`, then `npm run check`.
