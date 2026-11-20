# Climate++ · Water operations & evidence

Release **0.4.0** · 24 October 2026. Full-stack MVP: React/Leaflet frontend, Vinext HTTP API, Cloudflare D1 database, Drizzle schema/migrations and reproducible Dacope road routing. The video remains deferred.

## Start in VS Code

Install **Node 24 LTS** (verified with 24.15.0) and npm. Extract the entire package and open `climateplus.code-workspace`. In its root terminal:

```powershell
npm ci
npm run setup:local
npm run dev -- --host 127.0.0.1 --strictPort
```

Open **http://127.0.0.1:5173/** and click **Sign in to operations**. Loopback development uses the starter's test account, Seedy; this is not a production administrator. If PowerShell blocks `npm.ps1`, use `npm.cmd`. Stop with Ctrl+C. If port5173 is occupied, append `--port 5190` and use the printed URL. Keep development bound to loopback.

`setup:local` applies versioned migrations to `.wrangler/state/v3/d1`. It is idempotent and does not seed fictional data. No API key or paid GIS account is required locally. Installation and OSM tiles require internet. Python is needed only for research/GIS reconstruction, not the application runtime.

```powershell
npm run check
npm run verify:handoff
```

`check` covers formatting, TypeScript adapters, numerical/API/routing/GPS tests, the full Worker build and frozen dataset hashes. `verify:handoff` checks received source/data integrity; intentional edits change its result. Preserve the received ZIP/hash and investigate unexpected changes.

## Demonstration walkthrough

1. **Live deliveries → New trip.** Choose operational mode for actual opt-in GPS, or replay mode for a labelled demonstration. Supplier and Dacope reserve templates stay within the supplied road coverage. Both are representational assets, not verified operating water sources. Manual coordinates are labelled operator-entered and unverified.
2. The server returns mapped road routes. Baseline supplier → reserve: **7,892.528m /18.9 modelled minutes**, assuming25km/h with road-type caps. This is not live traffic, a flood-safe route or verified vehicle access.
3. Select segment **`e-407214-0-9`**, enter a reason and save a blockage. The baseline reroutes to **9,740.886m** and retains the **11,209.758m** alternative. Reports are persisted, attributed, unverified and expiring. Revocation restores graph availability. Alternatives can share segments; hazard independence is not guaranteed.
4. Replay **Step10s / Play** moves an amber, explicitly replay-labelled position. Play advances10 modelled seconds every2 wall-clock seconds. Replay is never GPS or a field measurement.
5. Operational trips offer a supplier/recipient role selector, consent checkbox and **Share device GPS**. Only clicking this starts the browser permission/watch flow. **Stop & delete positions** stops the watch and requests server deletion. Reopening a browser never silently restarts sharing.
6. Owners can create single-use, one-hour invitations for supplier/recipient/viewer roles. Share privately with another signed-in account/device already permitted to access the Site. Open the link or paste the token into **Join a collaborator's trip**. Approximately three-second polls synchronize members; delayed updates are marked.
7. **Pollution monitoring → Record a measurement.** Enter actual values with units and a source reference, or explicitly load representational values. Inspect the saved coordinates/date, declared evidence, partial fisheries screening and immutable hash. Open a linked investigation and record sampling/review/follow-up actions.
8. Reload: trips, reports, observations and investigations persist. **My data / Export my evidence** downloads the signed-in owner's private export; an invited member does not export another owner's trip simply by having membership.

## Evidence semantics

- **No safe well is inferred.** WPdx locations are historical access candidates. Current quality, opening hours, supply and operator confirmation are unknown. User authorized public data with clear verification labels.
- Device GPS is timestamped browser-reported telemetry, not tamper-proof attestation. Only device fixes ≤30seconds old with accuracy≤100m are eligible route endpoints. Stale/poor fixes stay labelled; configured endpoint use is explained. Off-graph fixes return no invented road route or ETA.
- Routing uses927 OSM source road features,1,425nodes/1,563edges (1,514 vehicle-profile edges,40components). Missing one-way data implies disclosed bidirectionality. Bridge ramps, topology, road access and snap connectors require field verification. Gaps are excluded from distance/time. See [ROAD-GRAPH](docs/ROAD-GRAPH.md).
- Pollution indication shows failed/tested pH, DO and COD fisheries objectives. Only3 of12 listed parameters are assessed. This is not an overall standard WQI, drinking-water rating, polluter attribution, contamination plume or historical legal finding. Operator review is not authenticated laboratory validation.
- **Data library & GIS** separates Mendeley measurements, Kaggle publisher labels, WPdx inventory and fictional Dacope assets/hazards. Proximity does not establish exposure, causation, an affected population or a safe zone.
- Continuity planning, comparisons, action registers and resident notices remain **representational scenarios**, not current official operations/notices. Baseline research/venture documents are retained; current software behavior is documented here and in `docs/`.

