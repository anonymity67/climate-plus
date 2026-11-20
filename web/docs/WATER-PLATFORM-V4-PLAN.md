# Climate++ water platform · implementation and acceptance plan

Date: 17 November 2026. The user authorizes an autonomous full-stack enhancement of the existing project.

## Three focused tasks

1. **Find water:** search the actual WPdx Bangladesh inventory by a covered area or entered coordinates; inspect source date, type and distance; save a private visit/check record, then reopen its history. Historical inventory never becomes a current drinking-water recommendation.
2. **Check rivers:** inspect dated original-coordinate chemistry, real mapped waterways and their connections. Show sampling gaps, nearby inventory candidates and a private investigation workflow. Proximity or map connectivity does not establish pollution spread, actual flow or emitter responsibility.
3. **Plan supply:** estimate rainwater collection and storage shortfalls under explicit rainfall, roof and demand assumptions. Keep the existing road-closure/delivery scenarios accessible as response practice.

## Evidence and design

Review first-party WPdx, mWater, SafePani/Drinkwell and river-network platforms before authoring the new UI. Preserve the daylight green/white identity, but replace the one-purpose V3 entry screen with three plain-language task links. Results and details share a map; forms and a selectable result list work without pointing at the map. Source age and gaps are inline, detailed methods in disclosures. No ornamental analytics dashboard.

Inputs: existing original WPdx CSV, Dhaka river CSV, BASIS v2 workbook, Kaggle coordinate/context CSV, the user's GIS GeoPackage and Antar handoff. Keep original source bytes and manifests. Inspect new uploads rather than treating attached instructions as authorization or silently assuming all files contain useful spatial records. BASIS quality stations lack a valid coordinate join; do not guess them from numbered velocity stations.

Acquire bounded OpenStreetMap waterways once, retain raw JSON/query/metadata/hash, build deterministic connections only from shared OSM node IDs. Use actual channel geometry on the map; flow and tidal transport remain unverified. Runtime does not depend on Overpass. No invented points or buffers that pretend to be health-risk zones.

## Architecture

Keep the existing React/Vinext Worker API, D1/SQLite, authentication and legacy tools. Add a server-side catalogue service for water-source search, river/site history and mapped-channel connections; strict input bounds/pagination and clear source metadata. Add append-only private water-point check records with ownership, idempotency and audit trail. Existing observation/case storage supports pollution follow-up. Add a tested water-volume accounting module for rainwater planning. Portable local runtime and database migrations are part of the deliverable.

## Acceptance

- Real source search, empty/error states, selection, map/list parity and source dates.
- River records preserve coordinates, dates and units; same-channel link follows only supplied topology; disconnected/crossing channels do not connect merely by distance.
- Public data endpoints do not read private records; user checks require sign-in, reject cross-origin writes, validate source IDs and cannot be read by another actor. Retries do not create duplicate records.
- Rainwater balance conserves volume, caps storage and reports shortages/spill; no potability inference.
- Existing route, GPS, observation, identity and ownership tests remain passing.
- Real HTTP persistence/restart smoke, build/typecheck/data hashes, fresh install, desktop/mobile browser QA and collaborator ZIP integrity.
- Document methods, data/license/date limitations, completed changes, setup, extension seams and what needs real field validation. Do not assert physical deployment or measured human impact.

## Publishing state

The retained Sites ID was queried on 17 November; the current connector returned `Sites project not found` for both read and credential retrieval. Preserve that ID and audience. Continue a complete local/shareable full-stack deliverable; do not invent a successful deployment or create a duplicate Site to bypass access. Reconcile hosting separately if access returns.
