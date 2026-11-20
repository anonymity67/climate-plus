# Water-access and GIS MVP — evidence and validation

Release 0.3.0, 24 October 2026. The user authorized public datasets with explicit verification labels. No feed of current authorized drinking-water clearances, opening times or flood-safe routes was supplied.

## Implemented workflows

- **Find water:** local radius/place/coordinate search over 20,084 WPdx+ inventory points, exact assessment dates, organisational providers, old presence response, current availability unknown and drinking-water clearance not supplied. Device location is optional; distances are calculated locally. Public location pins open externally; dated field shortlists can be downloaded.
- **River pollution:** dated Mendeley measurements against three fisheries objectives, with a separate Kaggle publisher-classification layer. Filter, select by map or keyboard list, inspect provenance and missing evidence. Investigation-distance circles identify nearby old inventory records to check; they do not compute transport, exposure or affected population.
- **Disaster planning:** the supplied QGIS GeoPackage renders fictional Dacope nodes, catchments, hazards and road-derived routes. Conditions and route metrics are interactive. GIS-derived blocked days enter continuity planning, with source hash and assumptions in the receipt.
- **Water care:** linked emergency precautions, chemical/salinity caveat, storage, pollution prevention, leak measurement and user-input storage arithmetic. Key resident navigation/actions have Bangla text; precautions can be printed.
- **Evidence tools:** source-mixing closure, chronological DO-model validation and explicit-unit import remain available, along with continuity, notices and receipt workflows.

Extra views load on demand; Leaflet uses canvas for dense coordinate layers. The water map/list exposes at most 250 closest candidates. Local search uses no external geocoder. Map-tile requests disclose the viewed area to OpenStreetMap; location is not silently persisted.

## Dacope QGIS handoff

Raw `research/gis/v1/climate_gis.gpkg`; SHA-256 `033646cae59e23c55655668323a72bca7219e257d21050b05fa2ca96de2ced65`. Its own handoff declares synthetic assets and hazards on real OSM road geometry. The GeoPackage has 13 layers; the public export uses six nodes, two catchments, three hazard polygons and three supplier-to-reserve routes. Geometry is EPSG:4326; GeoJSON order is longitude, latitude.

Clear/moderate/severe route costs are 7,881.0 / 11,189.2 / 15,859.8 metres. An independent spherical segment-length approximation of exported vertices agrees within 0.2%, supporting units/order of magnitude, not drivability. Travel minutes assume 25 km/h on every road. Delayed means at least 1.2× clear distance; blocked means at least 1.75× or unreachable. These thresholds and the seven-day schedule are assumptions.

**The severe graph remains connected.** Delivery on day 2 is operationally excluded by detour, not a proved road closure. The pond is exposed in the salinity scenario; no storm polygon covers the pump. Pump outage stays an independent scenario assumption, separate from geographic restrictions in the receipt. Delay is informative; the optimizer models open/blocked delivery windows.

OSM attribution/ODbL is retained. The HDX boundary licence is not independently confirmed; that boundary is not separately rendered/exported publicly. No fictional node is admitted to the public water locator.

## Kaggle classified coordinates

