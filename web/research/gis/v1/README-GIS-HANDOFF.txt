Climate++ GIS hand-off (Dacope water-continuity network)
=========================================================

What this is
  A fictional water network placed on real Dacope roads (OpenStreetMap), built in QGIS.
  It gives the prototype: node/catchment/hazard geometry, road-based travel results for a clear
  day, a moderate storm and a severe storm, and a derived blocked delivery day.

How to add it (about 2 minutes)
  1. Copy everything inside repo/ into the project root (the folder that holds package.json).
  2. Register the files in the two manifests:
         python3 scripts/build-gis-network.py --register
     (Windows: python scripts/build-gis-network.py --register)
     This rebuilds the two data files, then adds their sizes and SHA-256 hashes to
     DATA-MANIFEST.json and a "gis-dacope-network-v1" entry to DATASETS.json.
  3. Check:  npm run check
     The new tests are in tests/gis-network.test.mjs. One of them rebuilds the files and
     compares bytes, so the output must be reproducible.

Files
  scripts/build-gis-network.py      GeoPackage -> JSON (Python standard library only)
  research/gis/v1/climate_gis.gpkg  the QGIS output (raw snapshot)
  public/data/gis-network.geojson   nodes, catchments, hazard polygons, supplier-to-reserve routes
  public/data/gis-network.json      ids, capacities, travel results, derived blocked days, assumptions
  tests/gis-network.test.mjs        ids and capacities match src/engine.mjs; derived storm
                                    blockedDays equals [1]; results are reproducible

Result for the reserve (supplier -> reserve, one assumed speed of 25 km/h)
  clear day      7,881 m   18.9 min   open
  moderate storm 11,189 m  26.9 min   delayed  (1.42 x clear)
  severe storm   15,860 m  38.1 min   blocked  (2.01 x clear)
  Derived blockedDays for the storm scenario: [1]  (day 2), matching src/engine.mjs.

Decisions that need the collaborator's agreement (all stored in gis-network.json "assumptions")
  - Blocked rule: a day is blocked when the reserve is unreachable or the trip is at least 1.75
    times the clear-day distance; delayed from 1.2 times. Thresholds are assumptions.
  - Storm schedule: day 1 clear, day 2 severe, day 3 moderate, days 4-7 clear.
  - Speed: one assumed 25 km/h on every road. Distances are real; minutes are an estimate.

Known gaps
  - No storm polygon covers the pump, so the GIS does not derive the pump outage that
    src/engine.mjs sets for the storm scenario. That stays a scenario assumption.
  - The planner only understands blocked or open days; "delayed" is informative only.
  - The map layer is not yet wired into src/App.jsx or the receipt inputs.
  - Licences: the GeoPackage contains OpenStreetMap data (ODbL 1.0, (c) OpenStreetMap
    contributors). Confirm the licence of the HDX Dacope boundary on its dataset page.
