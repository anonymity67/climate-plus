# Water access and GIS MVP design

The user requests integration of the supplied `GIS repo`, Kaggle Bangladesh river-pollution data, simple navigation, disaster-time drinking-water assistance, pollution prevention and conservation. They have delegated the existing React/Leaflet/daylight interface and explicitly selected public data with clear verification labels; current authorized drinking-water clearances are not supplied.

## Approach and product truth

Extend the existing GIS section with a task-oriented workspace: **Find water**, **River pollution**, **Disaster planning**, **Water care**, and **Evidence tools**. Preserve the existing continuity workflows and scientific model. Separate resident actions from advanced research. Keep historical measurements, third-party pollution classifications, and synthetic QGIS scenarios visually and semantically distinct.

Alternatives considered: merging every layer into a national 'safe water' heatmap would imply unsupported contemporaneous safety and exposure; placing the repo only behind a download would not fulfill the functional-map request. The chosen implementation exposes a useful locator and explicit verification gaps, a pollution investigation view, and an interactive Dacope route/planner integration.

## Required behavior

- Public water-point snapshot with attribution, original dates, availability caveats and coordinates. Search by administrative name and distance from manually entered coordinates; optional browser geolocation only on request. Never elevate a functional-water-point tag into drinking-water clearance. Display no verified sources honestly when none exist. Public coordinates can be opened in an external map with clear travel/flood warnings.
- Kaggle file catalogue and bounded relevant files retained; audit coordinate reference system, missing dates, units, provenance, duplicates and class meaning before rendering. Unsupported classes remain publisher classifications, not laboratory or current safety evidence. Retain Mendeley pH/DO/COD partial objectives as the measured, dated source.
- Pollution map filter/search, accessible selectable list, distinct legends, date/source inspector, downloadable evidence. A user-set proximity radius supports investigation only; it must not be called a contaminant plume, affected population, safe zone or health-impact forecast.
- Integrate the supplied Dacope GeoPackage outputs into a Leaflet planning map: nodes, catchments, synthetic hazard polygons and clear/moderate/severe road-derived routes. Explain estimated speed and detour thresholds. Severe route is reachable but operationally classified blocked by the stated threshold; do not misstate physical disconnection. Link selected scenario assumptions into continuity planning and receipt inputs with source hash.
- Water-care view with sourced emergency precautions, chemical/salinity caveat, safe storage, pollution prevention, and transparent user-input conservation arithmetic. English/Bangla key resident actions; legible mobile/keyboard controls.
- Include source/version/hash/rights/transformations and validation records; extend the source handoff with new scripts/data/docs. Preserve the Site's existing audience when publishing.

## Boundaries

No fabricated drinking-water points, live safety clearance, pollutant fingerprint, exact exposure area, new predictive-model claims, flood-safe navigation, current hazard polygons, field effectiveness or active dispatch. The QGIS network is synthetic despite real road geometry. Published source metadata is validated as data, not independently as field truth. No automatic dataset overwrite/retraining of the frozen DO model.

## Validation and acceptance

Tests cover coordinate/distance handling, missing/expired/unverified source status, strict separation of synthetic sources, historical pollution classification, proximity selection without safety claims, route/scenario lineage, and deterministic GeoPackage conversion. Downloaded snapshots and derived records are count/hash audited. Build and existing scientific/engine tests must stay green. Browser checks exercise map modes, selection/filtering, keyboard alternatives, imported invalid input, mobile layout and data-failure states. Publish only the checked source and provide an updated portable development kit.