## Privacy and hosting

Private API access enforces ownership/membership using Sites dispatch-authenticated identity. Never expose this Worker directly while trusting arbitrary caller identity headers. Another host needs a verified session/OIDC gateway that strips untrusted headers. Local mock authentication is loopback-development only. Production GPS requires HTTPS.

Positions are visible to trip members for a24-hour read horizon, with at most100 retained fixes per role after writes. Old idle rows are immediately hidden from API/export and physically pruned on subsequent role writes. Successful stop/delete removes role history and rejects delayed pre-stop uploads. Leaving the screen stops its watch but does not erase retained history. Failed deletion is explicitly unconfirmed with retry. Audit events contain roles/times, not raw coordinates. Private exports can contain retained coordinates; share selectively.

External OSM tiles disclose the viewed map area. There is no third-party directions API, location analytics or silent GPS collection. Tile failures leave vector routes/coordinate lists available. Operational synchronization needs connectivity and may be delayed by mobile background suspension.

Sites hosting uses D1 binding`DB` in `.openai/hosting.json`; committed schema-only `drizzle/` migrations apply before Worker upload. Local and hosted databases are separate. Append migrations; never edit applied SQL/history. Preserve the hosted audience unless explicitly authorized to change it. See [DEVELOPMENT](docs/DEVELOPMENT.md) and [API](docs/API.md).

## Source map

```text
app/                       Page, client bootstrap and authenticated API adapter
worker/                    Cloudflare Worker entry and connector context
src/operations/            Live map, GPS consent, API polling, pollution workflows
src/gis/                   Historical public inventory, pollution GIS and guidance
backend/                   API, D1/SQLite adapters and SQL fixture
backend/data/              Frozen server road graph; identical public copy
db/schema.ts, drizzle/     Eight application tables; versioned SQL/snapshots/journal
routing/engine.mjs         Closures, graph routing and position interpolation
public/data/               Frozen browser records, models, graph and source register
research/                  Necessary original supplied/downloaded datasets + metadata
scripts/, tests/           Setup, build, integrity, research and verification
docs/                     Current API, graph, setup and release verification
documentation/             Retained baseline scientific/operator/venture materials
examples/, schemas/        Illustrative inputs and observation schema
tools/local-chain/         Optional separately installed EVM receipt demonstration
verification/, provenance/ Audit records, prior release material
```

Eight original datasets are registered in `DATASETS.json`; the graph is a derived asset, not a ninth measured dataset. All necessary raw snapshots, versions, authors, rights, processing limits and hashes are included. Read [ATTRIBUTIONS](ATTRIBUTIONS.md), [GIS validation](docs/GIS-MVP-VALIDATION.md), [ROAD-GRAPH](docs/ROAD-GRAPH.md) and [release verification](docs/RELEASE-0.4.md). Source/data integrity does not establish measurement truth.

## Extension priorities

Onboard authorized, current water-point records with dated quality evidence and operator confirmation before any availability/quality clearance. Version expanded road coverage, check topology/access with field teams, and integrate authoritative current closure/flood data. Industrial attribution requires paired upstream/discharge/downstream samples, flows, laboratory custody and expert review. Validate public-health workflows with qualified local partners before a field pilot.

Source is editable; dataset inclusion is not a blanket redistribution licence. Read `LICENSE-NOTICE.md`. Keep runtime databases, GPS exports, invitations, credentials, `.env`, `node_modules` and builds out of shared source. The historical SPA entry is retained only as `docs/legacy-spa-index.html`; the active application entry is `app/page.tsx`.
