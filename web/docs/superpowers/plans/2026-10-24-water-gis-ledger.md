# GIS implementation ledger

2026-10-24: Opened the existing Site checkout through its source workflow. Existing audience is custom/shared, so publication must use the shared Site deployment flow and preserve access.

Ruling: proceed with the existing React/Leaflet stack and daylight design under the user's persistent delegation. User explicitly selected available public data and clear verification labels. No current operator-authorized clearance data exists in the supplied material.

Ruling: integrate uploaded Dacope data as scenario planning, not resident water directions. Its own handoff declares fictional water points, catchments and hazards; only road geometry is real.

Task 1 underway: Kaggle public API identifies a ~2.9GB source, with a 570KB coordinate/intensity CSV plus a small pollution raster. Retrieve relevant bounded files rather than the unrelated 2.8GB true-colour satellite mosaic. Inspect class meaning/CRS before using it.

Completed: raw Kaggle version 2 CSV and metadata retained; 9,958 valid coordinates, 4,154 publisher High/Very High, one unknown class. Dates, units, laboratory validation and class method are absent, so this is a separate publisher-context layer.

Completed: bounded WPdx+ acquisition/audit found 20,084 unique historical points (2014–2019), no current safety/availability clearance, heavy Cox's Bazar concentration and no Dacope-labelled coverage. Personal contacts/notes/photos were not requested. All user-facing candidates remain confirmation-required.

Completed: five-task GIS workspace, deterministic QGIS conversion, scenario adapter/source-hash receipts, local search/proximity, clear ecological-screen labels, guidance, Bangla key actions and conservation arithmetic. Extra views are lazy-loaded; canvas handles dense layers.

Verification: 51 tests pass; deterministic GeoPackage AND public-resource rebuilds pass; 171 supported Python/browser DO predictions remain in parity; production build succeeds without chunk warning; 40 asset hashes match eight registered sources; baseline science reproduces at 1e-9 in Python 3.14.5; core npm audit reports zero vulnerabilities. Mechanical interface detector reported no findings.

Browser checks: invalid coordinates; missing coverage vs no supply; real inventory presets and source dates; Kaggle class filter (4,154 high-context records); clear/moderate/severe distances; planning integration; chemical warning and zero-duration calculator error; Bangla mobile navigation; no horizontal overflow at 390px. Browser console has no captured warnings/errors in these checks.

Fresh review identified an important banner claim: the old planner called the route closed although the supplied graph remains connected. Added failing regression, then changed GIS-backed wording to operational exclusion by assumed detour. Minor finding on the 250-item cap is now explicitly explained. Marker rebuilding on selection is retained as a future optimization if dense-layer mobile profiling requires it.

Ruling: raw research and browser data are marked -text in .gitattributes to preserve exact snapshot bytes through Git on Windows. Source formatting uses LF. No Site credentials are written into files or release records.
