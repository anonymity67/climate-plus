# Methods and validation

Release review: 21 October 2026. This document describes implemented behavior, not an intended future system. The raw source files, trained model, predictions and evidence manifest accompany the source package.

## 1. What “validated” means here

Four different checks have been completed: publisher file-integrity checks, input and transformation checks, numerical/software tests, and retrospective model evaluation. None establishes original laboratory accuracy, present-day river conditions, prospective operational effectiveness or regulatory acceptance. Those require independent field work.

The product has two distinct evidence domains. Water-continuity inputs are explicitly synthetic. The pollution/GIS domain contains repository-published historical measurements with incomplete original laboratory QA documentation. Their provenance is visible in the interface and exports.

## 2. Pollution screening

The implemented indicator is the **objective exceedance percentage**:

`index = 100 × number of failed valid tests / number of valid tests`

It is a partial screening statistic. Higher values mean more of the tested parameters fail the selected objectives. It is not a newly validated ecological-risk scale, a disease-risk probability or a drinking-water safety classification. It is deliberately accompanied by the underlying values, objective directions and coverage.

The default profile uses the fisheries row of Bangladesh ECR 2023, Schedule 2(a)(1): pH between 6 and 9 inclusive; DO at least 5 mg/L; COD at most 50 mg/L. The table was checked visually in the official Gazette on PDF page 53 (printed page 3061). A local copy and page rendering are retained. Because the observations predate 2023, the output is a retrospective screening comparison, not a legal finding about compliance at the observation date.

Only these three of the twelve listed parameters are compared. Nitrate and phosphate chemical forms are unspecified in the Dhaka CSV, so values are not silently compared to nitrate-N or phosphate-P objectives. Fecal coliform is not substituted for total coliform. Microbes, metals and other unmeasured hazards remain evidence gaps.

Negative measurements, missing values and impossible pH values do not count as passing tests. A 0/100 score means none of the available tests failed; it does not mean the water is clean. With no valid tests, the score is unavailable.

Example: pH 7, DO 0.22 mg/L and COD 80 mg/L yield two failures out of three, or 66.67/100. The DO failure is below a minimum; the COD failure is above a maximum.

## 3. CCME utility and eligibility

The source library also implements the CCME scope, frequency and amplitude calculation. It requires one declared assessment site, valid calendar dates and at least four parameters each observed on four distinct dates. Analytical replicates on a single date cannot satisfy that sampling gate. A limited campaign meeting that historical minimum is not represented as a full annual assessment; CCME's 2017 guidance recommends larger panels and sampling effort.

For V parameters and N valid tests, F1 is 100 times the fraction of parameters failing at least once. F2 is 100 times the fraction of individual tests failing. An upper-bound excursion is x/O−1; a lower-bound excursion is O/x−1. Passing tests have zero excursion. F3 is 100nse/(1+nse), where nse is the sum of excursions divided by N. The score is 100−sqrt((F1²+F2²+F3²)/3).

A zero value below a positive minimum is handled as an unbounded excursion, giving the limiting F3=100; no arbitrary epsilon is inserted. This is covered by tests. The default three-parameter Dhaka panel is ineligible, so the UI withholds a standard CCME score.

## 4. Source investigation and mitigation scenarios

The source module uses six published BASIS groups with drain, upstream and downstream flow and fecal-coliform means. Its steady, well-mixed short-reach model is:

`predicted downstream C = (Q upstream × C upstream + Q drain × C drain) / (Q upstream + Q drain)`

Flow closure compares observed downstream Q with the sum of measured inflows. Load closure compares observed downstream Q×C with the sum of incoming Q×C. A default 20% diagnostic tolerance is editable and explicitly identified as an analyst setting, not a validated regulatory threshold.

Published FC means are multiplied by 100,000 according to the dataset's units. The calculation uses concentration and flow consistently. If a load in CFU/s is needed, Q in m³/s multiplied by C in CFU/100 mL additionally requires a factor of 10,000. The UI's contribution fraction and closure ratios cancel that common unit factor; it does not mislabel raw Q×C as CFU/s.

A source-reduction slider changes only the assumed drain concentration, holding flow and upstream conditions constant. This shows a conditional outcome, not a measured removal efficiency. A drain's share of measured incoming load is not its share of all pollution in the river. Unmeasured inflows, non-steady flow, decay, settling, sorption, tidal reversal and incomplete mixing can invalidate the interpretation.

Industrial investigations can enter their own paired measurements using a declared pollutant and consistent units. The same arithmetic applies only when its assumptions are appropriate. Neither a map location, a COD result nor fecal contamination identifies a named factory. Attribution requires authorized drainage tracing, relevant chemical/microbial evidence, operating records and responsible review.

## 5. Dissolved-oxygen model

### Target and predictors

The target is recorded DO in mg/L. Predictors are temperature, pH, COD, log(1+turbidity), rainfall and sine/cosine of calendar month. DO itself, supplied WQI, Pollution_Label and station identity are excluded from predictors. This is contemporaneous estimation when a DO measurement is unavailable, not forecasting next week's water quality.

The CSV has 1,495 records. Six records contain invalid negative numeric values relevant to model inputs; those values are excluded from screening and the six records are excluded from model fitting/evaluation. Raw data remain unchanged.

### Chronological design

