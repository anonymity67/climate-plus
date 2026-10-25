# Collaborator handoff audit — 22 October 2026

This audit concerns the standalone collaborator kit, version 0.2.0. The original source checkout and earlier hosted release were preserved. The handoff is an editable research prototype for further development; it is not a claim of production or field certification.

## Changes made for the handoff

| Finding                                                                                                    | Change and evidence                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source JSX/CSS and numerical scripts were difficult to navigate                                            | Formatted JS/JSX/CSS/configuration with Prettier and Python with Ruff; production build and numerical reproduction retained                                      |
| Development-history scripts and outer-workspace assumptions could confuse a collaborator                   | Included only active build/research/verification scripts; kept all required inputs inside the project; supplied VS Code workspace/tasks/debug configuration      |
| Core installation inherited optional EVM advisories                                                        | Moved ethers/Ganache/Solidity tooling and registry test into separately installed `tools/local-chain`; core npm audit reports zero vulnerabilities at audit time |
| Mixing accepted invalid tolerance fractions and overflowing load products                                  | Added explicit numeric/range/overflow guards; new regressions failed before the fix and passed after it                                                          |
| CCME objective bounds could be reversed                                                                    | Reject reversed bounds explicitly; demonstrated failing/passing regression                                                                                       |
| Planner could throw an incidental TypeError for malformed arrays and accept non-finite delivery quantities | Added shape, finite-value and blocked-day validation; regression tests                                                                                           |
| Inspection jobs could contain negative hours or NaN priority                                               | Reject malformed jobs before enumeration; regression tests                                                                                                       |
| A map point without valid screening data appeared green                                                    | Separate gray missing-data classification; regression test                                                                                                       |
| Velocity layer displayed a pollution legend                                                                | Dedicated survey legend and color, confirmed in browser                                                                                                          |
| Selecting a station reset an analyst's zoom/pan                                                            | Separated extent changes from selection changes; selected another station after zooming and visually confirmed the same map extent                               |
| Reset did not reset pollution-panel session state                                                          | Remount the panel on reset; browser check confirmed imported observation cleared                                                                                 |
| Import while viewing the survey layer hid the new observation                                              | Successful import selects the quality layer; reproduced the original behavior, then verified one visible imported point and its 2/3 exceedance result            |
| Existing release manifest would not describe reformatted/refactored files                                  | Retained it as historical provenance and created separate data and complete handoff manifests                                                                    |
| An unused font filename suggested WOFF2 although bytes were TTF                                            | Omitted unused duplicate; retained the actual TTF, source and OFL notice                                                                                         |

## Verification scope

- Core suite: **33 tests**, covering water conservation, schedule optimality within the seven-day catalogue, access/budget constraints, notices, input rejection, screening, CCME minimum-panel rules, mixing, receipt tampering and documented input examples.
- Browser/Python parity: all **171 supported held-out DO predictions** agree within `1e-6`; the three out-of-range test inputs abstain.
- Frozen assets: **17** raw/derived/reference/font assets checked against hashes; all five source-register entries agree with the raw-file hashes.
- Production bundle compiled successfully with Vite 6.4.4. Prettier check passed. Python scripts compiled, and the isolated numerical reproduction matched at `1e-9`.
- Browser checks on the production preview: continuity calculation (70.6%/70.6%/91.4% coverage for the default planned response); quality and survey layers/legends; invalid calendar-date rejection; explicit-unit import; import while survey selected; partial screening; reset; missing-predictor abstention; paired-input import (18.18 mg/L baseline and 13.64 mg/L conditional scenario at 50% source reduction, displayed rounded); station selection after zoom. `verification/pollution-gis.png` records the verified map view.
- Optional contract test passed: author, duplicate/zero digest rejection and correction linking. API smoke check confirmed chain 1337, successful anchor, matching digest/transaction hash, duplicate rejection (HTTP 400) and foreign-origin rejection (403).
- Dependency audits are retained under `verification/`. A clean archive extraction receives its own installation, build, test and integrity checks; see the accompanying verification record and archive report for exact command output.

The recorded numerical reproduction compares scientific/content fields rather than timestamps or environment strings. The complete handoff manifest is sealed after the audit records are collected. The ZIP has a separate SHA-256 sidecar.

## Remaining limitations and follow-up work

**Optional EVM:** 38 npm advisories remain in its separate dependency tree: 1 low, 8 moderate, 24 high and 5 critical. The audit command exits nonzero for that reason; this is disclosed, not claimed as a clean audit. Node 24 emits a µWS native-binary compatibility warning and uses the tested JavaScript fallback. Keep this service on loopback for demonstration only. It is not included in the core installation and must be replaced or remediated before any public service.

**Scientific:** raw datasets and metadata are publisher snapshots, not independently authenticated field/laboratory results. The indicator covers at most three fisheries parameters and is not a potable-water or overall ecological score. Historical measurements are not current alerts. The DO holdout is clustered on nine dates in familiar locations; prospective/unseen-basin validity is unestablished. Mixing assumes steady, well-mixed flow and lacks verified factory/drainage attribution. These limitations remain visible in the UI and methods.

**Engineering:** no central persistence, authentication, production ingestion, signed laboratory custody, live telemetry, dispatch or SMS is supplied. Basemap access depends on the tile provider. Build success, unit tests and sampled browser workflows do not establish the absence of every possible defect. Scaling recommendations are proposed next steps, not completed infrastructure.

**Rights:** dataset and dependency licenses remain separate. No overall source-code license was invented. Select one before public release; keep attribution and raw provenance during private collaboration.
