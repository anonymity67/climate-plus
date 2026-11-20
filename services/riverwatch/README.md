# RiverWatch BD — Bangladesh waste-source & river screening web GIS

A ready-to-deploy web GIS that maps **industrial waste sources, landfills/dumpsites,
waste transfer stations and wastewater plants** across Bangladesh, links each one to the
directed river network, follows its modelled **10 km downstream corridor**, counts
**residents and sensitive facilities** near that corridor, and — for a Dhaka–Narayanganj
pilot — compares **Sentinel-2 upstream vs downstream water optics** on the same scene.
Sources that are high-hazard *and* sit right on a river are flagged as **critical to rivers**.

It is built on the RiverWatch BD screening package (river-network linking, sampling probes,
union-based population counts, review queue — see `docs/RIVERWATCH_METHOD.md`) and adds a
web front end, a JSON API, a credential-free Sentinel-2 fetcher, real Bangladesh inputs, and
an analyst review → re-run workflow.

> **Desk screening only.** It does not identify a polluter, establish permit violations,
> measure contaminants, predict a plume, or establish human exposure. A rank means
> "review this case first", not "this site pollutes".

---

## 1. What is in the box (all real, public data)

| Layer | Source | Count (build of 2026-11-19) |
|---|---|---|
| Waste sources | OpenStreetMap (Geofabrik extract 2026-11-19): `man_made=works`, `landuse=industrial`, `industrial=*`, tanneries/dyers, `landuse=landfill`, `amenity=waste_transfer_station`, `man_made=wastewater_plant` | **4,898** (4,790 industrial · 73 landfill/dump/transfer · 35 wastewater plants) |
| River network | HydroRIVERS v1.0 (whole reaches, `HYRIV_ID`/`NEXT_DOWN`) | 52,960 reaches |
| Population | WorldPop 2020, 100 m, people per pixel | national raster |
| Receptors | OSM schools, hospitals, drinking water, water wells | 12,804 |
| Water bodies | OSM named lakes/haors/reservoirs ≥ 0.5 km², named rivers | 105 / 207 |
| Boundaries | geoBoundaries ADM0/1/2 | 8 divisions, 64 districts |
| Satellite | Sentinel-2 L2A via Earth Search (AWS), 2025-11-01 → 2026-05-01 | 148 scenes → 1,477 sample rows → 109 valid same-scene pairs |

Headline results (national run): **4,331** sources linked to a reach within 1.5 km;
**171 critical-to-river** sources (Red-tier potential hazard within 500 m of a reach — 137
industrial, 20 wastewater plants, 14 landfills; Buriganga 38, Bangshi 5, Dhaleshwari 3 …);
**≈18.3 M residents** within 500 m of the modelled corridors (counted once from the *union*
of zones). Pilot: 29 sources + 2 reference reaches, 20 with paired optical dates, 6 with ≥ 6
pairs (scored).

No site has a complete rank yet, by design: the method requires a **documented outfall,
its citation and a reviewed flow direction**. The UI shows each site's possible score range
until an analyst confirms the link.

## 2. Run it

### Docker (recommended)
```sh
export RIVERWATCH_ADMIN_TOKEN=$(openssl rand -hex 16)   # omit for a read-only public map
docker compose up --build
# open http://localhost:8000
```

### Local Python (3.11–3.13)
```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-web.txt
python scripts/fetch_data.py --serve-only && python scripts/prepare_population.py   # only needed for re-runs
RIVERWATCH_ADMIN_TOKEN=change-me uvicorn webapp.main:app --host 0.0.0.0 --port 8000
```
The committed `runs/` folder already contains computed results, so the map works
immediately. See `DEPLOY.md` for Render/Fly/VM deployment notes.

### Rebuild every output from source data (~15 min)
```sh
pip install -r requirements.txt
bash scripts/build_all.sh
python -m unittest discover -s tests -v
```

## 3. Using the web UI

