# RiverWatch BD

A desktop-built GIS screening workflow for industrial discharge sites in Bangladesh.
It links sites to a directed river network, compares upstream and downstream optical
conditions on the same Sentinel-2 scene, counts residents and mapped facilities near
modeled downstream reaches, and produces a desk-review queue.

**It does not identify a polluter, establish permit violations, measure contaminants,
predict a plume, or establish human exposure.** No inspection findings are included.

## 1. Run the synthetic demo

Use Python 3.11. From the extracted `RiverWatch-BD` directory:

```sh
python -m venv .venv
```

Activate with `source .venv/bin/activate` on macOS/Linux or
`.\.venv\Scripts\Activate.ps1` in Windows PowerShell. Then:

```sh
python -m pip install -r requirements.txt
python -m riverwatch --demo --out runs/demo
python -m unittest discover -s tests -v
python -m streamlit run app.py
```

Open the local URL printed by Streamlit. The dashboard starts on `runs/demo`.
All demo locations, records, population values, and optical measurements are
synthetic. The basemap depicts real geography and needs internet access; the
analysis and GeoPackage work without it once the Python dependencies are installed.

## 2. Prepare a real pilot

Start with 10–30 sites on one comparatively wide river corridor. Do not begin with
every industry in Bangladesh. Save one source manifest for your team recording
each dataset's title, provider, URL, version, date obtained, license, units, and
known gaps. Review data-sharing terms before publishing outputs.

| Input | Preparation |
|---|---|
| `sites.geojson` | Your existing point layer. Keep `site_id` stable. Use documented outfall coordinates where available. |
| `rivers.gpkg` | Export one HydroRIVERS line layer from https://www.hydrosheds.org/products/hydrorivers. Preserve `HYRIV_ID` and `NEXT_DOWN` and extract **whole** reaches around the pilot, including a downstream margin beyond the configured corridor length. Do not dissolve or simplify the network before QA. |
| `population.tif` | Obtain a Bangladesh WorldPop raster at https://www.worldpop.org/ or an equivalent source. Use **people per pixel**, not people per square kilometre. Keep the source grid and record its population year. |
| `pois.geojson` | Optional OSM data. Use QGIS QuickOSM or Overpass Turbo, restrict to the pilot area, and credit OpenStreetMap contributors. Missing OSM features do not prove absence. |
| Sentinel-2 | Obtained through Earth Engine using the included script. You need Earth Engine access and a registered Google Cloud project. |

Recommended site columns:

| Column | Meaning |
|---|---|
| `site_id` | Required unique text ID, e.g. `BD-001`. |
| `name`, `industry_type` | Display fields, not proof of hazard. |
| `role` | `site` (default) or `reference`. Reference locations are not ranked or included in the population headline. |
| `outfall_confirmed` | Set true only for a documented outfall location. A factory centroid or gate is not an outfall. |
| `outfall_source` | Citation, record ID, or URL supporting that location. |
| `receiving_reach_id` | Optional manual override using the correct `HYRIV_ID`. Also subject to the snap-distance limit. |
| `flow_reviewed` | Set true only after checking the proposed receiving reach and flow direction. Leave false for ambiguous, tidal, or seasonally reversing flow, unless the direction is independently supported for your analysis period. |
| `severity` | Optional 0–1 severity input from a rubric you define and document. Leave blank when unknown. Use the same rubric across comparable sites. |
| `severity_source` | Required supporting citation for a severity value to affect ranking. |
| `discharge_m3d` | Optional documented discharge volume; shown for context, not used to infer severity or concentration. |

Possible Overpass Turbo query (replace the bounding box with your pilot extent).
Export the result as GeoJSON. The Python package also accepts a normalized
`poi_type` field with `school`, `hospital`, `drinking_water`, or `water_well`.

```text
[out:json][timeout:60];
(
  nwr["amenity"~"^(school|hospital|drinking_water)$"]({{bbox}});
  nwr["man_made"="water_well"]({{bbox}});
);
out geom;
```

## 3. Build and check the geometry first

Update `population_label` in a copy of `config.json` with your product, year, and
units. EPSG:32646 is the default for the Dhaka-area pilot; choose a locally
appropriate projected metre CRS for other areas. The population raster stays in
its original CRS.

```sh
python -m riverwatch --sites data/sites.geojson --rivers data/rivers.gpkg --population data/population.tif --pois data/pois.geojson --config config.json --out runs/pilot_prep
```

Omit `--pois` or `--population` if unavailable. The workflow still runs; missing
inputs stay missing, and the affected sites may not qualify for a complete score.

Open `runs/pilot_prep/riverwatch.gpkg` in QGIS. Compare `sites`, `links`, `rivers`,
`sampling_points`, `corridors`, and `proximity_zones` with aerial imagery and
published plans or receiving-water information:

1. Check all pilot outfalls and receiving reaches. Look for parallel canals,
   culverts, a factory across the river from a proposed link, and ambiguities
   near junctions. Use `receiving_reach_id` to correct a wrong automatic link.
2. Verify the two sample points are in open water on the same channel and there
   is no known major inflow, confluence, dredging activity, or interfering
   industrial discharge between them.
