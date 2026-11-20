# Operational upgrade ledger

The active goal is the full user objective: real backend/database, opt-in actual GPS, dynamic closure-aware routing and alternatives, evidence/reasoning for markers, polished pollution workflow, complete development handoff. v0.3 is a baseline, not completion of this goal.

Initial authoritative inspection: repository clean; Site currently custom/shared, owner role. Existing application uses static JSON/browser state and has no operational API/database. GeoPackage roads layer has 927 LineStrings; all oneway fields are null. Highway types include 43 foot/pedestrian/path records and bridges at multiple layers; topology and access assumptions must be explicit.

Ruling: keep familiar React/Leaflet client; use supported Vinext/D1 full-stack path and the same SQL interfaces in Node SQLite tests. Production identity comes from Sites dispatch; operational rows are user-owned and shared only by scoped invitations. No global default admin or fabricated lab clearance.

Ruling: work in the dedicated clean Sites checkout on a feature branch with per-agent file ownership. The current deployed v0.3 remains untouched until the replacement is checked. Preserve baseline Git history and raw byte manifests.

Implemented: 8-table schema/migration, D1/SQLite adapters, member-private API, invitation/role boundaries, attributed immutable observations/cases, real GeoPackage routing and replay, and root-owned live/pollution views. User confirmed available public water data with clear verification labels. No current safe-well designation is created.

Fresh check passed with91 tests, adapter typecheck, Worker build and42 hashes. Actual built HTTP smoke passed with two independent local actors, scoped membership, closure reroute/preference, off-graph device fixture, deletion and pollution exports. Browser testing verified saved trip,7.89â†’9.74km blockage detour, replay step, observation/case persistence across restart/reload.390px measurement table overflow was fixed; one detector pass returned an empty array.

Dependency audit found outdated starter pins. Updated Vinext1.3.0/React19.3.1/Next16.4.3/Vite8.3.5/Cloudflare tooling and compatible patch overrides. npm audit now reports zero advisories. Miniflare5 test adapted with official V4 option converter and explicit resourcePersistencePath; real D1 restart/rollback passes. No production identity bypass or real hardware GPS acquisition was used.

Remaining release work: final integrated verification after UI polish; exact source publication with preserved custom audience; inspect hosted D1 migration; clean source/data/schema archive and fresh extraction/setup/build/HTTP checks. Physical device/field validation, real water clearance and empirical traffic/flood access remain explicit limits rather than fabricated results.

Read-only independent review completed: no critical issues identified, three important defects reproduced and fixed (hidden-history deletion button, explicit note clearing, invitation handoff through sign-in). Added two invitation handoff tests, bringing the suite to93. Type generation now runs before typecheck for clean extractions; generated next-env.d.ts is formatter-ignored to avoid build-induced source drift. Final recheck follows these fixes.

Final compatibility audit restored the optional legacy EVM development proxy lost during framework migration. It remains loopback-only and is not included in the production Worker or core dependency install. A labelled transport fixture checks proxy forwarding; this is not a new blockchain or external timestamp validation.
