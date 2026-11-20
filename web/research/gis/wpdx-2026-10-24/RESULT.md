# Bangladesh water-access dataset audit

Audited 24 October 2026. **Usable only as a historical candidate inventory, with every point requiring present-day confirmation.** It cannot support a “safe drinking water nearby” certification.

## Download and provenance

- Raw: `wpdx-plus-bangladesh.csv`, 8,267,368 bytes, 20,084 rows. SHA-256: `ee1463b90e43a6ef8380f63ddb5f46eddbeedf3960e2c140f434b432b7d3cda3`.
- Compact browser allowlist: `water-access-candidates.json`, 3,375,205 bytes. Its `fields` array defines each tuple in `rows`; lat/lon numbers are WGS84. SHA-256: `f4273f820cedef47290d5b03f4778e00bb1ba9bdcb6f87a4a30cf863cc9807e5`.
- Exact API request URL, content hash, aggregation counts, coverage queries, usable fields and UI safeguards are in `RESULT.json` and `snapshot-summary.json`.
- [WPdx+ public inventory](https://data.waterpointdata.org/dataset/Water-Point-Data-Exchange-Plus-WPdx-/eqje-vguj); [official access information](https://www.waterpointdata.org/access-data/).
- Licence: [WPdx Provider Agreement](https://www.waterpointdata.org/share-data/) specifies [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Retain WPdx / Global Water Challenge and original provider attribution (UNHCR, Reach Initiative, WaterAid); indicate filtering/normalization. API metadata has no licence field of its own; do not invent one.

## Audit findings

All 20,084 WPdx IDs and coordinate pairs are unique, with 0 missing/invalid WGS84 coordinates. All assessments date 2014–2019 (latest 21 November 2019). Recent API update timestamps are ingestion timestamps, not recent source inspections.

Water present when assessed: Yes 14,368; No 3,635; Unknown 2,081. It means water was present during an old visit, not current functionality or chemical/microbial safety. The [WPdx standard](https://www.waterpointdata.org/wp-content/uploads/2021/04/WPDx_Data_Standard.pdf) explicitly distinguishes presence of water from physical condition and testing.

The `status_clean` field has 19,547 Non-Functional, 436 Non-Functional/dry-season and 101 Functional, with 14,399 source-presence/clean-status combinations flagged for review. These fields are different constructs; they must not be silently equated or used as current availability. Of 101 cleaned Functional records, 66 have source presence No. All 20,084 are labelled Improved technology, which is not a safety test. Coliform numerical results are absent throughout; only 19 historical Absent entries exist. No current safety clearance is present.

The `is_duplicate=true` flag occurs on 14,574 records despite unique WPdx IDs and exact coordinates. Preserve it in the raw audit; do not drop these records without investigating provider cluster semantics. The browser allowlist deliberately omits it and every current-safety inference.

Coverage is sparse and uneven: Cox's Bazar 18,233 (90.8%), including Ukhia 16,812 and Teknaf 1,420; Khulna district 66; Dhaka district 3. Treat absence as **no inventory coverage**, not “there is no water source”. The bounds span 20.7662083333333–26.20406 N and 88.1614783333333–92.32694 E, but a broad bounding rectangle does not mean coverage everywhere.

Quick WPdx-Basic check: 70,894 Bangladesh rows, same latest assessment, 0 Dacope-labelled records. A nearby box contains 55 Basic vs 39 Plus records, but Basic labels are Koyra/Paikgachha. It does not solve Dacope coverage. Results and exact queries are retained in `bounded-coverage-queries.json`.

## Recommended integration

Use neutral markers for **Historical water-point candidates · confirmation required**. Show assessment date, old presence-of-water response, source organisation, technology and admin labels. Put “Current availability unknown · Drinking-water safety unknown” on every detail card. Provide radius-limited straight-line proximity, no-result handling, and coordinate navigation only after explaining current route/access checks. No safety ranking, inferred current opening, or contaminant clearance is justified.

The compact browser subset includes only ID, coordinates, assessment date, recorded presence, organisational source, dataset title, cleaned admin labels, source type and technology. It includes no personal contact names, phone numbers, emails, photo links or notes. Dataset access was public and no accounts were used.

Use a separate, explicitly verified operator feed for future emergency supply points (dated availability, quality sample/report, provider and access constraints). That feed is **not** supplied by this old inventory.

Official fallbacks: [DPHE Water Resources Potential Map](https://picmac.dphe.online/en/) is a planning resource, not a certified supply locator. [DPHE software links](https://dphe.gov.bd/pages/static-pages/6922dd01933eb65569e13226) lists relevant official systems; [WPMS](https://wpms.dphe.online/) requires login. Do not fabricate a public point feed from those systems.

## Retrieval caveat

`waterpointdata.org` website/PDF direct urllib requests returned HTML JavaScript challenge pages, although the web tool could read their indexed official contents. These responses were renamed `blocked-*.html`; they are **not** authentic PDF/page snapshots and should not be distributed as documentary evidence. The Socrata CSV/JSON API downloads were parsed and validated. No further third-party or proprietary data were downloaded.