* **Run selector** — *National screening* (all sources, no satellite) or *Dhaka–Narayanganj pilot* (with Sentinel-2).
* **Overview** — KPIs, critical-to-river count and rule, union population, amenities, hazard tiers, critical sources by division, route stop reasons, optical QA, run settings.
* **Review queue** — filter by category, ECR tier, division, critical-only, linked-only, receiving river, hide brick kilns; sort by score range, population, distance, optical contrast. The map follows the same filter.
* **Rivers** — named receiving rivers ranked by critical and total linked sources; click to zoom/filter.
* **Layers** — basemaps (Esri light grey, OSM, Esri satellite, dark), divisions/districts, HydroRIVERS (width ∝ discharge), OSM named rivers, water bodies, clustered sources, critical corridors, footprints, severity-weighted heatmap, population union.
* **Site drawer** — action recommendation, score range & components, receiving reach / river / discharge, snap method & distance, route length & stop reason, WorldPop residents, schools/hospitals/drinking water/wells, Sentinel-2 up/down NDTI time series with unusual dates, provenance (OSM link, inferred type, severity source), satellite check.
* **Analyst review** (token) — set *outfall confirmed* + source, pick outfall coordinates on the map, *flow reviewed*, receiving reach override, documented severity + source, notes. **Re-run analysis** applies all reviews and re-executes the pipeline (pilot: optionally re-fetches Sentinel-2 for changed sampling geometry).
* **Downloads** — `review_queue.csv`, `riverwatch.gpkg` (open in QGIS), `samples_gee.csv`, `paired_observations.csv`, `manifest.json`, sites GeoJSON, reference layers.
* Shareable links: `/#run=national&site=IND-n11662133793`.

## 4. Definitions

* **Hazard tier** — Bangladesh ECR 1997 Sch.1 / ECR 2023 category (Red 1.0, Orange-B 0.66, Orange-A 0.33, Green 0.10), *inferred from OSM names/tags*; see `data/severity_rubric.md`. Landfills and wastewater plants are Red. Unknown stays blank (never zero).
* **Critical to rivers** — Red tier AND snapped ≤ 500 m (`RIVERWATCH_CRITICAL_SNAP_M`) to a reach with a modelled downstream route. A proximity flag, not proof of discharge.
* **Score** — weights optical 0.35, severity 0.30, population 0.25, POI 0.10; missing components give a range. Complete ranks need a reviewed link, an unbroken route and all weighted inputs.
* **Optical** — NDTI = (B4 − B3)/(B4 + B3) on clear (SCL 4/5/6) water (NDWI > 0.05) pixels within 25 m of probes 500 m up/downstream; daily same-scene contrast; median over ≥ 6 dates.

## 5. Repository layout

```
riverwatch/            pipeline (geo.py, evidence.py, __main__.py, demo.py) + s2_stac.py (Sentinel-2, no credentials)
gee/sentinel2_pairs.js Earth Engine alternative producing the same CSV
webapp/main.py         FastAPI server: API, review workflow, background re-runs
web/static/            Leaflet UI (vendored libs, no CDN), reference GeoJSON layers
scripts/               fetch_data, clip_hydrorivers, extract_osm, prepare_inputs, prepare_population, select_pilot, build_all.sh
configs/               national.json (EPSG:3106 BTM), dhaka_pilot.json (EPSG:32646)
data/inputs/           sites, pilot sites, rivers.gpkg, pois, reach names
data/observations/     Sentinel-2 paired observation exports
data/sources.json      source manifest (title, provider, URL, version, licence, units, gaps)
runs/                  computed runs (+ runs.json registry); runs/demo = synthetic demo
app.py                 original Streamlit analyst dashboard (python -m streamlit run app.py)
docs/RIVERWATCH_METHOD.md  original method README (pilot workflow, QA, interpretation)
```

## 6. Known limitations (read before publishing)

* HydroRIVERS (15″ DEM) simplifies delta distributaries; Buriganga/Shitalakshya channels can be offset by hundreds of metres, which also moves Sentinel-2 probes off water (fewer valid pairs). Verify every link on imagery.
* OSM is uneven and partly outdated (e.g., Hazaribagh tannery points persist after the 2017 relocation to Savar). Brick kilns (1,727) dominate counts — use the filter.
* Tidal reaches can reverse flow; leave `flow_reviewed` false there unless independently supported.
* Population = WorldPop 2020 model; in-country NoData (water) is treated as 0.
* Keep questionable facility-level links internal; publish aggregates where needed. Credit: © OpenStreetMap contributors (ODbL), HydroSHEDS, WorldPop (CC BY 4.0), geoBoundaries (CC BY 4.0), contains modified Copernicus Sentinel data 2025–2026.
