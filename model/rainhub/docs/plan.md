# Rainwater Hub Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a region-agnostic R pipeline that uses Bayesian spatial models (R-INLA SPDE) to find clean, rain-rich hubs and allocate their water to nearby low-access areas, first on synthetic data with known truth, then on real data through the same interfaces.

**Architecture:** Five stages read and write plain files in `data/` and `outputs/`: (1) data (synthetic or real adapter) -> (2) two INLA SPDE models giving grid surfaces of rainfall and P(clean) with uncertainty -> (3) tank-reliability simulation per hub candidate -> (4) hub selection and hub-to-area allocation -> (5) map, network diagram and report. Synthetic data is generated from known hidden surfaces so the models can be checked against the truth.

**Tech Stack:** R >= 4.3, R-INLA, sf, terra, dplyr, ggplot2, igraph, ggraph, testthat, yaml. Runs on the team's computer (R-INLA is not on CRAN).

**Spec:** Design doc "Climate++ for Xylem: design for a Bayesian water-access system" (https://claude.ai/artifact/B4Hy1sjQ2p3iYdcAAf1K1T), sections Bayesian core item 5, Datasets, Human slots.

## Global Constraints

- Region-agnostic: no region name or coordinates hard-coded outside `config.yml`.
- Synthetic data must be labelled "synthetic" in every output title, file name prefix `synthetic_`, and report header.
- Never state water is safe when evidence is thin: outputs use P(clean) with uncertainty and the label "unknown" when the 95% interval spans the threshold.
- Hub reliability target default 0.90; safety threshold default P(clean) >= 0.80 with interval width <= 0.30. Both live in `config.yml`.
- Every number in a report traces to a data file or a labelled assumption.
- Deadline: submission 20 Nov 2026, 21:00 UTC.

## Review Focus

- Too few test points (under 10): the pollution model must fall back to the Beta-Binomial per-station estimate and say so.
- Zero-rain or all-rain stations: the rainfall model must not crash or return NaN.
- No cell qualifies as a hub: the pipeline must output "no safe hub found" and the fallback actions, not an empty map.
- A demand area with no reachable hub: it must appear as "unserved" in the diagram.
- Real data with missing values or different column names: the adapter must fail with a message naming the missing column.

---

## File Structure

```
config.yml                  region box, thresholds, grid size, seed
R/00_utils.R                load_config(), make_grid()
R/01_synthetic.R            generate_synthetic()
R/02_beta_binomial.R        beta_binomial_update()
R/03_rain_model.R           fit_rain_surface()
R/04_clean_model.R          fit_clean_surface()
R/05_tank.R                 tank_reliability(), min_tank_size()
R/06_hubs.R                 select_hubs(), allocate_supply()
R/07_outputs.R              plot_map(), plot_supply_network(), write_report()
R/08_real_adapter.R         load_real_data()
run_all.R                   runs stages 1-5 end to end
tests/testthat/test_*.R     one test file per R/ file
data/                       synthetic_*.csv (generated), real_*.csv (user supplied)
outputs/                    maps, diagram, report
```

Shared data frames (columns exact):
- `rain_obs`: `station_id, x, y, month, rain_mm` (monthly total, wet season focus), plus `wet_days` (count of days > 1 mm) and `days` (days in month)
- `quality_obs`: `site_id, x, y, tests, passes`
- `settlements`: `area_id, x, y, population, access_distance_km`
- `grid`: `cell_id, x, y`

### Task 1: Config, grid and synthetic data with known truth

**Files:**
- Create: `config.yml`, `R/00_utils.R`, `R/01_synthetic.R`, `tests/testthat/test_synthetic.R`

**Interfaces:**
- Produces: `load_config(path = "config.yml") -> list`; `make_grid(cfg) -> data.frame(cell_id, x, y)`; `generate_synthetic(cfg, seed) -> list(rain_obs, quality_obs, settlements, truth)` where `truth` holds `rain_cell` and `clean_cell` data frames (`cell_id, value`) on the grid.

- [ ] **Step 1: Write failing tests** in `test_synthetic.R`: `test_that("synthetic data has the agreed columns")` asserts exact column names of `rain_obs`, `quality_obs`, `settlements`; `test_that("passes never exceed tests")` asserts `all(quality_obs$passes <= quality_obs$tests)`; `test_that("same seed gives identical data")` asserts `identical()` of two calls; `test_that("truth hotspots are polluted")` asserts mean `clean_cell$value` in the 3 hotspot cells is below the overall mean.
- [ ] **Step 2: Run** `Rscript -e 'testthat::test_file("tests/testthat/test_synthetic.R")'`. Expected: FAIL, functions not defined.
- [ ] **Step 3: Implement** `config.yml` (keys: `region.xmin/xmax/ymin/ymax`, `grid.cells_x`, `grid.cells_y`, `rain.n_stations: 30`, `quality.n_sites: 40`, `settlements.n: 25`, `thresholds.clean_p: 0.80`, `thresholds.max_interval: 0.30`, `reliability_target: 0.90`, `seed: 1`) and the two functions. Truth fields: rainfall = smooth surface (sum of 3 Gaussian bumps plus linear trend); cleanliness = logistic of a smooth surface minus 3 Gaussian pollution hotspots. Observations: sample random locations, rainfall Gamma noise, quality tests Binomial(tests 3-8) from the truth. Label the returned list with `attr(x, "synthetic") <- TRUE`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: config, grid and synthetic data with known truth"`

### Task 2: Beta-Binomial safety update

**Files:**
- Create: `R/02_beta_binomial.R`, `tests/testthat/test_beta_binomial.R`

**Interfaces:**
- Produces: `beta_binomial_update(passes, tests, a = 1, b = 1) -> data.frame(mean, lower, upper)` (95% credible interval from `qbeta`).

- [ ] **Step 1: Write failing test**: `beta_binomial_update(2, 3)$mean` equals `0.6`; with `a = 2, b = 1` equals `4/6`; `beta_binomial_update(0, 0)$mean` equals `0.5` (prior only); vectorised input of length 3 returns 3 rows.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with posterior Beta(a + passes, b + tests - passes).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: beta-binomial safety update`.

### Task 3: Rainfall surface (R-INLA SPDE)

**Files:**
- Create: `R/03_rain_model.R`, `tests/testthat/test_rain_model.R`

**Interfaces:**
- Consumes: `rain_obs`, `grid`, `cfg`.
- Produces: `fit_rain_surface(rain_obs, grid, cfg) -> data.frame(cell_id, mean_mm, sd_mm, p_wet, p_wet_sd)`: posterior mean and sd of mean monthly rain on each cell, and the wet-day probability with its sd.

- [ ] **Step 1: Write failing tests**: output has one row per grid cell, no NaN; `mean_mm` correlates >= 0.7 with `truth$rain_cell$value` on the synthetic set; `sd_mm` is larger at cells far from any station than near one (compare the 10% farthest to the 10% nearest); a station with 0 mm in every month does not make the call error.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**: build an SPDE mesh over the region (`INLA::inla.mesh.2d`, `inla.spde2.matern`), fit a Gaussian model on log(rain_mm + 1) and a binomial model on `wet_days / days`, project to grid with `inla.mesh.projector`, back-transform means and sds (delta method, document it).
- [ ] **Step 4: Run, expect PASS** (run on the team's computer; skip with `skip_if_not_installed("INLA")`).
- [ ] **Step 5: Commit** `feat: rainfall surface with INLA SPDE`.

### Task 4: Cleanliness surface with small-data fallback

**Files:**
- Create: `R/04_clean_model.R`, `tests/testthat/test_clean_model.R`

**Interfaces:**
- Consumes: `quality_obs`, `grid`, `cfg`, `beta_binomial_update`.
- Produces: `fit_clean_surface(quality_obs, grid, cfg) -> data.frame(cell_id, p_clean, lower, upper, status)` with `status` in `"clean"`, `"polluted"`, `"unknown"` and an attribute `method` equal to `"spde"` or `"fallback"`.

- [ ] **Step 1: Write failing tests**: on synthetic data `p_clean` correlates >= 0.7 with truth; cells whose interval spans `cfg$thresholds.clean_p` are `"unknown"`; with only 8 sites `attr(result, "method") == "fallback"` and no error; `lower <= p_clean <= upper` everywhere.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**: binomial SPDE model (`family = "binomial"`, `Ntrials = tests`) with the same mesh helper as Task 3 (put the mesh helper in `00_utils.R`: `make_mesh(cfg, points)`); fewer than 10 sites -> nearest-site `beta_binomial_update` per cell, `method = "fallback"`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: cleanliness surface with fallback`.

### Task 5: Tank reliability simulation

**Files:**
- Create: `R/05_tank.R`, `tests/testthat/test_tank.R`

**Interfaces:**
- Produces: `tank_reliability(mean_mm, sd_mm, p_wet, roof_m2, tank_l, demand_l_day, n_draws = 500, days = 120, seed = 1) -> numeric` (P(demand met every day of the dry-spell window)); `min_tank_size(..., target = 0.90) -> numeric` (smallest tank in litres from a grid of 500-20000 L, `NA` if none reaches target).

- [ ] **Step 1: Write failing tests**: reliability rises monotonically with tank size; zero demand gives 1; zero rain gives 0 for positive demand; result is in [0, 1]; `min_tank_size` returns `NA` when rain is zero.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**: for each draw, draw cell rain parameters from Normal(mean, sd) truncated at 0 (stated approximation: independent draws, not full joint posterior), daily rain = Bernoulli(p_wet) x Gamma with the drawn monthly mean spread over wet days; inflow = rain_mm x roof_m2 x 0.8 (runoff coefficient, config key `runoff_coef`); tank balance capped at `tank_l`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: tank reliability simulation`.

### Task 6: Hub selection and allocation

**Files:**
- Create: `R/06_hubs.R`, `tests/testthat/test_hubs.R`

**Interfaces:**
- Consumes: outputs of Tasks 3-5, `settlements`.
- Produces: `select_hubs(rain, clean, cfg, n_max = 5) -> data.frame(cell_id, x, y, reliability, tank_l, p_clean)` (empty frame with attribute `message = "no safe hub found"` if none); `allocate_supply(hubs, settlements, cfg, max_km = 15, hub_capacity_people = 500) -> data.frame(area_id, hub_id, distance_km, p_served)` with `hub_id = NA` for unserved areas.

- [ ] **Step 1: Write failing tests**: every selected hub has `p_clean >= 0.80` and `status == "clean"`; empty hub case returns zero rows plus the message and `allocate_supply` marks every area unserved; an area farther than `max_km` from every hub is unserved; no hub is allocated more than `hub_capacity_people`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**: candidates = cells with status "clean"; score = reliability x p_clean; pick top `n_max` at least 3 km apart; allocation = greedy by lowest access first, nearest hub with capacity; `p_served` = hub reliability.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: hub selection and allocation`.

### Task 7: Outputs and end-to-end run

**Files:**
- Create: `R/07_outputs.R`, `run_all.R`, `tests/testthat/test_outputs.R`

**Interfaces:**
- Produces: `plot_map(rain, clean, hubs, settlements, title) -> ggplot`; `plot_supply_network(hubs, allocation, settlements, title) -> ggplot` (hubs as large nodes, areas as small nodes, edges weighted by `p_served`, unserved areas drawn grey); `write_report(rain, clean, hubs, allocation, path, synthetic) -> path` (markdown file).

- [ ] **Step 1: Write failing tests**: both plot functions return `ggplot` objects; titles contain "synthetic" when the data is synthetic; `write_report` creates the file and its first line contains "SYNTHETIC DATA" when `synthetic = TRUE`; report text includes the number of unserved areas.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the three functions and `run_all.R` (`source` all R files, load config, generate synthetic data, run Tasks 3-6, save `outputs/synthetic_map.png`, `outputs/synthetic_supply_network.png`, `outputs/synthetic_report.md`).
- [ ] **Step 4: Run** `Rscript run_all.R`. Expected: three files in `outputs/`, no error.
- [ ] **Step 5: Commit** `feat: outputs and end-to-end run`.

### Task 8: Real-data adapter and comparison

**Files:**
- Create: `R/08_real_adapter.R`, `tests/testthat/test_real_adapter.R`, `docs/real_data_mapping.md`

**Interfaces:**
- Produces: `load_real_data(rain_path, quality_path, settlements_path, mapping) -> list(rain_obs, quality_obs, settlements)` where `mapping` is a named list from required column to the user's column name (for example `list(site_id = "Station", tests = "n_samples")`); stops with an error naming any missing column.

- [ ] **Step 1: Write failing tests**: a small fixture CSV with renamed columns loads into the exact shared column names; a CSV missing `passes` errors with a message containing "passes"; rows with NA coordinates are dropped and counted in a message.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the loader. In `docs/real_data_mapping.md` write a table mapping each shared column to the likely real source (Mendeley Dhaka river dataset, CHIRPS, WorldPop) and mark what must be derived (for example pass/fail from a threshold on a measured variable).
- [ ] **Step 4: Run, expect PASS.** Then a human runs `run_all.R` with real files and compares outputs/real_* to outputs/synthetic_*.
- [ ] **Step 5: Commit** `feat: real data adapter and mapping notes`.

## Self-review notes

- Spec coverage: rainfall field (Task 3), hub cleanliness with Beta-Binomial (Tasks 2, 4), hub reliability (Task 5), demand areas and diagram (Tasks 6-7), datasets with synthetic and real options (Tasks 1, 8), "unknown" rule (Task 4).
- Known limits: tank simulation draws cell parameters independently, not from the full joint posterior; supply allocation is greedy, not optimal.
- Timeline: Tasks 1-2 on 16 Nov, 3-4 on 17 Nov, 5-6 on 18 Nov, 7-8 on 19 Nov, buffer and video on 20 Nov.
