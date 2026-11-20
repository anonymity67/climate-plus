# Pollution and GIS extension — 20 October 2026

## Build decisions

The extension has a historical measured-data mode alongside the existing fictional continuity demonstration. It must not present historical data as current warnings or named facilities as proven polluters.

1. **Dhaka pollution screening:** 1,495 repository-published records at 58 named locations, 2017–2021, DOI 10.17632/xftpv7jvx3.1, CC BY 4.0. Repository authenticity and file checksum are verified; laboratory QA/custody provenance remains incomplete. Do not train on the supplied WQI or Pollution_Label.
2. **Explicit objectives:** Bangladesh ECR 2023, Schedule 2(a)(1), fisheries row, Gazette p.3061 / PDF p.53, visually transcribed: pH 6–9; DO >=5 mg/L; BOD <=6 mg/L; nitrate-N 7 mg/L; ammonium-N 0.3 mg/L; phosphate-P 0.5 mg/L; total Cr 0.05 mg/L; Pb 0.1 mg/L; Hg 0.004 mg/L; total coliform <=5,000 CFU/100 mL; TDS 1,000 mg/L; COD 50 mg/L. This implementation initially screens only pH, DO and COD from Dhaka because nutrient chemical forms are unspecified. FC is not interchangeable with total coliform. This is a retrospective screening comparison to 2023 objectives, not a claim about legal compliance in 2017–2021.
3. **Index:** display measured-objective exceedance percentage, 100 × failed valid tests / valid tests, with parameter-level direction/severity, date and coverage. It is an interpretable partial screening indicator, not a validated overall ecological or potability index. A separate correctly implemented CCME calculator refuses insufficient panels; no pooled parameters from different sites/times.
4. **GIS:** map actual Dhaka sampling coordinates. Separately map 40 actual May 2025 velocity-survey coordinates from BASIS v2, DOI 10.17632/bncwnj8yjt.2. Do not equate those numeric survey IDs with the differently named February water-quality stations. OpenStreetMap is optional context with attribution. Lines between surveyed points are survey-order guides, not certified flow paths.
5. **Source investigation:** use the six published BASIS drain/upstream/downstream hydraulic groups for transparent mixing and load calculations. Show flow and load closure errors; retain analytical replicates as replicates. Model possible contribution of the measured drain, not a named industrial source. No evidence in these datasets establishes which factory dumped waste.
6. **Mitigation:** an editable source-concentration reduction scenario shows conditional downstream changes. It is not a demonstrated treatment efficiency. Provide an evidence collection and follow-up sampling workflow, plus separate sewage, industrial and sediment investigation steps grounded in EPA sampling/source-investigation guidance.
7. **ML:** train an actual DO regression model using measured DO as target, excluding WQI, pollution labels and DO from predictors. Chronological train (2017–2019), model selection (first half 2020), calibration (second half 2020) and test (2021). Compare a seasonal baseline and simple models. Export frozen model, held-out metrics and prediction intervals. Browser inference is research screening only; measured inputs drive the pollution indicator.
8. **Input validation:** reject malformed dates, coordinates, units, impossible pH and negative concentrations; missing parameters remain missing. Export a reviewable investigation record with exact input, objective profile, methodology, dataset DOI, hash and evidence limits.

## Acceptance

- Real files downloaded, hashes match the publisher and attribution survives transformation.
- Numeric screening, CCME edge cases and mixing calculations independently checked.
- No label/target leakage, no random row split across dates, no reuse of test for tuning.
- Map markers retain dates and provenance; unlocated samples never receive invented coordinates.
- Hypotheses and treatment scenarios never become confirmed causes or measured mitigation.
- Model abstains outside supported training ranges and keeps uncertainty visible.
- A complete historical observation → screening → investigation → mitigation scenario → evidence export workflow works in the browser.

## Sources

- https://data.mendeley.com/datasets/xftpv7jvx3/1
- https://data.mendeley.com/datasets/bncwnj8yjt/2
- https://www.dpp.gov.bd/upload_file/gazettes/47999_44880.pdf
- https://ccme.ca/en/res/wqimanualen.pdf
- https://www.epa.gov/national-aquatic-resource-surveys/indicators-dissolved-oxygen
- https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=20017KFK.TXT
- https://www.epa.gov/system/files/documents/2025-08/appendix-c-epa-r4-surface-water-sampling-protocol.pdf
- https://www.openstreetmap.org/copyright

Field readiness still requires a responsible local operator, applicable objectives review, instrument/laboratory QA, permissions and prospective validation. A running research tool is not a certified automated enforcement or drinking-water decision system.
