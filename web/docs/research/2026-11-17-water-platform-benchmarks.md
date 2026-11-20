# Climate++: water platform benchmarks and a defensible MVP

Research date: 17 November 2026. Scope: first-party product pages, technical documentation, source repositories, and the existing local data files. This is a product/data feasibility review, not an evaluation of measured programme impact. Public pages and published interfaces were checked; authenticated operator dashboards were not tested.

## Recommended primary workflow

**Select a place → find a recorded water source or inspect a mapped channel → inspect dated evidence → save a field verification task → record the outcome.** Keep two entry points, “Find a water source” and “Investigate water quality,” with one shared map and evidence panel. A small verification queue is the third capability, not a separate analytics product.

The current data can support a historical source inventory and evidence-led channel investigation. It cannot establish which sources are safe today, identify a polluting business from proximity, or simulate contaminant transport. The useful deliverable is a traceable shortlist for a visit, sample, operator call, or repair inspection. The workflow recommendations below are design inferences from the documented systems and the local data inspection.

## What comparable operational platforms actually support

| Platform | First-party pattern and supported action | Practical Climate++ adaptation | Reuse limitation |
| --- | --- | --- | --- |
| mWater | Repeated updates to a persistent water-point record; simple functionality updates alongside fuller surveys. Availability/reliability is assessed separately from whether equipment functions. [Functionality documentation](https://portal.mwater.co/resource_center/water_point_functionality.html) | Give a water point a durable identity and dated visits. Show “last reported water present,” functionality, and quality evidence as separate fields. Action: verify a stale point or inspect a reported failure. | Creator/organisation owns its data; mWater does not curate all public observations. Public visibility is not assurance of current accuracy. |
| WPdx tools | Its live tools expose functional, non-functional, unknown and abandoned points with administrative search. Published beta analyses cover rehabilitation, service gaps, data quality and status prediction. [Tools](https://tools.waterpointdata.org/), [official use-data page](https://www.waterpointdata.org/use-data/) | Map + compact result list + explicit evidence dates. Action: shortlist existing assets needing a fresh visit. Prefer this over an unexplained “sustainability score.” | WPdx+ tools depend on coverage and external inputs. A nearby historical point is not proof of potable water, opening hours, access rights or present supply. |
| FreshWater Watch / Earthwatch | A simple sampling survey, nitrate/phosphate/turbidity tests, immediate mapped feedback and repeated observations underpin local monitoring. [Earthwatch programme](https://earthwatch.org.uk/program/freshwater-watch-in-the-uk/) | Ask for a parameter, unit, collection date, location and method before accepting a measurement. Show a station's trend and sampling gaps. Action: plan a repeat sample or investigate an unusual observation. | This is ecological monitoring. Its map categories must not be reused as drinking-water clearance. Open access does not itself settle all redistribution terms. |
| Water Reporter | The owner's current API repository models datasets, stations, parameters and readings; readings can include threshold colours/labels and certification. [Maintainer API reference](https://github.com/WaterReporter/api-reference) | Adopt the station → parameter → dated reading structure, with named threshold provenance. Action: compare a station's observations and create an investigation record. | Current documentation calls this a read-only beta, requires an API key, warns of breaking changes and restricts results to owner-public data. Do not use older anonymous `/v1/report` documentation as the present integration contract. No universal data-republication licence was established. |
| Global River Runner | A selected location produces a downstream GeoJSON path using a processed river network and geospatial services. Its maintainers explicitly warn that automated topographic paths may miss dams, canals and conduits. [Project documentation and source](https://ksonda.github.io/global-river-runner/) | Highlight a selected connected network and preserve the distinction between network tracing and a pollution model. Action: decide where connectivity merits checking. | It is an open-source work in progress; the documented derived MERIT dataset is CC BY-NC-SA. A working demo endpoint is not a production SLA or automatic permission for unrestricted commercial reuse. |
| Drinkwell, Bangladesh | A public booth-finder exists in Bangla/English. Its product brochure describes GSM transmission of litres dispensed to a cloud portal for operator utilisation/revenue monitoring. [Booth finder](https://find.drinkwell.com/), [operator brochure](https://drinkwell-solutions.squarespace.com/s/Drinkwell-Water-ATM-Product-Brochure.pdf) | Provide place search and source-specific practical details when an operator supplies them; record “unknown” for absent hours, price or availability. Action: locate a service and contact/verify its operator. | The observed finder is a JavaScript application; no documented public station/quality API or general data-reuse grant was found. Do not scrape or fabricate its operational data. Product claims are not independent impact evidence. |
| SafePani, Bangladesh | HYSAWA's app describes problem reports, repairs, maintenance verification, quality testing, sanitary inspection and volumetric use. Uptime describes professional maintenance/water safety services under independently verified contracts. [Developer app listing](https://play.google.com/store/apps/details?id=com.safepani.activity), [programme partner](https://www.uptimewater.org/safepani), [programme site](https://www.safepani.org/) | Close the loop from report to assigned visit to verification evidence. Action: document whether the reported problem was checked and resolved. | No open operational API/data licence was established. A local verification queue can copy the workflow idea without claiming connection to SafePani or its partner systems. |

Additional mWater integration constraints are unusually explicit: automated API access is at most hourly; external applications should copy permitted data into their own database; republishing sites not managed by the integrating organisation requires prior written consent; attribution is mandatory. Prefer an authorised export and one-way import over embedding a dependency on its live database. [mWater API policies](https://www.mwater.co/policies)

WPdx's published Plus processing already incorporates proximity to OSM roads and towns, deduplication, data staleness and population-based analyses. Therefore mapping points, showing age, or ranking repairs is not itself novel. Reuse its relevant patterns while preserving the original provider and source report dates. [WPdx access and methods](https://www.waterpointdata.org/access-data/)

## Three small, testable MVP capabilities

1. **Find a recorded water source.** Search a supported region; list WPdx candidates with technology, provider, distance and assessment date; inspect evidence; save “verify availability / collect a current quality test.” A result means a recorded candidate, not an endorsed safe supply. Completion evidence: a persisted task and a source-linked visit result.
2. **Inspect a channel and its evidence.** Select a mapped river/stream/drain; highlight its mapped connections; show historical measurements spatially associated within a stated tolerance, their exact dates, parameter units, dataset and attachment method. Unmatched stations remain visible as unmatched. Completion evidence: a user can inspect the measured record and export/save a sampling plan with source IDs.
3. **Verify and follow up.** Record a visit or issue with time, location, optional photograph, measurement/method and outcome; retain open → in progress → checked status and an audit trail. Completion evidence: reload shows the saved record linked to the original asset/station. Assignment is optional for a single-user prototype.

The two workflows can share map, search, records and a queue. Their evidence should remain distinct: a historical surface-water result does not classify an adjacent well's safety. “Sustainable sourcing” initially means finding existing assets and recording reliability, maintenance and test evidence. A defensible extraction/recharge or dry-season sustainability assessment requires additional hydrogeological, seasonal demand and yield data.

Potential differentiation is the local combination of source records, channel context and a small verification loop with explicit provenance. This review does not establish global novelty, a patent claim, pollution reduction, avoided illness, or numbers of beneficiaries. Suitable early evaluation measures are task completion, matched/unmatched station counts, attribution completeness, and field follow-up completion—not claimed environmental impact.

## Existing local evidence: useful boundaries

- The existing WPdx audit reports 20,084 Bangladesh Plus records with assessments from 2014–2019, latest 21 November 2019. It also records incomplete regional coverage and duplicate flags requiring care. This is a local snapshot result, not a newly queried count: `research/gis/wpdx-2026-10-24/RESULT.md`. Display the assessment date rather than treating an ingestion timestamp as a visit.
- The Dhaka publisher provides physicochemical parameters, hydroclimatic fields, WQI and classification labels under CC BY 4.0. [Dataset v1](https://data.mendeley.com/datasets/xftpv7jvx3/1) The supplied prototype's 1,495 historical measurements are a bounded research dataset. Publisher classifications should be named as publisher labels; do not present them as current findings or a validated source-identification model.
- BASIS v2 is a real Sylhet drainage/water-quality dataset under CC BY 4.0, published 8 July 2026. The description covers dry-weather monitoring, FC/pH/turbidity, BOD and mass-balance measurements. [Publisher record](https://data.mendeley.com/datasets/bncwnj8yjt/2)
- **Workbook inspection contradicts an easy spatial join:** in `research/water/basis-v2.xlsx`, `01_Spatial_62_Stations` has channel, sample-point, date/time and quality columns, but no latitude/longitude columns. `06_Average_Channel_Velocity` contains 20 coordinate rows for Malnichara and 20 for Goalichara, numeric IDs 1–20, chainage and velocity, dated 16 May 2025. Those are not an established crosswalk to the KC/MC/etc quality sample IDs. Do not assign quality values to these coordinates, draw invented channel edges between them, or infer a point-source location from row order. The velocity positions can be shown as their own observed survey layer.
- OSM roads are useful access context. Road connectivity does not establish channel connectivity, drinking-water access, a walkable entrance to a source or permission to enter it.

## Stream-network options for a bounded Bangladesh implementation

### A. Immediate option: mapped OSM channel connectivity, with flow unverified

OSM guidance says waterway ways should follow downstream flow and connect into a routable network. It also documents changing flow direction (`flow_direction=both`), tidal influence, seasonal and intermittent water. These are community mapping conventions, not contemporaneous hydraulic observations. [OSM Waterways](https://wiki.openstreetmap.org/wiki/Waterways), [waterway key](https://wiki.openstreetmap.org/wiki/Key:waterway)

`waterway=canal` is an artificial open-flow channel for transportation, waterpower or irrigation; small artificial drainage channels use `drain`/`ditch`. Preserve the actual tag rather than renaming every line “stream.” [OSM canal documentation](https://wiki.openstreetmap.org/wiki/Tag:waterway%3Dcanal) `tidal=yes` identifies a feature in the tidal range; its absence does not certify non-tidal flow. [OSM tidal documentation](https://wiki.openstreetmap.org/wiki/Key:tidal)

Recommended implementation contract, based on these conventions:

- Store source way ID, ordered node IDs, geometry, tags, retrieval timestamp and query bounds.
- Build undirected adjacency from consecutive node references. Join separate ways only where they share an actual source node ID. Do not join geometric crossings, names, nearby endpoints or rounded coordinates automatically.
- Label the highlight **“Mapped channel connections · flow unverified.”** Use **“Connected channels”**, not “upstream pollution” or “contamination spread.” Preserve tidal/intermittent/reversal tags for inspection.
- Retain gaps and component boundaries. A bounded extract ending does not mean the river ends there. State “network continues beyond this extract” when appropriate; truncation or missing mapping remains unknown.
- Associate a measurement with a nearby channel only under a documented maximum tolerance. Store the original station coordinate, channel ID and measured distance. Call this **“nearby historical measurement”** or **“spatial association”**. It does not establish that the station samples that line, a hydrological link, pollutant travel, an affected source, or responsibility for contamination. Keep a rejected/unmatched state.
- Do not colour an entire connected component polluted from one old sample. At most show the recorded observation's label at its station, and channel connectivity separately. A selected association should expose its method and distance.

### B. Bounded Overpass ingestion

Use a server-side, cached ingestion step rather than calling a shared public Overpass instance for every map action. The operator's manual explicitly lists consumer apps using public instances as a backend among problematic uses. Current instance guidance calls for caching/rate limiting, app identification, and conservative aggregate use; it advises a 30-second pause for 429/406. Production commercial use should use a paid/self-hosted service. [Operator guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [OSM instance guidance](https://wiki.openstreetmap.org/wiki/Overpass_API)

Illustrative small Sylhet request, not a downloaded dataset or verified coverage result:

```overpass
[out:json][timeout:25];
way["waterway"~"^(river|stream|canal|drain|ditch|tidal_channel)$"]
  (24.87,91.82,24.93,91.91);
out body;
node(w);
out skel qt;
```

POST the query as `data` to the documented endpoint `https://overpass-api.de/api/interpreter`. Bounding-box order is south, west, north, east. The operator's geometry guide documents emitting ways then `node(w); out skel qt;` to retain references and coordinates. This is preferable to discarding node IDs during GeoJSON conversion. [Bounding boxes](https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html), [ways and nodes](https://dev.overpass-api.de/overpass-doc/en/full_data/osm_types.html)

Cache raw responses and a normalised snapshot; record failures without replacing a successful snapshot with an empty result. Do not present a failed request as “no waterways.” Serialise ingestion, cap region sizes, and leave refresh off the interaction path. OSM data is ODbL: credit OpenStreetMap contributors and retain applicable share-alike obligations for redistributed adapted databases. [OSMF licence information](https://www.openstreetmap.org/copyright)

### C. Later option: HydroRIVERS for an actual modelled directed network

HydroRIVERS v1 offers an Asia shapefile download (~91 MB) and a documented model-derived network. Its source resolution is 15 arc-seconds and inclusion threshold is at least 10 km² catchment or 0.1 m³/s mean flow. This makes it a reasonable regional river backbone, not a guaranteed inventory of Sylhet household drains. Scientific, educational and commercial use is allowed under its stated HydroSHEDS licence agreement. [Official product/download page](https://www.hydrosheds.org/products/hydrorivers)

`HYRIV_ID` identifies a reach; `NEXT_DOWN` identifies the next downstream reach and 0 marks a terminal reach. `MAIN_RIV`, `LENGTH_KM`, `HYBAS_L12` and long-term discharge are useful context. Clip for display while preserving referenced off-window IDs and explicit extract-boundary states. Trace by these fields, never a nearest-endpoint graph. These are modelled links, not observed current flow or a contaminant model. [HydroRIVERS technical documentation](https://data.hydrosheds.org/file/technical-documentation/HydroRIVERS_TechDoc_v10.pdf)

HydroSHEDS documents remaining errors in braided rivers and deltas. That matters in Bangladesh: retain model/version labels and avoid asserting tidal reversal, split distributaries, travel times or flood connectivity from a single next-downstream field. [HydroSHEDS technical documentation](https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf) The official FAQ notes that product licences differ and that v2 releases began in July 2026; this does not mean all derived products have been replaced. [Official FAQ](https://www.hydrosheds.org/faq)

## Implementation decision

Ship the bounded OSM connectivity view with historical measurements, source candidates and a persisted verification queue. This produces an honest, useful full-stack application with the available evidence. Treat a HydroRIVERS import as the next step when verified directed river tracing becomes a product requirement. Treat source attribution and contaminant propagation as separate research problems requiring confirmed station-to-waterbody relationships, current sampling, hydraulic context and independent validation.
