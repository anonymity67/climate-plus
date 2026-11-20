# V3 verification and claim boundaries

V3 is one map workflow: choose a regional response scenario, inspect/reroute/play a delivery, and enter source-labelled pollution points. It adapts Antar's handoff-v2 rather than relocating Dacope coordinates or claiming new surveyed facilities.

## What is actually implemented

| Requirement                           | Evidence                                                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same scenario workflow across regions | Five independent regional graphs/index/scenarios; six service roles each; deterministic raw-source conversions and actual engine route/closure tests.                                                             |
| Original Dacope reference respected   | Antar asset coordinates and hazard polygon vertices retained; handoff files and hashes in research/gis/antar-v2.                                                                                                  |
| Real backend interaction              | POST /api/scenario-route validates region/role/hazard/edge input, uses bundled regional engines, returns server calculation; map checks region/hazard/graph hash before accepting it. Local fallback is labelled. |
| Route, time and genuine alternatives  | Ordered road geometry, modelled speed/caps, actual graph exclusions, explicit no-route results; moving playback follows the selected path.                                                                        |
| Pollution now has an input field      | Coordinate pick, strict dated/unit-bearing manual input, atomic CSV/GeoJSON validation, immediate point placement, private acknowledged save and GeoJSON export.                                                  |
| Source truth preserved                | Historical measured values/date remain original; Kaggle scores/classifications stay separate unverified context; no coordinate shift or inferred exposure plume.                                                  |
| Persistent regional operations        | Follow-on region_id migration, old-trip default dacope, regional route/replay/closure validation and existing ownership/invitation/GPS-delete protections.                                                        |
| Clearer interface                     | Main view has one region/scenario toolbar, map, playback and point panel. Legacy workflows are secondary. Desktop/phone screenshots and browser workflow checks retained.                                         |
| Reproducible collaborator source      | Node24 lockfile, frontend/API/schema/migrations, original data/queries/rights/hashes, deterministic builders, complete setup/extension instructions and source manifest.                                          |

## Checks

The release check runs formatting, generated adapter types,124 Node tests, full Worker build and81 frozen source/derived/reference hashes. Two additional Python builder tests prove offline byte-identical regeneration and prevent out-of-extent segments from introducing fabricated connections. Core npm audit reports zero known advisories at verification time; the separately installed legacy local-chain tree has its own unresolved-advisory notice and is not deployed.

`npm run smoke:local` exercises an actual built loopback Worker/D1: public five-region server scenarios and storm detours; private regional trips/routes/replays; normal authentication/origin enforcement; role/invitation isolation; device-source fixtures and off-graph ETA withholding; observation/case/hash/export persistence. Fixture identities/coordinates are local tests, not physical GPS or production sign-in. Native deployment/schema/audience results and fresh ZIP extraction checks are recorded in the adjacent final-delivery report, not inferred from a local build.

Browser checks cover normal/storm regional switching and state reset; Dacope movement and detour; Tongi3 measured sites plus25 separate context points; point creation/save; preserved draft on region change; a two-region CSV import with per-row representational provenance; all-entered export including outside-region/layer-off points; keyboard road blockage; and390px layout with no horizontal page overflow.

Review reproduced and fixed three important problems: draft loss when coordinate-picking markers, incomplete exports of out-of-region unsaved input, and canvas-only road/limited observation keyboard access. Recheck found these addressed; no critical defects were reported in that bounded review. Vehicle markers are reused during playback. Bangladesh date-boundary tests preserve local calendar semantics without altering UTC telemetry timestamps.

## What this does not establish

The six service roles and hazard polygons are representational, including in additional towns. Road snapshots are real OSM geometry, but vehicle access, bridge loading, map completeness, current flood/traffic and physical connector gaps are unverified. Moderate/severe polygon sizes do not predict road closure: the scenario explicitly declares graph-edge effects. Alternative paths can share roads. Route time is modelled at an assumed speed, not validated traffic ETA.

The amber marker is replay, not live fleet GPS. Actual browser GPS requires opt-in, can be spoofed/imprecise and has not undergone hardware/field calibration here. Main-map GPS stays local and is not an ETA input; private shared tracking remains a separate authenticated workflow.

No current drinking-water quality/availability clearance, independently authenticated laboratory result, industrial-emitter attribution, contamination plume, affected population, adoption or field impact is claimed. Fisheries screening uses only three parameters. Existing historical venture/scientific documents remain reference material; current V3 behavior and evidence are described here and in the README/API/regional documentation.

Before field dispatch, operators need authorized current facility records, confirmatory water-quality evidence, access/condition checks, qualified local partners and an approved incident process. V3 demonstrates an expandable and testable workflow; it is not certified emergency infrastructure.
