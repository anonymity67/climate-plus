# Data and asset attribution

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
