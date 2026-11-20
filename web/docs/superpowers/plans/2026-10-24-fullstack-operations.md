# Full-stack operational MVP implementation plan

> Use parallel independent domains with owned files; root integrates and performs end-to-end verification. Read the full design and this plan before implementation. Track progress in the ledger.

**Goal:** Complete persistent, multi-user water operations, real device-GPS support, dynamic road routing/blockage alternatives and actionable pollution records, with a portable development package.

**Architecture:** React/Leaflet client and Vinext API handlers, shared plain-JS backend/routing modules, local SQLite-compatible D1 and hosted Cloudflare D1. Trusted Sites identity and private trip membership; metadata must distinguish representations, user reports, device fixes and derivations.

**Spec:** `docs/superpowers/specs/2026-10-24-live-operations.md`.

## Global constraints

No inferred safe well. No simulated coordinates labelled live. No claimed flood-safe path or validated traffic ETA. Source hashes/reasoning visible. No backend authorization from client-chosen identity. Preserve raw snapshot bytes, source attribution and existing Site audience. Hosted schema migrations only; no runtime DDL.

## Review focus

Stale/off-graph GPS must not become an accurate ETA; inaccessible trip IDs cannot leak position; reported closures must actually affect routing and expire; all blocked/disconnected cases must fail honestly; operator review must not become a drinking-water certificate.

### Task 1 — Migration and shared contracts (root)

- [x] Open existing Site source; preserve baseline and prepare framework without replacing working client logic.
- [x] Configure D1 binding, API catch-all, client-only Leaflet bootstrap and local sign-in; verify minimal API/DB startup.
- [x] Install one consistent lockfile; keep public/raw data unchanged.

### Task 2 — Road graph and routing (routing agent)

- [x] Inspect actual GeoPackage roads/topology/grade metadata; document assumptions.
- [x] Write failing tests for shortest route, exclusions, real distinct alternative, disconnection, coverage and bad coordinates/speed.
- [x] Deterministic graph export and routing engine with exact shared interface; known Dacope assets route from supplied geometry.
- [x] Report graph/input/output hashes, tests and any limits; do not edit backend/client/shared config.

### Task 3 — Persistent backend (backend agent)

- [x] Implement schema, store adapters and API from shared contract, using failing integration tests on actual SQLite.
- [x] Cover ownership/membership/invites, GPS validation/staleness/replay separation, closure persistence/expiry/rerouting, pollution/case evidence and exports.
- [x] Produce Drizzle schema and schema-only migrations once dependencies exist; no hidden hosted seed or runtime DDL.
- [x] Report endpoint/data contracts and tests; do not edit routing/client/framework config.

### Task 4 — Operator and pollution UI (root)

- [x] Backend status/auth and first-task live operations interface.
- [x] Dynamic map, primary/alternative and selected segment blockage controls; replay and real GPS sharing/stop/delete, sync timestamps and stale state.
- [x] Persisted field observation/case form and evidence/reason drawer; integrate reference libraries without implying current safety.
- [x] Improve navigation/mobile/keyboard affordances and recovery states.

### Task 5 — Integration, verification, delivery (root + fresh review)

- [x] Integrate actual graph/API, run migrations locally, verify SQLite persistence and two-client updates.
- [x] Validate alternative route on blockage, expiry, no route, stale/bad GPS, invitation isolation and private exports.
- [x] Run full suite, built Worker preview, scientific parity, dependency/data/source audits and browser checks.
- [ ] Address fresh review findings with regressions; deploy Worker/D1 with existing access and verify hosted state.
- [ ] Build versioned clean collaborator package with frontend/backend/schema/migrations/datasets, local setup, API specification, database backup/export, tests and honest remaining field-validation limits.
