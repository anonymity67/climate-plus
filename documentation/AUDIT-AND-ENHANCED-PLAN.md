# Climate++ — audit and enhanced delivery plan

Prepared 17 October 2026. Release update 21 October: see METHODS-AND-VALIDATION.md, DATASETS.md and SUBMISSION-PACK.md for implemented pollution features and current requirements. The old submission-opening conflict has been removed from the official rules. This replaces the earlier implementation plan where they conflict. The attached brainstorm is source material; its schedules and assertions are not independent authority.

## Executive assessment

The concept has a compelling welfare pathway, but the original plan tried to carry too much infrastructure and too many research promises into an eight-day competition sprint. Its strongest competitive asset is a complete, inspectable operational loop. Its weakest claims were novelty by combining modules, assumed local forecast skill, and blockchain treated as an optional decoration.

**Revised thesis:** Climate++ helps a coastal service operator choose and communicate a feasible response to environmental disruption, then preserve a checkable record of the evidence, decision and execution. The initial demonstration exposes who receives scarce water and who still faces a shortage.

There is no basis for estimating a probability of winning. The changes below improve demonstrability, scientific defensibility and clarity against the published rubric.

## Audit findings and changes

| Finding | Risk to the entry | Enhancement and proof |
|---|---|---|
| Five concepts could read as five disconnected dashboards | Judges cannot identify the product | Three hazard scenarios share one response workflow; agriculture and advanced sampling are separately gated follow-on MVPs |
| The climate model was weakly connected to the decision | AI becomes a badge rather than evidence | Run a real historical experiment; disclose skill against climatology; use climate context only for preparedness |
| ENSO framing invited overclaiming | Seasonal association could be mistaken for a local event forecast | Separate weather warnings, local observations and seasonal climate; never generate a storm or salinity alert from RONI |
| Benefits could be created by unequal baseline resources | Impressive but invalid improvement figures | Same starting stock, inflows, demand, delivery size, cost and windows; report closing stock and an allocation-only ablation |
| Fairness objective hid losers | A welfare claim could conceal a distributional trade-off | Show every catchment, school coverage, total unmet demand and editable priority floor |
| Blockchain was optional and vague | Weak fit to environmental verification | Working Solidity registry, local EVM transactions, linked corrections, duplicate rejection and a visible tamper test |
| A chain receipt could imply a true observation | Hash integrity is not field truth | Explicit trust ladder: synthetic → entered → confirmed → measured → independently verified; hashing does not advance a record on that ladder |
| Fake urgency could weaken trust | Demo warnings might be mistaken for public advice | Persistent scenario banner, fictional assets and no current-alert claims |
| The stack was larger than the first workflow | Deployment and integration would consume the sprint | Portable React application with shared JS engine; optional local EVM service; production persistence comes after workflow validation |
| The video was a feature tour | Judges remember no decision or result | One operator, one shortage, one fairer response, one tamper failure, one realistic pilot ask |
| National scaling was an aspiration | No repeatable adoption unit | Define one operator cluster as the replication unit; add training, data contracts, support and local governance gates |
| Submission dates conflict | A good entry may miss a valid submission window | Prepare everything by October 24; ask organizers to reconcile the official opening/deadline wording |

## Product architecture and actual scope

### What the present demonstration does

The seven-day simulation treats the three service points as a **pooled usable-water ledger**, not a calibrated pipe network. Pump or pond restrictions change the supplied scenario's eligible inflow. It has no hydraulic pressure model, real transport routing, source-specific transfer constraints, or measured delivery reliability. These simplifications are explicit.

The engine enumerates up to 128 possible one-refill-per-day schedules. Each refill provides 2,000 L for an illustrative BDT 800. A lexicographic comparison first protects a configurable school daily floor, then the minimum household demand fraction, then total shortage, then cost. Household allocation is proportional within a day after the critical floor. This is a transparent policy prototype, not proof that these priorities represent community consent.

Inspection uses a small finite job catalogue and a three-hour crew budget. A completed task is an operator entry. It does not automatically change source eligibility, create water, or prove repair success.

