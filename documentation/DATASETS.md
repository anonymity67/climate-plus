# Dataset register



Release documentation: 21 October 2026. Acquisition dates refer to project downloads, not sampling dates. All raw snapshots are retained. Publisher checksums matched for both water datasets. A matching checksum proves the downloaded file matches the publisher, not that every measurement is scientifically correct.



## Water Quality and Hydroclimatic Dataset for Rivers and Streams of Dhaka, Bangladesh



Source: https://data.mendeley.com/datasets/xftpv7jvx3/1

Authors/provider: Parishmita Sinha; Nirab Debnath; Prithwiraj Bhattacharjee

Version: 1; DOI 10.17632/xftpv7jvx3.1

License/basis: CC BY 4.0

Acquired: 2026-10-20

Coverage: 1,495 records; 58 coordinate pairs; 60 river/location name combinations; 104 dates

Observation/reference period: 2017-01-25 to 2021-07-17



Local raw file: `research/water/Water quality.csv` (182,314 bytes)

SHA-256: `baa149c139cc514b1f339015f49cb8afca459e1c2e7323e10f5d7b6defa49a7a`



**Use.** GIS; pH/DO/COD screening; DO model training and temporal evaluation

**Transformation.** Normalize Tongi Khal casing; flag six invalid negative-value rows; retain raw file; do not use supplied WQI or Pollution_Label; keep unspecified nutrient chemical forms out of objective comparisons.

**Limitations.** Repository-published measurements, not independently verified lab results. Original QA/custody documentation is incomplete. Historical, geographically limited and temporally clustered.



## Dataset for the BASIS Framework: High-Resolution Spatial, Diurnal, and Hydraulic Fecal Pollution Tracking in Resource-Limited Urban Channels



Source: https://data.mendeley.com/datasets/bncwnj8yjt/2

Authors/provider: Bijit Kumar Banik; Rahul Das Gupta; Md. Hasibul Chowdhury; Imran Hasan; Md. Imran Kabir; Muhammad Azizul Hoque

Version: 2; DOI 10.17632/bncwnj8yjt.2

License/basis: CC BY 4.0

Acquired: 2026-10-20

Coverage: Seven worksheets; extracted 40 velocity points, six hydraulic groups and 62 unlocated quality samples

Observation/reference period: February 2025 quality campaign; May 16, 2025 velocity survey; hydraulic-group timestamps absent



Local raw file: `research/water/basis-v2.xlsx` (85,999 bytes)

SHA-256: `3ab21b826163b70fe34370d7816784f394bae22a39830634e19a8affe84704f7`



**Use.** Separate survey GIS layer; mixing/closure investigation examples; explicit unlocated-sample audit

**Transformation.** Read published mean concentrations; multiply FC means by 10^5 to CFU/100 mL; do not count replicates as independent sites; do not join survey numeric IDs to quality-station IDs.

**Limitations.** No industrial-emitter labels. The actual quality worksheet lacks the coordinates suggested in broad metadata. No invented geolocation or complete urban-drain topology.



## NASA POWER monthly PRECTOTCORR at 22.57 N, 89.51 E



Source: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/

Authors/provider: NASA POWER

Version: Retained API snapshot

License/basis: NASA data attribution; source terms apply

Acquired: 2026-10-17

Coverage: Monthly point request, 1983–2025

Observation/reference period: 1983–2025; experiment targets 1984–2025



Local raw file: `research/raw/power.txt` (8,315 bytes)

SHA-256: `af6f8b715919e3d4b067b7b141627db1f9b4464249795896d9c2d627795c54fe`



**Use.** Separate retrospective low-rainfall experiment

**Transformation.** Convert mm/day monthly means to mm/month using calendar day counts; thresholds computed only from training.

**Limitations.** Gridded model-derived data, not a local rain gauge; historical revisions and current endpoints can change. Not a live tank-stock feed.



## NOAA CPC Relative Oceanic Nino Index historical table



Source: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/

Authors/provider: NOAA Climate Prediction Center

Version: ERSSTv6 historical table snapshot

License/basis: NOAA attribution; source terms apply

Acquired: 2026-10-17

Coverage: Historical three-month seasonal index table

Observation/reference period: Historical table used for lagged 1984–2025 experiment



Local raw file: `research/raw/roni.txt` (97,820 bytes)

SHA-256: `c3a07a7f28a7d69acef4fe03eb91482b062d1a1d63f462c181b0f5d5d4f23ff8`



**Use.** Candidate climate feature and baseline comparison

**Transformation.** Index values by center month; target-month minus three lag, with season ending before target.

**Limitations.** Modern historical revisions; not as-issued hindcasts. RONI addition did not improve Brier loss. No local storm/salinity attribution.



## Bangladesh Environment Conservation Rules 2023



Source: https://www.dpp.gov.bd/upload_file/gazettes/47999_44880.pdf

Authors/provider: Government of Bangladesh / Bangladesh Government Press

Version: Gazette March 5, 2023; Schedule 2(a)(1), fisheries row

License/basis: Official regulatory reference; no endorsement implied

Acquired: 2026-10-20

Coverage: 107-page Gazette PDF; relevant table on PDF p.53 / printed p.3061

Observation/reference period: 2023 reference used retrospectively



Local raw file: `research/water/ecr2023.pdf` (826,000 bytes)

SHA-256: `21c2b53f98a4e061f4321818c262149c4aaccf44a6f2a8635b152bde43c23c4a`



**Use.** pH 6–9, DO >=5 mg/L and COD <=50 mg/L screening objectives

**Transformation.** Visual transcription from the rendered table; no reliance on garbled extracted Bengali text.

**Limitations.** Only three matched parameters used. Intended use is inland fisheries. This is not finished drinking-water assessment, effluent compliance or a legal finding about pre-2023 samples.



## Additional sources and boundaries



- OpenStreetMap provides online contextual tiles, with attribution and ODbL terms. No industrial-discharge inventory, verified outlet network or source culpability is inferred from map proximity.

- CCME 2017 supplies the index method and sampling guidance. Its method is implemented, but no standard CCME score is displayed for the three-parameter default panel.

- WHO small-supply inspection guidance and EPA source-investigation/sampling guidance inform the pilot workflow; their presence is not a certification of this prototype.

- REACH, SafePani, MIT and YC/Waterplan were used for contextual and venture research. REACH raw records are not used to train the shipped DO model.

- FFWC, CHIRPS, HydroRIVERS and live BMD feeds are not integrated in this release. Do not list them as operational data inputs.

- The continuity scenarios are explicitly synthetic configurations in `src/engine.mjs`, not observed community records.



## Download and audit



Use `scripts/fetch-water.py` to verify or reacquire the exact pinned water files. Use `node scripts/verify-manifest.mjs` inside `` to check the release evidence files. Consult `ATTRIBUTIONS.md` for credit and reuse details.