3. Check flow direction. The code uses the `NEXT_DOWN` topology and endpoint
   continuity rather than assuming that vertex order means downstream. The
   topology cannot establish real-time flow direction in a tidal reach.
4. Review where each modeled route stops. If the network is clipped or broken,
   expand or repair the source extraction; do not silently connect it by distance.
5. Save your corrections to the input layer and rerun. Keep unverified locations
   provisional. Remote review is not a substitute for field verification.

## 4. Export paired Sentinel-2 measurements

1. In https://code.earthengine.google.com/, upload
   `runs/pilot_prep/samples_gee.csv` as a table asset. Use `longitude` as X and
   `latitude` as Y in WGS84. Keep `pair_id` and `side` as text fields.
   Verify the asset displays as point features.
2. Paste `gee/sentinel2_pairs.js` into the Earth Engine Code Editor.
   Set `ASSET`, `START`, and `END`. The end date is exclusive. A single dry-season
   pilot can use `2023-11-01` through `2024-05-01`. Keep dry and wet seasons
   separate for interpretation. Match `RADIUS_M` to `sample_radius_m` in the
   Python config. Don't mix exports made with different water/cloud settings.
3. Run the script, then start `riverwatch_obs` in the **Tasks** tab. Download
   the resulting CSV from Drive. For larger areas, export separate clusters or
   time windows. A reference site or two on the same river helps contextualize
   the observed contrast.
4. Import the CSV with the same input geometry and settings used for preparation:

```sh
python -m riverwatch --sites data/sites.geojson --rivers data/rivers.gpkg --population data/population.tif --pois data/pois.geojson --config config.json --observations data/riverwatch_obs.csv --out runs/pilot
```

Multiple CSVs may follow `--observations`. Use a separate output folder for each
analysis period if comparing seasons. A changed sampling geometry produces a new
pair ID, and old observations for that pair are excluded automatically.

Run `python -m streamlit run app.py` and enter `runs/pilot` in the sidebar.
You can open the same run's GeoPackage directly in QGIS.

## 5. Interpret the outputs

| Output | Meaning |
|---|---|
| `riverwatch.gpkg` | Sites, oriented river network, candidate snaps, sampling points, downstream paths, proximity zones, and the union used for the population headline. Empty spatial layers are omitted. |
| `samples_gee.csv` | Point coordinates and pair identifiers for Earth Engine upload. |
| `paired_observations.csv` | Valid same-scene pairs. If there are overlapping tiles, the pair with the most usable pixels on its weaker side is kept per date. |
| `review_queue.csv` | Geometry checks, optical contrasts, population and POI counts, score components, and suggested review action. |
| `manifest.json` | Run settings, input paths, screening counts, observation QA, demo flag, and union results. |
| `synthetic_observations.csv` | Demo-only satellite-like inputs; not measurements. |

**Optical comparison.** NDTI is `(red − green) / (red + green)`. The analysis
uses the daily same-scene downstream-minus-upstream contrast and reports its
median. A positive contrast can reflect sediment, water color, or other
conditions. The normalized optical component is a screening heuristic, and a
large contrast on an individual date is a review flag, not a discharge event.
Too few valid paired dates means insufficient observations, not clean water.

**Downstream geometry.** Paths start at the snapped location and follow the
network for up to `corridor_km`. The optional `relative_index` is only an
illustrative distance-decay index; it has no concentration units. The default
500 m buffer is a proximity scenario, not a flood extent, groundwater pathway,
or exposure boundary. The code follows one encoded downstream branch.

**Population.** People-per-pixel counts are summed using valid raster cell
centers. The headline comes from the union of candidate and reviewed non-reference
zones, not the sum of the site rows. It includes provisional geometry and is
labeled accordingly. Partial raster coverage is flagged. OSM schools, hospitals,
drinking-water tags, and wells are mapped amenities, not evidence of contamination
or that a well supplies potable water. Distinct OSM objects for the same real
facility can remain even after object-ID deduplication.

**Ranking.** Four components have explicit weights: optical contrast, documented
severity, residents near the corridor, and mapped facilities. Missing components
show a possible score range and don't get treated as known zeroes. Complete
ranks require a reviewed link, an unbroken modeled route, and all positively
weighted inputs. A rank means "review this case first," not "this site pollutes."
OSM and image availability vary systematically; check for resulting bias.

## 6. Validation and competition demo

- Check published monitoring or discharge records independently of the ranking.
  Treat disagreements as findings to explain, not as bugs to remove.
- Use one reference reach and compare a dry-season run against a separate wet-season
  run. Report how many paired dates and sites passed QA in both.
- Run 250 m, 500 m, and 1 km proximity scenarios and compare the **union** totals.
  Vary the scoring weights and record which sites stay near the top of the queue.
- Show the number of candidate sites that could not be linked or ranked and why.
- Demo sequence: **pick a site -> inspect the optical comparison -> follow the
  modeled route -> quantify nearby residents -> explain the review recommendation**.
  Show real results only after they are actually computed. Keep questionable
  facility-level links in an internal queue; publish aggregate views if needed.
