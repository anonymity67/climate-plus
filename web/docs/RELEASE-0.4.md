# Release0.4 · verification and claim boundaries

24 October2026. This release replaces browser-only operational state with an authenticated HTTP API and D1 persistence. Historical GIS remains a separate evidence library; it does not certify current water safety.

## Verified software behavior

| Requirement                         | Evidence and scope                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend/database/frontend           | `app/api/[[...path]]/route.ts`, `backend/`, `db/schema.ts`, `drizzle/`, React operational views; full Worker build and local HTTP smoke.                                                                                                                                                                                     |
| Durable records                     | Real SQLite and Miniflare D1 tests close/reopen storage; atomic failed mutation rolls back audit and data together. Local browser trip/observation survived server restart and page reload.                                                                                                                                  |
| Actual GPS implementation           | Browser Geolocation `watchPosition` only after explicit click/consent. Timestamp, accuracy, freshness and source tests; HTTP device fixtures exercise authorization/storage/off-graph behavior. **Physical device precision, mobile background behavior and field transport were not tested.**                               |
| Privacy and collaboration           | Ownership/membership isolation, independent HTTP actors, single-use expiring invitation, role restrictions, no-store, same-origin writes, stop/delete barrier and bounded retention tests. Hosted gateway behavior is a platform boundary, not proof of a custom session system.                                             |
| Real road routes and alternatives   | Deterministic GeoPackage reconstruction; actual ordered road geometry, component/snap/grade rules, closure exclusions, preference and distinct alternatives tests. Browser blockage changed7.89km to9.74km. No physical access or flood-safe claim.                                                                          |
| Validated input/output              | Server rejects impossible dates/units/coordinates, stale/future/nonmonotonic positions, unknown edges and oversized bodies. Scientific engine and frozen held-out parity tests remain separate from field validation.                                                                                                        |
| Pollution workflow                  | Browser saved labelled observation, displayed2/3 failed objectives with declared evidence, created linked investigation and saved sampling stage. SHA-256, privacy, immutable result, stale/concurrent edit and audit tests. No sample authenticity or drinking-water certificate inferred.                                  |
| Sources and representational labels | Eight original source datasets,42 frozen data/reference assets, source register, raw snapshots, graph hashes and dataset limitations. GIS assets/hazards, replay and examples stay representational.                                                                                                                         |
| Responsive usability                | Browser desktop1280-class view and390px phone-width inspection. Fixed measurement-table overflow with keyboard-focusable horizontal region; all columns remain reachable. One design-detector pass returned`[]`. Browser functional checks covered saved trip, blockage, replay step, observation, investigation and reload. |
| Dependency hygiene                  | Updated framework/tooling; locked compatible patch overrides for esbuild, undici and fflate; `npm audit` reports zero known advisories at this date. This is a point-in-time registry result, not a guarantee of future security.                                                                                            |

## Reproduce checks

```powershell
npm ci
npm run setup:local
npm run check
npm start -- --port 5191
# In a separate terminal:
npm run smoke:local -- http://127.0.0.1:5191
```

`npm run check` includes93 tests with Python available, adapter type checks, formatting, production Worker build and42 hashes. Python-unavailable environments explicitly skip exact source-conversion tests; do not report those as passed. `smoke:local` creates clearly labelled local fixtures and injects test identities only on loopback; it is not a hosted authentication bypass or real GPS acquisition.

The local development mock account does not exist in the production database by default. Local/runtime databases, test GPS rows and invitation tokens are excluded from the collaborator archive. Hosted source/version/deployment IDs and clean archive verification are recorded in the adjacent final-delivery report; do not infer deployment from a successful local build.

## Evidence limits that remain part of the product

No current authenticated water-point clearance or inventory feed, authoritative real-time flood/closure feed, vehicle-access survey, laboratory custody verification or measured field-impact study is provided. Browser-reported GPS can be spoofed. Dacope graph coverage/topology is incomplete; bidirectionality and bridge endpoint ramps are modelling assumptions. Alternatives may share roads. Road ETA uses assumed speed, not calibrated traffic. Proximity to pollution is not a plume, exposure estimate or attribution of an industrial emitter.

WPdx20,084locations were assessed2014–2019 and are heavily concentrated in Cox's Bazar; no Dacope-labelled points are present. Kaggle9,958coordinates are publisher classifications without dates/units/classification validation; they are contextual, not health ratings. Dhaka Mendeley1,495historical rows and BASISv2 retain source-specific QA/geolocation limits. The fisheries screen uses3 of12 parameters and cannot establish potability. All of these limits remain visible in the UI/source register.

The retained baseline pitch, economics, science documents and optional chain demonstration are historical supporting materials. They must not be cited as proof that a field pilot, adoption, savings, safe-water clearance or impact validation has occurred. The video remains deferred by user request.

Final independent review found and fixed: deletion of hidden idle GPS history remained inaccessible in the UI; clearing a case note silently retained it; signed-out invitations lost their token on sign-in. Regression checks cover hidden-row physical deletion, explicit note clearing, and expiring tab-scoped invitation handoff. No critical defects were identified in that bounded review; it is not a field validation.
