# Climate++ V3 · Water response map

**One MVP:** choose a region, apply a calamity scenario, track a delivery on real roads, and attach pollution observations to their actual coordinates. V3 is the map-first product iteration; package version 3.0.0. Earlier releases are preserved separately. Video remains deferred.

## Run in VS Code

Install Node24 LTS, extract the whole folder, and open `climateplus.code-workspace`. From its root:

```powershell
npm ci
npm run setup:local
npm run dev -- --host 127.0.0.1 --strictPort
```

Open **http://127.0.0.1:5173**. If occupied, append `--port 5190` and use that URL. PowerShell users can use `npm.cmd` if `npm.ps1` is blocked. Stop with Ctrl+C. Local maps, routing and imports need no API key; dependency installation and optional OSM basemap tiles need internet. No runtime Overpass call is required. Python is needed only to rebuild/recheck source conversions, not to use the app.

`setup:local` applies both versioned D1/SQLite migrations, preserving previous trips with default region `dacope`. A clean database starts empty. Sign-in is needed only for private saves/shared operations; loopback development supplies the documented Seedy test identity. Hosted identity uses the existing Site gateway. Do not expose local identity-header fixtures or the mock sign-in to the public internet.

## Ninety-second demonstration

1. Start in **Dacope → Normal → Reserve**. Click **Play delivery**. The moving amber marker follows ordered road geometry at 20× modelled time and is explicitly playback, not GPS.
2. Select **Storm**. The declared scenario road closure changes the shortest route from about 7.89 km to 9.74 km. Compare its alternative. Click a route segment, or use **Choose a road by name**, then **Block selected road** to reroute again. No-route results stop playback instead of inventing a straight line.
3. Select **Salinity**. A fictional area marks scenario source points held from use; it does not assert current salinity or drinking-water quality. Roads are not automatically closed by this salinity scenario.
4. Switch to **Ukhia, Chattogram (Chittagong), Khulna or Tongi**. Road geometry, all six service roles, hazard vectors and routing change together. Playback/blocks reset. This demonstrates expansion through data, not moving Dacope's coordinates to another town.
5. In **Tongi**, enable **Pollution points**. Three original historical measurement locations are within the bounded road extent. Publisher-context points are separately labelled. Selecting a point shows its original date/values/source; none is a current water-safety rating.
6. Click **Add points**. Enter a dated measurement with source attribution, or deliberately choose **Fill a labelled demo example**. Pick coordinates on the map, then **Place point on map**. The field is now part of the same GIS workflow.
7. Import CSV/GeoJSON using the formats below. Invalid rows reject the whole file. Outside-region points retain their coordinates and remain available for save/export; they are never relocated to make a map look populated.
8. **Export region GeoJSON** exports the selected region's enabled layers. **Export all entered points** backs up every point entered this session, even outside the region or with the layer off. Device GPS is excluded from both exports.

The main map makes actual requests to **POST `/api/scenario-route`**. The server validates region/role/edges and calculates the response from bundled local road graphs. The interface labels server calculation, pending verification, or explicit local-snapshot fallback. Client/server graph hashes are compared; a mismatched response cannot become the current server result.

## What came from Antar, and what expanded

Antar's `climateplus-gis-handoff-v2` supplied the useful interaction pattern: selectable service vectors, storm/salinity polygons, supplier access and condition-aware routes. Original Dacope asset coordinates and hazard vertices are preserved. His handoff explicitly describes the assets/hazards as fictional on real OSM roads; it is not independently verified fleet telemetry.

V3 adds four independent, bounded OSM road snapshots, the same six scenario roles in each, moving delivery playback, real graph exclusions/alternatives, server-side regional routing and pollution-point input. New-region asset positions are deterministic scenario choices on local road nodes. They are not actual surveyed pumps, reserves, schools, suppliers or crew bases.

| Region     | Scenario foundation                                                      | Pollution meaning                                         |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Dacope     | Original Antar service/hazard vectors; supplied OSM road graph           | No published measurement coverage invented                |
| Ukhia      | Independent bounded OSM roads; declared six-role scenario                | Source absence is explicit; new local input supported     |
| Chattogram | Independent bounded OSM roads; declared six-role scenario                | No source points moved from another region                |
| Khulna     | Independent bounded OSM roads; declared six-role scenario                | New observation field/CSV/GeoJSON supported               |
| Tongi      | Independent bounded OSM roads; three original measurement sites included | Historical Mendeley values and separate publisher context |

See **[REGIONS-V3](docs/REGIONS-V3.md)** for exact bounds, hashes, source snapshots, node/edge counts, topology, deterministic placement and example detours. These are demonstration extents, not full administrative/city road coverage. Moderate/severe polygons share a declared scenario road closure; polygon size is not a flood-impact model.

## Pollution input and persistence

CSV header (blank measurements mean unmeasured, not zero):