The interface supports scenario selection, budget/demand/priority controls, baseline comparisons, plan confirmation, demonstration task completion, Bangla/English printable notices, receipt export, tamper verification and local-chain anchoring. Browser state resets on reload. There is no authenticated field deployment, durable shared record system, actual dispatch, SMS service, live warning integration, or public testnet transaction in this release.

### Trust architecture

1. Canonical JSON makes the same record hash identically regardless of key order.
2. SHA-256 covers inputs, options, engine version, plan, confirmation and demo task entries.
3. A Solidity registry records digest, submitting address, timestamp and optional predecessor.
4. Duplicate digests and invalid correction ancestry are rejected.
5. Local test-chain results are clearly labelled; no personal data are placed on-chain.
6. Future independent verification requires an organizational verifier, measurement method and custody trail, not merely a second software account.

### Climate experiment: the result changes the pitch

The initial experiment uses NASA POWER monthly precipitation for an illustrative Dacope-area point and NOAA's historical RONI table. The target is a next-month rainfall total at or below the calendar-month training 20th percentile. Training is 1984–2010, validation 2011–2018 and testing 2019–2025. Validation chooses regularization; the test period is not used for tuning.

On the 84 test months, Brier loss was approximately **0.1149 for calendar-month climatology**, **0.1139 for rainfall-only logistic regression**, and **0.1154 with lagged RONI**. Lower is better. The RONI addition did not improve this metric. AUC gives a different aspect of discrimination; it does not overturn the lack of probability-score improvement.

**Pitch consequence:** do not claim superior ENSO-powered local prediction. Present the experiment as evidence discipline: the system can consume climate context, but its operational value is evaluated separately. The dataset is modern revised historical data, so this is retrospective reconstruction, not an as-issued forecast validation. Raw downloads and hashes are retained for reproduction.

### Operational evidence

The benchmark runs 36 combinations of hazard, budget and demand across four policies (144 runs). It is a sensitivity grid, not 144 independent real-world trials. The policies are fixed refills, stock-threshold refill, optimized schedule with first-arrival allocation, and the fair response.

For the default salinity case at BDT 2,400 and demand multiplier 1.0:

| Outcome | Stock-threshold / first-arrival | Climate++ |
|---|---:|---:|
| East household coverage | 81.0% | 70.6% |
| West household coverage | 67.9% | 70.6% |
| School coverage | 57.1% | 91.4% |
| Water served | 11,800 L | 11,800 L |
| Unmet demand | 4,300 L | 4,300 L |
| Cost | BDT 2,400 | BDT 2,400 |
| Closing stock | 0 L | 0 L |

The benefit here is a disclosed redistribution, not new water or total shortage reduction. East loses coverage to protect the school and improve the worst household outcome. This should be shown, not hidden in an average. Real acceptance of that trade-off requires local consultation.

## Competitive position and business model

### First customer and job

Target an NGO or professional operator responsible for a cluster of community water points in coastal Bangladesh. Its immediate job is to reconcile stock, arrange scarce replenishment, coordinate maintenance and tell residents what can actually be delivered. The resident is the beneficiary; the institutional operator or funder is the payment candidate.

| Comparator | What it already establishes | Proposed hypothesis to test |
|---|---|---|
| SafePani | Professional rural service delivery and performance-linked financing | A constrained continuity module may complement service management, but must prove incremental workflow value |
| mWater | Data collection, asset records and operational dashboards | Import/export and focused response planning may be more useful than replacing the data platform |
| Drinkwell | Treatment, dispensing and operating experience | Cross-source service continuity may complement installed infrastructure |
| Waterplan | Industrial water risk and mitigation workflows | Small community operators have different affordability, usability and service responsibilities |
| DPHE systems | Existing institutional water-data and management tools | Use authorized interfaces and consistent identifiers; portal availability does not imply public data access |

The defensible asset to build is a locally tested operating workflow and a record of decision performance across operators. There is no world-first or patentability claim.

### Revenue hypotheses to validate

- Institutional onboarding, support and annual service subscription at cluster level.
- NGO-supported deployment where direct operator margins cannot fund software.
- Later evidence reporting for funders, with independent verification costs separately budgeted.

