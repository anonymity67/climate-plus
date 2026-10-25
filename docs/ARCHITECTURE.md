# Developer architecture

The core is a Vite/React single-page application. It performs calculations in the browser against retained JSON files. Python is a separate offline preparation and evaluation pipeline. There is no hosted backend hidden behind the UI.

## Data flow and boundaries

1. Immutable CSV/XLSX/text snapshots in `research/` enter `scripts/prepare-water-data.py` and `scripts/climate-analysis.py`.
2. Water preparation normalizes inputs, flags invalid cells, exports records/GeoJSON, selects a DO model on early 2020, calibrates its interval on later 2020, and evaluates on 2021. The exported forest is evaluated by `inferDO` in `water-engine.mjs`.
3. `PollutionPanel.jsx` fetches `public/data/water-evidence.json`. `ResearchMap.jsx` renders the distinct quality and velocity layers. Selection/filter changes update the inspector. The map fits a new coordinate set; selecting a point preserves user pan/zoom.
4. `screenWater` calculates only the three declared objectives from measured parameters. Model estimates never fill absent measurements in that screen.
5. `mixLoad` is a short-reach steady mixing scenario with explicit flow/load closure diagnostics and analyst-selected tolerance. It is independent of GIS proximity.
6. `App.jsx` uses pure `engine.mjs` functions for the separate synthetic continuity ledger, schedule search and receipts. Notices depend on a time-limited operator confirmation.
7. Receipts use canonical JSON and SHA-256. An optional, separately installed localhost service compiles the Solidity registry and anchors a digest on ephemeral chain 1337.

## Where to change things

| Concern                                  | Primary files                                 | Checks                                                     |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Application navigation and continuity UI | `src/App.jsx`, `src/styles.css`               | Build and browser workflow checks                          |
| Water workflows, filters and import      | `src/PollutionPanel.jsx`, `src/pollution.css` | Input tests and browser smoke checks                       |
| Map lifecycle and extent                 | `src/components/ResearchMap.jsx`              | Browser layer/marker/filter/zoom checks                    |
| Layer colors and missing values          | `src/map-style.mjs`                           | `tests/map-style.test.mjs`                                 |
| Objective profiles, units and mixing     | `src/water-engine.mjs`                        | Water and regression tests; scientific review              |
| Planning/allocation                      | `src/engine.mjs`                              | Conservation, exhaustive schedule comparison and benchmark |
| Model fitting and export                 | `scripts/prepare-water-data.py`               | Fresh temporal evaluation, parity and reproduction         |
| Climate comparison                       | `scripts/climate-analysis.py`                 | Reproduction; compare baselines honestly                   |
| Source/version/rights                    | `DATASETS.json`, `ATTRIBUTIONS.md`            | Data hashes and documentation review                       |

## Persistence and security assumptions

Only investigation draft summaries persist in browser local storage. Raw imports are session state; export before closing if needed. Reset clears session UI state, not local storage. There are no users, roles, custody signatures or multi-user synchronization. Production ingestion must validate on a server as well as in the browser. Do not put secrets in client code or Vite-prefixed environment variables.

The loopback chain proxy belongs to development only. Static `dist` hosting intentionally does not expose it. The third-party basemap request reveals the map viewport to the tile provider; sensitive deployments need an approved basemap/privacy plan. No source coordinates should be used to accuse an emitter without independently established drainage connections and sampling evidence.

## Practical scaling path

The current 1,495-row browser bundle is reasonable for a small demonstration. For larger data, retain the same measured/derived/provenance separation while moving query/filter/aggregation to a versioned API and PostgreSQL/PostGIS. Add spatial/date indexes, bounding-box pagination or vector tiles, background ingestion, authentication and independent QA approval. Do not load every national observation into React state. The current raw snapshots and frozen model remain a reference fixture, separate from new operational data.
