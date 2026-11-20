# Climate++ · Water platform V4

**Find a recorded water source. Check river evidence. Plan a more resilient supply.**

Climate++ is a working full-stack Bangladesh water platform with three focused tasks and a private follow-up loop. It combines real source inventories, dated river measurements and actual mapped channels. The existing calamity tools remain under **Plan supply → Practise a disrupted delivery**. This source package is **4.0.0**, dated 17 November 2026. Earlier READMEs are retained in `provenance/`; earlier competition documents are reference history.

## Run in VS Code

Install **Node.js 24 LTS**. Extract the entire ZIP and open `climateplus.code-workspace`. From its root:

```powershell
npm ci
npm run setup:local
npm run dev -- --host 127.0.0.1 --port 5195 --strictPort
```

Open **http://127.0.0.1:5195/**. Use `npm.cmd` if PowerShell blocks `npm.ps1`. Choose another port if occupied. Stop with Ctrl+C; do not run two dev instances in one checkout. Python is optional for research/data acquisition and ZIP verification, not ordinary app use.

Public data needs no sign-in. To keep private checks or measurements, use the displayed **Sign in** link. Local development supplies the **loopback-only Seedy test identity**, `seedy@sites.test`; this is not production authentication. The fresh package includes no credentials, runtime database, private notes or device-location history.

## Compile and run the built app

```powershell
npm run build
npm run setup:local
npm run serve:local -- --port 5198
```

Open **http://127.0.0.1:5198/**. This runs the compiled Worker, static assets and real local D1/SQLite database through a loopback-only preview adapter with test sign-in. It strips incoming identity headers and binds only `127.0.0.1`. **Do not expose this adapter through a tunnel or public reverse proxy.** Production requires the real trusted authentication gateway and D1 migrations.

The underlying Worker can also run with `npm run start -- --port 5199`; direct Worker browser authentication requires the hosting gateway, rather than the local preview adapter. Initial dependency installation and optional OpenStreetMap base tiles require internet. Data, fonts, graphs and channel snapshots are local. There is no runtime Overpass request, mapping API key or paid account requirement for local use. If base tiles fail, data layers and lists remain usable.

## Three useful demonstrations

### Find water

1. Choose **Cox's Bazar / Ukhia → Find sources**. This is an actual historical record's area, not your device location.
2. Select a list/map point. Inspect its original inventory date, provider, ID and coordinate. The map shows the current 30-result page; use Next/Previous for the rest. Names repeat; original IDs distinguish records.
3. Choose **Record a check**, write what needs checking and save. Sign in when prompted. Reopen **My records** or the source history after reloading.

The inventory contains **20,084 WPdx Bangladesh records assessed 2014–2019**. Coverage is uneven. Current water safety, supply, hours, price and access are unknown. Distance is straight-line. A saved visit is a self-reported record, not a drinking-water clearance.

### Check rivers

1. Choose **Tongi Khal → u/s Ijtema Field**. The original **15 July 2021** sample has pH **6.86**, dissolved oxygen **4.62 mg/L** and COD **70 mg/L**. Inspect the full dated history and original dataset.
2. The map shows real river/stream/canal/drain/ditch geometry. The inspector gives a nearest-section association, its gap and sampled places within 5 km on the same mapped network. Connections use shared OSM node IDs, not apparent line crossings or proximity gaps.
3. Toggle **Publisher context · unverified** for Kaggle coordinates and classes. Dates, units and class validation are unknown. Drawing is capped at 300; the selector/export reaches the full area subset.
4. In **Sylhet channels**, show the 40 velocity-survey points. They are not water-quality stations. **Dacope waterways** shows genuine channels without inventing chemistry coverage.
5. **Add a measurement** accepts actual sample date, original coordinates, units and source attribution. Use the explicit demonstration source type for invented values. Saved entries are private; **My saved measurements** shows them on the map. Open a follow-up case and update it in **My records**.
6. Import CSV/GeoJSON up to 1 MiB / 200 points. Invalid rows reject the file atomically. Preview before saving. Blank means unmeasured, not zero. Stable retry keys prevent duplicate measurements/cases when an acknowledgement is lost.

Draft entries/import queues stay in this tab's session storage across navigation/sign-in. This is local browser storage, not account synchronization. Export before closing or using a shared device. Chemistry is compared to **three inland-fisheries objectives**; it is not overall WQI, drinking-water safety, current monitoring, a health-risk zone, legal compliance at the sample date or industrial-emitter attribution.

### Plan supply

Enter roof area, collected share, tank capacity, starting reserve, daily demand and daily rainfall. Starter values are illustrative, not a forecast. **Calculate water balance** shows demand met, remaining shortfall, overflow and final reserve, with a full daily table and export. Try the same rainfall arriving earlier/later: timing and tank capacity matter. Every litre is accounted for.