[Publisher](https://www.kaggle.com/datasets/niloysust21/bangladesh-river-pollution-gis/data): A.B.M. Mostakim Niloy, **version 2**, updated 7 September 2025. Raw CSV `research/gis/kaggle-v2/Pollution_Intensity_Coordinates_Updated.csv`, 570,583 bytes; SHA-256 `6b485b31ef664cfb0ae79f4bef6dab9968916e2646db79ec76363ac6b098d665`. Parsed official public API metadata, catalogue, request URLs and acquisition hashes are retained. The large true-colour mosaic was not required/downloaded. The web fetcher could not read the dataset page; no description was invented to fill its blank API description.

9,958 rows/unique coordinate pairs; zero rejected numeric/coordinate rows. Bounds 23.4064–24.3314 N, 90.0110–91.2943 E. Classes: Very High 2,124; High 2,030; Moderate 1,822; Low 1,983; Very Low 1,998; Unclassified 1. The missing class at point 6106 is retained as unknown despite its high numeric value.

Missing: sampling dates, pollutant units, laboratory validation and classification method. Publisher metadata declares MIT; no separate licence text or constituent-data documentation was supplied. The records are shown only as publisher context, never measured concentration, potability, a health index, a training target, an exposure plume or an industrial-source identity.

## WPdx+ public inventory

[Access](https://www.waterpointdata.org/access-data/); [API dataset](https://data.waterpointdata.org/dataset/Water-Point-Data-Exchange-Plus-WPdx-/eqje-vguj). Raw `research/gis/wpdx-2026-10-24/wpdx-plus-bangladesh.csv`, 8,267,368 bytes; SHA-256 `ee1463b90e43a6ef8380f63ddb5f46eddbeedf3960e2c140f434b432b7d3cda3`. Exact query and metadata are retained. No personal contacts, free text or photos were requested.

20,084 unique IDs/coordinate pairs, valid WGS84. Assessment dates: **2014-01-01 to 2019-11-21**. October 2026 retrieval is not a fresh inspection. Old water-presence responses: Yes 14,368; No 3,635; Unknown 2,081. Cleaned condition is a different construct; 14,399 cross-field combinations need review. Neither establishes current functionality or safety.

Coverage: 18,233 (90.8%) in Cox's Bazar; Khulna district 66; Dhaka district 3; no Dacope-labelled points. A bounded WPdx-Basic check found no newer inspection or Dacope-labelled improvement. Missing coverage does not mean no water exists. Presets derive from actual retained records and are not endorsed destinations or the user's position.

The [Provider Agreement](https://www.waterpointdata.org/share-data/) states CC BY 4.0. Retain WPdx/Global Water Challenge and UNHCR, REACH Initiative, WaterAid attribution. API metadata itself has no populated licence field. Direct website/PDF downloads returned challenge HTML, excluded from the package rather than mislabelled as evidence PDFs.

## Interpretation, health and sustainability

The MVP locates recorded candidates, exposes missing verification, supports field shortlists and pollution investigation, and rehearses access disruptions. A verified safe-water service still needs an operating partner's dated availability, appropriate microbial/chemical test evidence, responsible review, access constraints, expiry and revocation. River proximity does not establish groundwater contamination; a calibrated plume/exposure model would require topology, flow/tides, pollutant fate, intakes, population, uncertainty and independent validation.

Guidance links: [CDC](https://www.cdc.gov/water-emergency/about/), [WHO](https://www.who.int/news-room/questions-and-answers/item/how-do-i-protect-my-health-in-a-flood/), [EPA](https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water), plus DPHE and FFWC. Follow current local advice. Germ treatment does not remove salts, arsenic or most harmful chemicals. No universal bleach dose, clinical diagnosis or project health benefit is asserted.

Leak estimate = entered mL / entered seconds × 86,400 / 1,000. Storage = entered people × days × L/person/day. Defaults are labelled examples, not prescriptions, ceilings or measured savings. Source-control advice considers load, energy and sludge/brine disposal rather than treating dilution as removal.

## Verification and reproduction

Tests cover coordinates/distance, dates, no unsafe safety inference, synthetic exclusion, sorting/filtering, partial objectives, unknown classes, proximity semantics, arithmetic, route lineage and invalid blocked days. Snapshot tests verify counts/uniqueness and the unclassified point. GeoPackage output is regenerated byte for byte. Existing engine tests and all supported browser/Python DO predictions remain included.

Run `npm run check`. Rebuild GIS separately with `python scripts/build-gis-network.py --out <scratch-folder>` and `python scripts/build-gis-resources.py --out <scratch-folder>`. Scientific reproduction uses the pinned Python environment and `python scripts/reproduce.py`. Release verification records/screenshots are included under `verification/` in the handoff. Consult those for actual command outcomes; methods prose alone is not verification evidence.
