# Climate++ — water access, pollution GIS and continuity planning

Release **0.3.0**, 24 October 2026. An editable React/Vite research MVP for Bangladesh, separating public inventory, historical measurements, publisher classifications and fictional disaster-planning scenarios. The video remains deferred.

## Run in VS Code

Install Node 24 LTS (tested: 24.15.0, npm 11.12.1). Open `climateplus.code-workspace`, then run from its root:

```powershell
npm ci
npm run check
npm run dev
```

Open **http://127.0.0.1:5173**. Stop with Ctrl+C. If PowerShell blocks `npm.ps1`, use `npm.cmd`. Strict-port mode prevents silently testing another app. No API key, account or Python is needed to run/build. Dependency installation and OpenStreetMap tiles need internet.

```powershell
npm run build
npm run preview
```

Production preview uses **http://127.0.0.1:4173**. Serve `dist` at the website root because data URLs begin `/data/`. Opening `index.html` directly is unsupported. The dev server proxies the optional localhost chain; production preview does not.

## GIS workflows

1. **Find water:** search 20,084 WPdx+ points by covered-area preset, coordinates, name/provider and radius. Inspect assessment dates/source evidence, select by map or keyboard list, open a location pin, and export a field shortlist. All inspections are from 2014–2019; every point requires current availability and quality confirmation. None is certified safe or currently open.
2. **River pollution:** historical pH/DO/COD exceedances and a separate 9,958-coordinate Kaggle context layer. Filter river/year or publisher class. Unknown stays unknown. The distance circle selects nearby old inventory records for investigation; it is not a plume, affected population or safe zone.
3. **Disaster planning:** supplied Dacope QGIS geometry, road-derived routes and fictional assets/hazards. Switch conditions and open the seven-day plan with GIS-derived blocked days and source-hash lineage. The severe detour is not falsely described as a disconnected road.
4. **Water care:** linked flood/chemical precautions, protected storage, pollution prevention, transparent leak/storage arithmetic, Bangla key actions, and printing. Defaults are examples, not prescriptions or measured savings.
5. **Evidence tools:** source-mixing closure, frozen DO evaluation and explicit-unit import remain available. Continuity, comparison, action register, demo notices and receipts remain separate workflows.

Map colours do not certify drinking water. Location pins do not establish safe travel. Downloaded shortlists retain dates and unverified status. Device location is optional; calculations are local, while map tiles disclose the viewed area to OSM. Resident locations are not silently persisted.

## Structure

```text
src/App.jsx                    Navigation, continuity and GIS receipt lineage
src/gis/                       Task views, Leaflet map, loading, styles
src/gis-engine.mjs             Distance, evidence status, search, proximity, arithmetic
src/gis-scenario.mjs           GIS-to-planner adapter and source lineage
src/PollutionPanel.jsx         Advanced water-evidence tools
src/{engine,water-engine}.mjs  Numerical engines and frozen model inference
research/gis/v1/               Original supplied GeoPackage and handoff
research/gis/kaggle-v2/        Original CSV, metadata and acquisition hashes
research/gis/wpdx-2026-10-24/  Public API CSV, metadata, query and coverage audit
research/water/                Original Mendeley CSV/XLSX and Gazette reference
research/raw/                  Original NASA/NOAA snapshots
public/data/                   Browser records, models, evaluation and source register
scripts/                      GIS builds, research reproduction, integrity checks
tests/                        Numerical, GIS, regression and dataset tests
docs/                         Current design, validation and extension guidance
documentation/                Baseline scientific, operator and venture documentation
examples/ and schemas/        Illustrative input JSON and observation schema
tools/local-chain/            Separately installed optional EVM demonstration
verification/                 Release records included in the collaborator handoff
```

Eight entries in `DATASETS.json`: Dhaka Mendeley v1; BASIS Mendeley v2; NASA POWER; NOAA CPC RONI; ECR2023 Gazette; Dacope QGIS v1; Kaggle v2; WPdx+ snapshot. All necessary raw snapshots are in the handoff. Source authors, versions, URLs, rights, transformations, limits and hashes are recorded. Read **[GIS-MVP-VALIDATION](docs/GIS-MVP-VALIDATION.md)** and **[ATTRIBUTIONS](ATTRIBUTIONS.md)** before interpreting outputs.

## Development checks

| Command                  | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run check`          | Formatting, core suite, production build and data hashes            |
| `npm test`               | Core/GIS tests and parity for 171 supported held-out DO predictions |
| `npm run format`         | Format JS/JSX/CSS and current configuration/docs                    |
| `npm run verify:data`    | Verify registered raw and frozen derived/reference assets           |
| `npm run verify:handoff` | Verify the complete received source/data manifest                   |
| `npm run benchmark`      | Deliberately regenerate 144 synthetic policy runs                   |
| `npm audit`              | Check currently reported core dependency advisories                 |

Intentional source edits cause handoff mismatches. Preserve the received ZIP/hash; investigate unexpected changes instead of rehashing to conceal them. Raw measurements are immutable; add new source versions. The public source register is `public/data/source-register.json`.

The app needs Node only. Exact GIS reconstruction tests need Python and explicitly skip if unavailable. No QGIS, GDAL or paid GIS account is required for the supplied standard-library converter. Rebuild into a scratch folder:

```powershell
python scripts/build-gis-network.py --out .build-gis-check
python scripts/build-gis-resources.py --out .build-gis-check
```

For reviewed source updates only, `build-gis-network.py --register` and `register-gis-evidence.py` update registers. Registration compares retained raw files against acquisition/existing hashes. It is an intentional release action, not a replacement for verification.

## Scientific reproduction

Use Python **3.14** and the pinned research environment:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-research.txt
.venv\Scripts\python.exe scripts/reproduce.py
```

On macOS/Linux use `.venv/bin/python`. The script creates an isolated `reproductions/` directory and compares baseline records, survey/hydraulic inputs, forest, held-out predictions, climate experiment and 144 policy runs at `1e-9`, preserving shipped outputs. GIS additions do not retrain the DO model or use Kaggle classes as labels. Historical evaluation is not prospective validation or a safety certificate.

## Optional local EVM

Not required for GIS, inference, hashing or planning:

```powershell
npm run chain:install
npm run test:chain
npm run chain
```

Run the dev server separately. Chain 1337 is ephemeral, without real funds/public-chain assurance. Its isolated legacy dependencies have unresolved advisories, including critical severity. Keep it on loopback and remediate/replace before public service. Node 24 uses the tested JavaScript fallback for Ganache µWS. See `tools/local-chain/README.md`. Older migration scripts are outside the supported workflow; use the active package scripts.

## Next gates

Verified drinking-water destinations need a partner's current availability, appropriate chemical/microbial tests, responsible review, expiry/revocation and access evidence. No such public feed was supplied, so the app does not invent clearance.

For new datasets/GIS, retain version/rights, validate CRS/date/units, document joins/missingness and test changes. Proximity is not hydrological connectivity or exposure. For larger operational data, add a versioned API/PostGIS store, authentication, reviewed custody and durable storage with a field partner. Code licensing remains the owner's decision; data/dependency rights retain their own terms.
