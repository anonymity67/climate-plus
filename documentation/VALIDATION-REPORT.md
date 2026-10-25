# Final validation report

Final release verification: 22 October 2026. Video work is deferred at the user's request.

## Completed checks

- **25 automated tests passed**, zero failures, in the final source run. The test log is included in the release evidence.
- **Production build passed** with Vite 6.4.4. The built application includes Pollution & GIS and the latest input/provenance fixes.
- Both pinned water-data files matched their publisher SHA-256 checksums before transformation.
- Independent numerical checks covered water conservation, budgets, storage, exhaustive schedule comparison, screening, CCME boundary cases and mixing/closure behavior.
- Browser inference matched Python predictions for all 171 supported held-out DO test records within 0.000001 mg/L. Three other test records are outside numerical training ranges and trigger abstention.
- An isolated reproduction reran water normalization/model evaluation, the climate experiment and 144 operational policy runs without overwriting the release inputs or manifest. Numerical outputs matched at tolerance 0.000000001.
- Desktop and narrow-screen browser workflows were exercised: scenario calculation, comparisons, confirmation, Bangla notice, hash verification, a local EVM transaction, tamper failure, pollution map, source diagnostics, model abstention and observation validation.
- Malformed label objects were rejected. An imported sample with missing DO retained missing-measurement advice and user-supplied attribution, including after clicking its map marker.
- Notice validity rejects invalid/future confirmations and expires at 24 hours. Confirmation uses one timestamp to avoid transient future-date discrepancies.
- The 12-slide PPTX passed package integrity, layout, font, native-table and native-chart/workbook checks and first-party import. Slides were rendered for visual review. Native Microsoft PowerPoint execution was not tested.
- The cost workbook recalculated its base result and a zero-contribution case, showed no formula errors in the inspected range and was rendered for both sheets. Its figures are editable assumptions, not market evidence.
- The evidence dossier was rendered and reviewed for readable layout and tables. Its editable source is the Markdown documentation.

## Review findings resolved

1. Restricted supply paths were visually distinguished and demand labels follow the multiplier.
2. The mobile schematic was replaced with a readable service list.
3. Notice expiry became an enforced state.
4. Imported labels are type-checked; missing DO cannot trigger low-oxygen advice.
5. User observations retain user provenance through map interactions and exports.
6. CCME refuses unrelated-site pooling and impossible dates.
7. Float32 tree routing was reproduced in JavaScript for exact inference parity.
8. Reproduction preserves the shipped manifest and runs in an isolated folder.

## Remaining limitations

Original laboratory QA/custody, current environmental conditions, prospective field effectiveness, willingness to pay and regulatory acceptance are not established. The DO model was tested on familiar sampled locations and temporally clustered data. Source mixing is conditional and does not identify a factory. The continuity network is a pooled synthetic ledger. The blockchain is local development only. Production authentication, central persistence, actual dispatch, SMS and automatic source clearance are outside this release.

The optional OpenStreetMap basemap depends on network availability. Local EVM anchoring needs the companion process; the static hosted product does not run that process. Receipt integrity must be checked against a separately trusted reference to resist replacement of both content and digest.

The generated video is not complete and is not included. No competition submission or external outreach has been made.