| Stage | Period | Records | Use |
|---|---|---:|---|
| Training | 2017–2019 | 1,061 | Fit candidate models and preprocessing |
| Selection | Jan–Jun 2020 | 80 | Select by mean absolute error |
| Calibration | Jul–Dec 2020 | 174 | Estimate residual interval radius |
| Test | Available 2021 records | 174 | Evaluate the frozen choice |

Candidates are standardized ridge regression with alpha 1, 10 and 100, and random forests with 60 trees, maximum depth 4 or 6, minimum leaf size 8, random seed 17. The chosen model is the depth-6 forest. The baseline is the training-period median DO for each calendar month. No model was retuned after examining the test outputs.

### Held-out results

| Metric | Trained model | Monthly-median baseline |
|---|---:|---:|
| MAE, mg/L | 1.159 | 1.548 |
| RMSE, mg/L | 1.953 | 2.729 |
| R² | 0.524 | 0.070 |
| Mean prediction bias, mg/L | −0.512 | −1.002 |

An absolute residual quantile from the calibration period produces an approximate 90% interval with radius **3.178 mg/L**. Actual test coverage is **92.5%**. These wide intervals and the negative bias limit decision use. Temporal dependence and distribution shift mean nominal coverage is not guaranteed prospectively.

Three test records fall outside the numerical training range. The browser abstains on those inputs. Among the 171 supported test records, model MAE is 1.151 mg/L versus 1.507 mg/L for the baseline. Tests confirm that every supported browser prediction matches the frozen Python prediction within 0.000001 mg/L. The JavaScript evaluator reproduces scikit-learn's float32 tree-branch behavior.

### Dependence and leakage checks

There are 104 observation dates in the complete CSV and nine dates in three campaign months in the 2021 test set. There are no duplicated station/date records and no exact full-measurement vectors repeated from training into test. Stations may recur across years, so this is temporal validation at familiar sampled locations, not unseen-basin validation.

An exploratory 2,000-replicate bootstrap resampling whole test dates gives a 95% percentile interval of approximately **0.096–0.668 mg/L** for baseline MAE minus model MAE. Only nine dates are available and campaign dependence can remain, so this is descriptive sensitivity evidence, not proof of prospective superiority. Individual test predictions, per-date errors and the bootstrap settings are exported.

## 6. Climate experiment

A separate experiment uses NASA POWER monthly precipitation at an illustrative Dacope-area grid point and NOAA's historical RONI table. Monthly mean daily precipitation is converted to monthly totals using calendar day counts. Low rainfall is defined using the training calendar-month 20th percentile.

Training is 1984–2010, selection is 2011–2018 and testing is 2019–2025. Features use seasonal sine/cosine, preceding rainfall totals and lagged RONI. The RONI center month is target month minus three; the contributing season ends before the target period. Revised historical inputs mean the result remains retrospective reconstruction, not an as-issued hindcast.

On 84 test months, Brier loss is approximately 0.1149 for calendar-month climatology, 0.1139 for rainfall-only logistic regression and 0.1154 with RONI. Lower is better. Adding RONI did not improve this score. No superior ENSO-based local forecast claim is made, and this model does not determine source clearance or next-day tank stock.

## 7. Continuity engine and benchmark

The demonstration treats usable supply as one pooled ledger with capacity 10,000 L. It is not a pressure-dependent pipe model. Scenario restrictions change eligible inflow. Each candidate refill supplies 2,000 L at an illustrative BDT 800, with no more than one refill per day. The engine enumerates up to 128 seven-day schedules and obeys entered budget and blocked delivery windows.

The objectives are sequential: minimize the configured critical-service shortfall; minimize worst household proportional shortfall; minimize total shortfall; then minimize cost. Daily household allocation is proportional after the school floor. Priorities are demonstration assumptions requiring community and operator agreement in a pilot.

The 144-run benchmark covers three hazards, four budgets, three demand multipliers and four policies. A same-schedule/first-arrival ablation distinguishes allocation effects from scheduling. Policies share starting stock, inflows, demand, refill capacity and cost constraints. Closing stock and spill are disclosed. Inputs are known scenario values; there is no claim of operational forecast accuracy.

In the default salinity case, the reference and fair response both supply 11,800 L, spend BDT 2,400 and end with zero stock. School coverage changes from 57.1% to 91.4%; the worst household coverage changes from 67.9% to 70.6%. East-catchment coverage falls from 81.0% to 70.6%. Total unmet demand remains 4,300 L. This is a disclosed redistribution, not total water savings.

## 8. Software assurance and trust boundaries

Twenty-five automated tests cover accounting, capacities, budget limits, objective priority, infeasibility, zero demand, invalid input, exhaustive schedule comparison, inspection constraints, receipt tampering, EVM duplicates and correction links, notice expiry, CCME edge cases, model parity, source transformations and mixing calculations. Desktop and narrow-screen browser workflows were also exercised.

The cryptographic receipt commits to canonical JSON using SHA-256. Local EVM registration records a digest, address, timestamp and optional predecessor. It is a development chain, not a public immutable deployment. A self-contained file can be rehashed by its editor; meaningful adversarial verification needs a separately trusted digest, signature or registry. Neither hashing nor blockchain establishes laboratory truth.

The evidence manifest covers exact files, sizes and hashes. It detects changes relative to that reference. It does not constitute external certification. The source package includes reproducible commands and the limits above so reviewers can inspect the basis of each claim.
