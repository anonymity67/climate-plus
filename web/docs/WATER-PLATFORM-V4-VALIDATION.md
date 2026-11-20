# V4 verification report

Release: 4.0.0 · 17 November 2026. This report concerns executable software and source-data integrity. It does not authenticate field samples or establish environmental/health outcomes.

## Verified in the current source

| Evidence                               | Result and scope                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                        | Passed formatting, route type generation/TypeScript, **136 Node tests**, production Worker build and frozen-data verification                                                                                                                                                                                                     |
| `python tests/regions-builder.test.py` | **2 tests passed**: independent regional reproduction and no interpolation/connection across an external vertex                                                                                                                                                                                                                   |
| `npm run verify:data`                  | **97 frozen files checked, zero failures**; **15 registered dataset/reference sources**                                                                                                                                                                                                                                           |
| Channel topology tests                 | Crossing without a shared OSM node stays disconnected; shared internal node connects; every shipped component independently traversed; six backend/public derived files reproduce byte-for-byte                                                                                                                                   |
| New HTTP smoke                         | **19 assertions passed** against the compiled Worker through the loopback preview: public data, encoded IDs, bounds/pagination, all three stream regions, dated original chemistry, volume conservation, same-origin enforcement, sign-in, spoofed-header rejection, persistent checks, safe retries, creation audit and sign-out |
| Retained operations HTTP smoke         | Passed **6 suites** covering actual D1 adapter, five-region server plans, closures/alternatives, single-use scoped invitations, two separate actors, fixture telemetry/deletion, replay labels, immutable observations, case revisions and owner-only export                                                                      |
| Persistence/restart                    | File-backed SQLite migrations and reopen verified; HTTP records re-read after preview restart; browser-created measurement and follow-up case reloaded and updated                                                                                                                                                                |
| Core production dependencies           | `npm audit --omit=dev`: **zero known advisories** at verification time. Next.js updated to 16.4.6 after the audit found the prior version affected by GHSA-mfr8-8qww-v76h. This claim excludes the optional legacy local-chain tool and dev-only dependencies.                                                                    |

Machine-readable reports, complete check output and screenshots are in `verification/`. The fresh-extraction report is adjacent to the final ZIP so the sealed archive need not hash a report generated after itself.

## Browser work, using the compiled application

- Desktop 1440×1000: source search, source attribution/coordinates, channel geometry, selected historical Tongi record and full history, supply calculation and retained response entry.
- Phone 390×844: Find water, Check rivers and Plan supply; measured document width **382px**, with no horizontal page overflow. The location action no longer squeezes the form columns. Tables retain an explicit horizontal scroll container.
- Sign-in, recovered draft and save acknowledgement; original-coordinate private measurement map; follow-up case creation, status/note update and re-read after normal page reload.
- Explicit local sign-out in another tab simulated session expiry. Submitting from the previously signed-in form produced a readable sign-in message rather than leaving the form stuck in Saving. The error handler accepts both an array of validation errors and an object containing sign-in details.
- Kaggle context: **2,593** original-coordinate context rows within the Dhaka snapshot bounds, explicitly unverified, with a 300-point drawing cap and complete selector/export. Context labels never propagate over the channel network.
- Sylhet: **40** rows in the separate velocity-only survey table. Switching map area replaces the Dhaka quality inspector with area-specific evidence-gap text; it does not display Tongi chemistry as Sylhet measurements.
- Keyboard navigation and submission were exercised. Native date entry was checked; the CUA fill helper needed native date-control input in this Windows browser, so UI state was verified rather than assuming the fill command succeeded.

No physical GPS hardware/background tracking test, emergency drill, accessibility study with disabled participants, authenticated hosted CRUD test or field pilot was performed. Earlier framework development errors while rebuilding a watched Worker are not treated as a running deployment: the built runtime was stopped/restarted and the complete HTTP smoke rerun against the final build.

## Review findings resolved

Independent backend and spec reviews checked the new modules. Four concrete issues were fixed and rechecked: late-loading site coordinates now recenter the map; measurement/import/case saves use owner-scoped retry keys; cases retain the saved measurement identity/title rather than an edited draft; source checks and audit creation are transactional. Additional browser findings fixed explicit sign-in navigation, the authentication-error shape, legacy navigation direction, mobile field squeezing and stale regional inspector content. These fixes were followed by the final check/build and HTTP smoke.

## Data facts and limits

The source catalogue groups the 1,495 Dhaka records into **62 river/location/coordinate groups**. **60** associate with a mapped channel within the declared 750m threshold; **2** remain unmatched. These numbers are not BASIS station counts. Source coordinates remain unchanged, including unmatched records. Association is not proof of hydraulic identity or contamination spread.

New OSM snapshots contain **4,883 channel ways**: 2,431 Dhaka, 293 Sylhet and 2,159 Dacope. Dates, query bounds, raw response, licences and SHA-256 are retained. Current quality/flow/access are not verified. The WPdx inventory contains 20,084 records assessed 2014–2019; a record is not a current safe supply. Invalid source chemistry remains in the archive but cannot become a passing test. The rainwater model conserves entered volumes and discloses timing/loss/storage assumptions; it does not forecast rainfall, establish groundwater sustainability or clear water for drinking.

## Handoff and publication

The source ZIP is built with `scripts/package-handoff.py`, excludes credentials/private runtime databases/dependencies/builds, and includes all source scripts, migrations, original datasets, derived data, licences, methods and verification evidence. A fresh extraction is checked with manifest verification, `npm ci`, blank-database migrations, types/tests/build, data hashes and real HTTP smoke. Read the adjacent `ClimatePlus-Water-Platform-v4-archive-checks.json` for the actual result.

**The existing hosted Site is not updated.** The original project ID returns `Sites project not found` through the current Sites connection, including a final recheck. The accessible Climate++ Development Playbook is a separate project and was not overwritten. The original Site ID/audience are preserved. Publishing this release requires restored access to the original hosting project; the loopback test-identity adapter is deliberately not a production identity provider.
