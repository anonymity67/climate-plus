# Development and database operations Â·0.4

Use Node24 and locked dependencies. Run `npm ci`, `npm run setup:local`, then `npm run dev -- --host 127.0.0.1 --strictPort`. The local sign-in handler supplies a loopback-only test identity. These commands do not download hosted records.

## Database lifecycle

Eight application tables: trips, memberships, fixes, closures, invites, observations, cases and events. `db/schema.ts` is the Drizzle source; `drizzle/0000_nice_secret_warriors.sql` creates schema/indexes; `backend/schema.sql` is its exact standalone test fixture. HTTP handlers never create schema.

```powershell
npm run db:generate
npm run setup:local
npm test
npm run build
```

Inspect generated migrations/snapshots. Append migrations; never alter already applied history. Keep migrations schema-only and bounded. `setup:local` generates ignored `.sites-runtime/local-migrations.json` with the current absolute migration path and logical`DB`binding. SQLite state lives at `.wrangler/state/v3/d1` and is private runtime data, excluded from handoff.

For a local database backup, stop all servers first and copy the entire `.wrangler/state` directory to a private backup location outside the source. Restore only with servers stopped and compatible schema. Do not copy a live SQLite file without its WAL. `/api/export` is a private evidence export, not an automatic disaster-recovery importer. Hosted backup/restore requires the platform's authorized D1 tools; the source ZIP is not a production database backup.

## Built Worker preview

```powershell
npm run build
npm start -- --port 5191
```

This serves the built Worker with local D1. It does not provide development mock sign-in. Use `npm run dev` for normal browser development. The local smoke command injects documented identity headers **only into a loopback test Worker**:

```powershell
npm run smoke:local -- http://127.0.0.1:5191
```

It creates labelled local test records, tests independent actors, invites, routes/closures, telemetry validation, investigations and private exports. Coordinates are fixtures, not acquired device GPS. Never target a hosted endpoint or treat these headers as production authentication.

## Security boundary

`app/chatgpt-auth.ts` reads dispatch-authenticated headers. The Site gateway must strip/replace caller identity headers. A different hosting provider requires verified session authentication before exposing the API. There is no fallback production administrator. HTTPS is required for GPS outside localhost.

Mutations require same-origin Origin; JSON is bounded32KiB; private responses use no-store. Roles restrict fixes/closures/invites. Invitation tokens are random, hashed, expiring and single-use; tokens are shown once and put in URL fragments, not query strings. `.env.example` documents that local use needs no application secret.

## Verification and research

`npm run check` covers formatting, adapter types, numerical/API/GPS/routing tests, Worker build and hashes. Tests use actual Node SQLite and Miniflare D1 for persistence and rollback. Python-dependent GIS reconstruction tests explicitly skip if Python is unavailable. Frozen model parity is separate from real field accuracy.

`python scripts/build-road-graph.py` recreates both canonical graph copies. `python scripts/build-gis-network.py --out .build-gis-check` and `python scripts/build-gis-resources.py --out .build-gis-check` rebuild historical GIS into scratch space. Research dependencies remain in `requirements-research.txt`; commands/methods are in retained scientific documents. Kaggle publisher labels are not used to train a drinking-water model.

The optional EVM receipt tool is independent: `npm run chain:install`, `npm run chain`, `npm run test:chain`. It demonstrates integrity, not laboratory authenticity, and is not required for GPS or pollution persistence.

## Before field or larger deployment

Current potability, supply, flood, traffic, official closure and verified vehicle-access feeds are absent. Preset assets/hazards are representational. GPS is browser-reported and can be imprecise/spoofed. Polling can be interrupted on backgrounded mobile devices. ETA is mapped distance plus explicit speed assumptions, not empirical traffic calibration.

Scale-up work: pagination/quotas for growing account histories, notifications, scheduled physical GPS cleanup, authoritative source onboarding, observability, field calibration and a partner-reviewed incident process. Requests and routing work are bounded, but private list/export output grows with stored history. Do not claim an unperformed capacity or emergency-readiness certification.

The typecheck command runs official Vinext type generation first, so a clean extraction can rebuild ignored `.next/types` before adapter checking. A signed-out invitation recipient may hold the pending token in that tab's session storage for up to ten minutes; it is consumed/cleared when the delivery view loads. Owner-created invitation tokens remain in component memory, and no token enters a query string. Blocked tab storage requires reopening the original invitation after sign-in.

The optional legacy EVM service uses the development-only `/chain` proxy to127.0.0.1:5174. Its origin allowlist requires the normal5173 development URL. It is absent from hosted/built-Worker operations; local EVM controls are hidden off loopback. The optional Ganache tree has unresolved advisories documented in its own README/audit; the zero-advisory core result does not include this separately installed legacy tool.

## V3 map-first extension

The defaultentry is now the response map in src/mvp; old App is retained as src/LegacyApp.jsx through workspace=advanced. Main POST /api/scenario-route is stateless, public within the Site, validates region/role/hazard/edges, and performs no private database reads or writes. Client server-result checks reject mismatched region/hazard/graph hashes; labelled local fallback uses the same calculator. Private trip/closure/replay routing uses persisted regionId. Apply all ordered drizzle SQL including0001_regional_trips; existing trips defaultdacope.

See docs/REGIONS-V3.md for graph acquisition/reproduction and docs/POLLUTION-POINTS-V3.md for strictpoint inputs. The current README supersedes baseline UI walkthroughs; examples are representational, and providedCSVrows carry explicit sourceKind. The point draft and all entered coordinates remain unchanged when regions switch. Save acknowledgements and all-entered GeoJSON exports are distinct from the current region-enabled-layer export.