Measure a leaking tap's volume and collection time to estimate steady-rate waste. Collection quantity does not establish drinking-water safety. **Practise a disrupted delivery** opens the retained five-region graph routes, declared closures and labelled moving replay. Assets/hazards are representational; replay is not live GPS and routes are not certified disaster-safe. The older allocation/research tools remain in **Advanced research workspace**.

## Data, methods and reproduction

| Source                   | Included material                                                               | Main limitation                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| WPdx+ Bangladesh         | Original CSV, 20,084 original-coordinate searchable records                     | 2014–2019; no current safety/supply clearance                                              |
| Dhaka Mendeley v1        | Original CSV, 1,495 observations, site histories and research model evidence    | 2017–2021; incomplete original lab QA; invalid negative parameters excluded from screening |
| Sylhet BASIS v2          | Original workbook, separate velocity survey and hydraulic research              | No verified quality-station coordinate crosswalk                                           |
| Kaggle river context v2  | Original 9,958-coordinate CSV, classes/values and audit                         | Unknown sample dates, pollutant units and class validation                                 |
| OSM waterways            | New raw queries/JSON/metadata and derived connections for Dhaka, Sylhet, Dacope | Mapped connections, not measured hydraulic flow or pollution transport                     |
| User GIS repo / Antar v2 | Original GeoPackage, preserved Dacope scenario, graphs and hashes               | Fictional service assets and hazards on real roads                                         |
| Additional OSM roads     | Existing Ukhia, Chattogram, Khulna and Tongi graphs/scenarios                   | Bounded demonstrations, not complete city/field-access coverage                            |
| Earlier climate research | NASA POWER, NOAA/REACH references and validation                                | Retrospective research, not live forecasts or alerts                                       |

**`DATASETS.json`** registers sources; **`DATA-MANIFEST.json`** verifies frozen source/derived bytes; **`EVIDENCE-MANIFEST.json`** verifies the collaborator package. Hashes establish identity, not measurement truth. Preserve individual licences and credits in `ATTRIBUTIONS.md` and `LICENSE-NOTICE.md`. Never move points to make a map look populated.

```powershell
npm test
npm run typecheck
npm run build
npm run verify:data
npm run verify:streams
npm run verify:handoff
```

`npm run check` combines formatting, types, tests, build and data checks. Handoff verification succeeds on delivered files and intentionally detects later edits. `npm run rebuild:streams` deterministically rebuilds channel assets offline. Optional Python regional tests: `python tests/regions-builder.test.py`.

Acquisition is separate: `python scripts/acquire-waterways.py --area dhaka` freezes a bounded query and refuses to overwrite an existing source. To refresh, create a new dated source version, preserve old hashes, validate coverage/licence and deliberately update `scripts/build-waterways.mjs` and `scripts/register-water-platform.mjs`. Normal use does not run acquisition.

Read **`docs/WATER-PLATFORM-V4-METHODS.md`** for exact bounds, timestamps, algorithms, evidence gaps, units and privacy; **`docs/WATER-PLATFORM-V4-API.md`** for interfaces; **`docs/WATER-PLATFORM-V4-VALIDATION.md`** for actual checks. The first-party platform comparison is **`docs/research/2026-11-17-water-platform-benchmarks.md`**.

## Architecture and the next iteration

React task UI: `src/platform/`. Pure volume/projection/topology modules are separate from rendering. Server catalogue/validation: `backend/water-*.mjs`; existing trips/GPS/observations/cases/audit remain in `backend/api.mjs`. Vinext runs a Cloudflare Worker; D1 and local SQLite use the same ordered Drizzle migrations.

Migration `0002` adds append-only source checks. `0003` adds optional owner-scoped retry identifiers to measurements/cases without rewriting existing data. Creation and audit commit together. Repeated identical keys return the original row; conflicting payloads return 409. Private reads use authenticated ownership. Case updates preserve revision conflicts and audit. Reviewed/closed means workflow state, not water-safety certification.

Add regions through real acquired data and registration. Add measurement panels with explicit parameter definitions, units and source-specific methods. Directed pollutant transport needs hydraulic data, barriers/tides and field validation; do not turn undirected map connections into a plume. Public drinking-water guidance needs current authorized operator records and appropriate quality evidence. Sustainable groundwater yield needs hydrogeological/recharge data; the rainwater calculation does not establish it.

## Hosting state

The original Site ID/audience configuration is retained. On 17 November 2026, the current Sites connector returned **“Sites project not found”** for the existing project and credential request. This is a runnable full-stack source deliverable; **the previously published site has not been updated by this iteration**. No duplicate Site or wider access was created to bypass that error. Restore the original owner's hosting access before publishing this source to that Site. Production must use the trusted gateway, not the local test adapter.