Avoid resident subscriptions, charging for warnings, speculative token economics or automatic payouts from unverified reports. Financial estimates must include field visits, training, support, tests, repair capacity, replacement reserves and delayed institutional payments. Software hosting is only one cost.

### A lean discovery and pilot sequence

1. Interview five operators, three institutional buyers and five residents or collection volunteers. This is exploratory discovery, not representative population research.
2. Observe the actual scheduling and communication workflow at one consenting site; document the baseline and available records.
3. Obtain a named operating counterpart, access permission, safety responsibility and data agreement.
4. Run two weeks of shadow decisions without directing actual water service. Compare recommendations with what operators could execute.
5. Only after reconciliation and usability gates, test an operator-approved workflow over four to six weeks. Report seasonality and small-sample limitations; no causal health claims.

Measure stock error, unmet essential demand, interruption duration, failed trips, collection time, task completion, operator workload, household expense and distribution across catchments. Keep prototype metrics separate from prospective pilot goals.

## Expansion with explicit gates

| Stage | Product | Gate before expanding |
|---|---|---|
| Coastal proof | One operator cluster, three hazards, continuity and inspections | Operator uses the workflow repeatedly; input burden is manageable; recommendations are executable |
| District replication | Multiple operators, role-based access, durable history, offline sync and data exports | Repeated onboarding works without bespoke engineering; support and unit economics documented |
| National partnership | Institutionally governed deployment templates, local-language support, audit governance | Procurement pathway, data permissions, support capacity and independent evaluation |
| Livelihood modules | Irrigation scheduling and environmental sampling as separate validated services | Agronomist / laboratory workflow, appropriate data and measured decision value |
| International pilots | Adapt to one partner-led geography at a time | Local hazard calibration, language, policy, affordability and operating responsibilities |

## Delivery process and release gates

Assign five workstreams, combining roles for smaller teams: domain/product and interviews; decision engine and evaluation; interface and integration; trust/security and reproducibility; narrative/video and submission. Keep one shared claim ledger. Every public numerical claim must point to a data artifact and a method.

Daily review: demonstrate one end-to-end behavior, run its meaningful tests, record one uncertainty and the next action to resolve it. Do not add a feature unless it improves a rubric criterion and has a feasible proof method.

### Before October 24 freeze

- Complete three scenario workflows and show an infeasible case.
- Reproduce the benchmark and climate experiment without editing test-period results.
- Verify canonical receipt and actual local EVM transaction; explain public-testnet status accurately.
- Check desktop, narrow viewport, keyboard navigation, Bangla and print notice.
- Render and inspect a 3–5-minute video using actual product captures and computed outputs.
- Finish public-ready README, source licensing inventory, source register, assistance disclosure and submission text.
- Record all unresolved limitations, including simulated infrastructure, one pooled ledger, no field validation and no production authentication.

### Competition entry gate

Confirm the team's eligibility and organizer-approved submission window; choose repository/video accounts and make the required links accessible to judges. A private preview is not a substitute for judge access. No credentials, field personal data or unlicensed assets may be included in the public package.

## Sources checked

- IEEE overview and rubric: https://ieee-climatechain-hack.devpost.com/
- IEEE rules and conflicting submission timing: https://ieee-climatechain-hack.devpost.com/rules
- NASA POWER monthly API: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- NOAA RONI methodology and revisions: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/
- REACH datasets: https://reachwater.uk/datasets/
- SafePani service model: https://reachwater.uk/resource/the-safepani-model-delivering-safe-drinking-water-in-schools-and-healthcare-centres-in-bangladesh/
- WHO sanitary inspection packages: https://www.who.int/publications/i/item/9789240089006
- mWater: https://www.mwater.co/
- Waterplan YC profile: https://www.ycombinator.com/companies/waterplan
- MIT Solve climate challenge: https://solve.mit.edu/index.php/challenges/2027-global-climate-challenge
- MIT Climate & Energy Prize rubric: https://cep.mit.edu/judging-criteria
- Imagine H2O: https://www.imagineh2o.org/apply/

External pages can change. Preserve retrieval dates in a final submission evidence bundle; organizer clarification remains pending.