```csv
date,latitude,longitude,ph,do_mg_l,cod_mg_l,source
2026-10-01,23.8917228,90.38988667,7.1,3.2,65,"REPRESENTATIONAL example, no actual sample claim"
```

Select **Demonstration values** for this invented example. Real observations use **Field entry · unverified**, the actual collector/report reference and actual coordinates/date/values. Merely entering data does not authenticate a laboratory result.

GeoJSON: WGS84 FeatureCollection of Point Features, `[longitude,latitude]`, properties including date, sourceLabel/sourceKind, numeric ph/do/cod and explicit DO/COD`mg/L` units. Max 1 MiB/200 points per file; all validation is atomic. Up to 1000 entered points can be staged in one page. See **[POLLUTION-POINTS-V3](docs/POLLUTION-POINTS-V3.md)** and `examples/pollution-points-v3.*`. Downloadable copies are under `public/examples/`.

Draft fields persist when closing input or changing region. Placed/imported points remain in this page until saved/exported; reload discards unsaved page state. Sign in before entering data you need to persist, or export all entered points before sign-in/reload. Saves are acknowledged individually by the backend; after partial failure only unsaved entries retry. Saved measurements are immutable with content hashes and attribution.

Screening compares only pH/DO/COD to three inland-fisheries objectives. It is not overall WQI, potability, a contamination plume, exposure or verified industrial attribution. Unknown dates/units in Kaggle publisher classifications remain unknown. Dates are validated in the Bangladesh calendar (`Asia/Dhaka`); GPS timestamps remain UTC.

## GPS and advanced tools

The default amber marker is **scenario playback**. Expand **Device GPS & shared operations** for explicit-consent actual browser GPS. This map's device position stays local, is separately labelled and is not a scenario ETA input. Stop clears its watch and local position. No GPS permission is requested automatically.

Basemap tiles come from OpenStreetMap and disclose the viewed map area to that service. Raw device-GPS fixes are not uploaded to the application backend in this main-map view.

For private supplier/recipient sharing, persistent trips and GPS-aware routes, use **Open private live-delivery workspace**. Its creation form supports the selected road region. Owner/scoped roles, invitations, freshness/precision rules, stop/delete barriers and private pollution cases remain intact. The former dashboard tools are retained here, outside the primary MVP. See **[API](docs/API.md)** and **[DEVELOPMENT](docs/DEVELOPMENT.md)**.

## Verify and extend

```powershell
npm run check
npm run verify:handoff
# With Python and Node available for independent source reconstruction:
python tests/regions-builder.test.py
```

`check` runs formatting, generated adapter types, all numerical/API/GIS/import/GPS tests, Worker build and frozen source/derived hashes. Handoff verification checks received source bytes; intentional edits change that result. Preserve the received ZIP/checksum rather than rehashing unexpected changes.

Build/HTTP integration:

```powershell
npm run build
npm start -- --port 5191
# Separate terminal, loopback only:
npm run smoke:local -- http://127.0.0.1:5191
```

Local migrations and hosted D1 are separate. Applied SQL is immutable: append future migrations. Private runtime databases, credentials, invitation tokens, actual GPS exports, dependency installs and builds are excluded from the source ZIP. Production uses Sites gateway identity; another host requires a verified authentication adapter, not caller-chosen headers. The source configuration keeps the existing Site identity; publishing requires owner authorization.

To add a region: acquire/version a licensed local road snapshot, add its bounds/source record to the deterministic regional builder, declare labelled scenario assets/hazards, produce identical public/server graphs, extend the static registry, and test route/closure/no-route plus coordinate/provenance invariants. To add pollution: supply actual coordinates, date, unit-bearing values and attribution. Never translate a measured point to fake coverage.

Twelve original dataset sources are registered in `DATASETS.json`: the eight retained sources plus four new OSM snapshots. Queries/raw responses, dates, ODbL/source rights, transformation methods and frozen hashes are included. Eighty-one frozen source/derived/reference assets are checked. Read `ATTRIBUTIONS.md` and `LICENSE-NOTICE.md`; including data does not create a blanket redistribution licence.

Current traffic, flood safety, vehicle access, water availability and drinking-water clearance are not verified. Browser GPS can be spoofed/imprecise; no hardware or field-impact study is claimed. The optional legacy local-chain demo is separately installed, carries documented advisories and is not deployed. Zero core npm advisories does not describe that optional legacy tree. A current partner-reviewed field deployment requires authoritative records and field checks.

Structure: `src/mvp/` main map; `src/LegacyApp.jsx` secondary workspace; `routing/registry.mjs` regional engines; `backend/` API; `db/` and`drizzle/` database; `public/data/regions/` map inputs; `research/gis/regions-v3/` original OSM snapshots; `research/gis/antar-v2/` preserved handoff references; `scripts/`, `tests/`, `docs/` reproduction and contracts.
