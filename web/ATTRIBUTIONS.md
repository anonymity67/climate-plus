# Data and asset attribution

## GIS extension — 24 October 2026

**Dacope QGIS handoff.** Ahnaf Antar (Climate++ GIS), version 1, supplied GeoPackage `research/gis/v1/climate_gis.gpkg`. Network nodes, catchments and hazard polygons are fictional. Road geometry derives from OpenStreetMap / HOT export: © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). Route output retains this attribution. The raw GeoPackage contains an HDX Dacope administrative boundary whose upstream licence is not independently confirmed; the public map does not render or export that boundary layer separately. Synthetic-layer project terms are to be selected by the team.

**Kaggle context.** A.B.M. Mostakim Niloy, [Bangladesh-River-Pollution-GIS](https://www.kaggle.com/datasets/niloysust21/bangladesh-river-pollution-gis/data), version 2, updated 7 September 2025. Publisher metadata declares MIT; no separate licence text or constituent imagery/boundary rights were supplied. Climate++ retains 9,958 coordinate/value/class rows and marks the one `#N/A` class Unclassified. Values are shown as publisher context, not measured pollutant concentration or a validated health index. No sampling dates or class-validation method are invented. The large true-colour mosaic was not downloaded or republished.

**Public water inventory.** WPdx / Global Water Challenge; original organisational providers UNHCR, REACH Initiative and WaterAid. [WPdx+](https://www.waterpointdata.org/access-data/), Bangladesh API snapshot retrieved 24 October 2026. The [WPdx Provider Agreement](https://www.waterpointdata.org/share-data/) specifies [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Climate++ filters to Bangladesh, retains a public-field allowlist, normalizes dates and computes straight-line proximity. All assessments are 2014–2019; no current water safety or availability is inferred. Provider names are retained; personal contacts, free text and photos were not requested. Original providers do not endorse this application.

**Public guidance references.** [CDC emergency water](https://www.cdc.gov/water-emergency/about/), [WHO flood precautions](https://www.who.int/news-room/questions-and-answers/item/how-do-i-protect-my-health-in-a-flood/), [EPA emergency disinfection](https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water), [DPHE official services](https://dphe.gov.bd/pages/static-pages/6922dd01933eb65569e13226), and [FFWC](https://ffwc.gov.bd/). Guidance is paraphrased with links and is not a claim of institutional endorsement, medical certification or live data integration.

## Dhaka water data

Parishmita Sinha, Nirab Debnath and Prithwiraj Bhattacharjee (2026). **Water Quality and Hydroclimatic Dataset for Rivers and Streams of Dhaka, Bangladesh**, Mendeley Data, version 1, DOI **10.17632/xftpv7jvx3.1**. https://data.mendeley.com/datasets/xftpv7jvx3/1

License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/ . Climate++ parses the CSV, normalizes the Tongi Khal label casing, flags invalid values, creates GeoJSON, calculates a separate partial screening indicator and trains a DO estimator. Original WQI/pollution labels are not used. Original authors do not endorse Climate++.

## BASIS Sylhet data

Bijit Kumar Banik, Rahul Das Gupta, Md. Hasibul Chowdhury, Imran Hasan, Md. Imran Kabir and Muhammad Azizul Hoque (2026). **Dataset for the BASIS Framework: High-Resolution Spatial, Diurnal, and Hydraulic Fecal Pollution Tracking in Resource-Limited Urban Channels**, Mendeley Data, version 2, DOI **10.17632/bncwnj8yjt.2**. https://data.mendeley.com/datasets/bncwnj8yjt/2

License: CC BY 4.0. Climate++ extracts 40 velocity survey coordinates, six hydraulic groups and 62 unlocated water-quality samples. FC values are restored from the published 10^5 multiplier to CFU/100 mL. Survey points are not joined to water-quality stations without evidence. No new source-attribution discovery is claimed. Original authors do not endorse Climate++.

## Climate and standards

- NASA POWER monthly PRECTOTCORR snapshot, requested at latitude 22.57, longitude 89.51, 1983–2025: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/ . Monthly mean daily precipitation is multiplied by the number of calendar days. NASA POWER is gridded model-derived data, not local gauge truth.
- NOAA CPC historical RONI / ERSSTv6 table: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/ . Historical revisions are retained in the raw snapshot; the experiment is retrospective reconstruction.
- Bangladesh Government Press, Environment Conservation Rules 2023, Schedule 2, Gazette p.3061 / PDF p.53: https://www.dpp.gov.bd/upload_file/gazettes/47999_44880.pdf . Used as a reference for retrospective fisheries-objective screening, not a ruling about historical compliance.
- CCME (2017), Water Quality Index User's Manual: https://ccme.ca/en/res/wqimanualen.pdf . The implementation follows the mathematical method and cites the source. The manual is not redistributed in the static application.

## Maps, font and libraries

- Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright . Tiles are requested from the public OSM tile service for interactive viewing, without bulk download. Leaflet is used under its BSD-2-Clause license.
- Manrope font, Google Fonts, SIL Open Font License. The font license and source note are in `public/fonts/`.
- React, Vite, lucide-react, ethers, Ganache, solc and scientific packages retain their upstream licenses. Exact npm versions are recorded in `package-lock.json`. Review their distribution terms when redistributing the complete dependency tree.

Custom code has no newly assigned project-wide open-source license. The user should select a code license before public repository publication. Dataset licenses remain independent of that choice.
