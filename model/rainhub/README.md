# rainhub: a Bayesian rainwater-hub system for water access

Status update for the team, last updated 17 Nov 2026. Entry for the Xylem Global Student Innovation Challenge 2026 (theme: Water Access). Deadline: 20 Nov 2026, 21:00 UTC.

---

## 1. Problem

Many people in Dhaka live beside rivers that are heavily polluted. NGOs and local governments have to decide where to spend limited money and field time, but their data are sparse and noisy, and they have no clear way to answer three questions:

1. Where is the water polluted, and how badly?
2. Where could rainwater be collected reliably as a replacement supply?
3. Who is still left exposed after that, and where should cleanup start?

## 2. Purpose

Build one system, usable in any region (not just Dhaka), that:

- measures **how bad** pollution is, with a number and with its uncertainty;
- finds **rainwater hubs** that can reliably supply the most exposed people nearby;
- shows the **gap** that remains, ranks where **cleanup** should happen first, and says where one more water test would help most;
- sums everything into **one index**, so actions can be compared on the same scale.

Primary method: pollution mitigation. Secondary method: sourcing fresh water through rainwater harvesting. The aim is to keep supply active while cleanup works.

## 3. Methods (what was done, in order)

1. **Framework.** Water Access theme. Region-agnostic by design; Dhaka is the worked example. Intended users: NGOs and local governments.
2. **Synthetic data first.** Hidden "true" maps with three pollution hotspots let us check the models against known answers. Every synthetic output is labelled "SYNTHETIC".
3. **Bayesian building block (Beta-Binomial).** Each site's chance of being safe is updated with each pass or fail test. Example: 2 passes in 3 tests with no prior opinion gives (1 + 2) / (1 + 1 + 3) = 60%.
4. **Bayesian spatial surfaces (R-INLA, SPDE).** Rainfall, wet-day probability, cleanliness and pollution severity are each modelled as a hidden spatial field, so nearby places share information. Every grid cell gets an estimate and an uncertainty, including places nobody measured.
5. **Pollution severity index (all 7 covariates).** For each water sample, each parameter is scored from 0 to 1 against a reference and a "bad" value, then averaged: `s = clamp((x - ref) / (bad - ref), 0, 1)` and `S = sum(w*s) / sum(w)`. Parameters: temperature, pH, dissolved oxygen, COD, nitrate, turbidity, phosphate. Equal weights (1/7). A place is "severely polluted" if S is above 0.35.
6. **Real data.** River tests: the Dhaka dataset (Sinha, Debnath and Bhattacharjee, Mendeley Data, DOI 10.17632/xftpv7jvx3.1, CC BY 4.0), 1,495 samples at 58 sites, 2017 to 2021. Rainfall: CHIRPS v2.0 (monthly totals 2017 to 2021, wet-day fractions from daily 2020). Population: WorldPop Bangladesh 2020. `scripts/fetch_real_inputs.R` downloads the last two.
7. **Seasonal rain-tank simulation.** A cistern is simulated day by day with Dhaka's real monthly rain pattern, 500 times for every candidate cell and 5,000 times for the chosen hubs (see Section 4).
8. **Hub choice.** Eligible cells have reliability of at least 0.80. They are ranked by reliability times the share of need within 25 km. Real run: up to 15 community cisterns at least 6 km apart, each for 5,000 people.
9. **Allocation.** Hub water goes to the most exposed population blocks first (highest chance of severe pollution), from the nearest hub within 25 km. Blocks can be served in part, and capacity left over tops up part-served blocks.
10. **Need, gap and cleanup priority.** `Need = pop x P(river severely polluted)`, `Cover = hub reliability x share of the block a hub serves`, `Gap = Need x (1 - Cover)`, and `Cleanup priority = severity x people within 5 km x (1 - rain coverage)`. The gap uses the same cover as the index, so the two always agree (this settles the earlier "two gap measures" question).
11. **Where to test next.** `Test value = P(severe) x (1 - P(severe)) x people within 5 km`. A new water test is worth most where the model is still unsure and many people depend on the answer.
12. **Water Access Index (WAI).** One number for the whole system (Section 5).

## 4. How the Bayesian rain-harvesting model works

The model does not use a single average rainfall number. It turns the fitted rain surface into thousands of simulated years of weather and asks how often the tank survives:

1. **Data to posterior.** The rain model (R-INLA) fits mean monthly rain (Gaussian on `log(1 + mean rain)`) and wet-day probability (binomial). Every grid cell gets a posterior mean and a standard deviation.
2. **Posterior to rainfall scenarios.** For one candidate hub cell, the simulator draws a rain level from `Normal(mean_mm, sd_mm)` truncated at zero. Each calendar month is scaled by the real monthly pattern from CHIRPS (Dhaka: about 2,300 mm a year, but only about 133 mm in the five driest months). Each day is wet with that month's wet-day chance, and wet-day amounts follow a Gamma distribution.
3. **Scenarios to tank behaviour.** Each day, `inflow = rain (mm) x catchment area (m2) x 0.8 runoff factor`. The tank gains the inflow and loses the daily demand, capped at its size. Two years are simulated and only the second is scored, so the result does not depend on a full tank at the start.
4. **Behaviour to reliability.** Reliability `R` is the share of simulated years in which demand was met every single day. The same simulation gives the smallest tank that reaches the 90% target.
5. **Reliability to decision.** A cell becomes a hub only if `R` is at least 0.80.

What is Bayesian, and what is not (so nobody over-claims):

- Bayesian: the Beta-Binomial update, and all four INLA spatial models, each with a prior, a likelihood and a posterior with uncertainty.
- Honest scope: the rain surface's own uncertainty is small (about 1.5 mm on 192 mm a month), so it barely changes reliability. Almost all the year-to-year spread comes from the assumed day-to-day weather model (wet or dry days, Gamma amounts). Where Bayesian uncertainty really drives decisions is pollution: the chance of severe pollution feeds need, the index and the test-next ranking.
- Approximation: the tank simulation draws each cell's rain level independently, not from the full joint posterior across cells.
- Approximation: the seasonal pattern is one region-wide profile. Wet-day fractions come from one year of daily data (2020), so each month is given at least about one wet day.
- Simple ranking, not a full calculation: "where to test next" is uncertainty times people, in the spirit of value of information.

## 5. Solution (what the system produces)

Per run, in `outputs/`: a cleanliness-and-rainfall map, a pollution-severity map, a hub supply network, a need-versus-served chart, the cleanup priority table, the test-next table, the Water Access Index table, fitted surfaces as CSV files, a written report, and an animated film (`real_film.html`).

**Water Access Index:**

```
E_i = P( S(u_i) > tau )          chance the local river is severely polluted
C_i = R_hub(i) x share served    chance a hub supplies the area
A_i = (1 - E_i) + E_i * C_i      chance the area is not left exposed
WAI = sum( pop_i * A_i ) / sum( pop_i )      0 to 1
```

WAI is the expected share of people who are not left depending on a severely polluted river: their river is not severely polluted, or a rain hub covers them. It does **not** count piped or groundwater supply, so it is an index of river exposure and rain cover, not a census of who has safe tap water.

**Latest real-data run (Dhaka; replayed from the fitted surfaces of the 16 Nov R-INLA run, see "Test status"):**

- Cleanliness: no cell is clearly clean (181 polluted, 719 unknown). Most river samples fail the dissolved-oxygen check.
- People: 1,064 population blocks of about 2 km hold 24.7 million people. An expected 12.6 million of them live where the river is severely polluted.
- Hubs: 15 community cisterns (5,000 people, 20,000 m2 catchment, 12,000 m3 tank), reliability 0.90 to 0.93 through the dry season (5,000 simulated years each, noise about 0.005). They supply about 69,000 people in the 18 most exposed blocks they can reach; most of those blocks are served only in part.
- Cleanup: the top-priority cells sit in the dense core near x 20 to 25 km and y 18 to 24 km.
- Test next: the highest-value cell for a new water test is near x 22 km, y 18 km (chance of severe pollution 0.65, 4.9 million people within 5 km).

| Scenario | WAI | Gain |
|---|---|---|
| Baseline (no action) | 0.490 | |
| 15 rain cisterns | 0.493 | +0.003 |
| Cleanup zones: 5 km around the top 10 cells, 10.9 million people, assumed to halve the chance of severe pollution | 0.653 | +0.163 |
| Cisterns + cleanup | 0.655 | +0.165 |

The cleanup effect is an assumption, so the report also shows other values: with a 25% cut the combined index is 0.574, with 75% it is 0.737, and with a full restoration it is 0.818.

How many cisterns would rain alone need? As an upper bound (every cistern serves the most exposed people left, with no distance limit), the index reaches 0.578 for 500 cisterns and 0.662 for 1,000. Matching the cleanup gain above would take about 950 cisterns.

## 6. Conclusion

- The pipeline works end to end on real data: river tests in, Bayesian maps with uncertainty, rain cisterns that survive the dry season, need and gap, cleanup ranking, test-next ranking, one index, a report and a film out.
- On Dhaka, rainwater is a bridge and cleanup is the cure. 15 cisterns keep about 69,000 people supplied but move the index by only +0.003. Cleanup in ten zones (which together hold 10.9 million people) moves it by about +0.163 under the stated assumption. The two should run side by side.
- It is a planning tool, not yet a supply plan. The hub design, the severe cut-off and the cleanup effect are assumptions the team must confirm, and the index does not know about piped water.

## The animated film

- `outputs/real_film.html` is written by `run_real.R`. Open it in a browser: five parts (Problem, Purpose, Method, Solution, Conclusion), about 72 seconds, with captions and a narration script.
- Every number in the film is read from the run, so the film always matches the report.
- To rebuild it without re-running the models: `source("scripts/build_film.R")`. To change the look or wording, edit `scripts/film_template.html`. The code is in `R/16_film.R`.

## Honest limits (please read before presenting)

- **Not a tap-water census:** most of Dhaka's supply is piped. WAI measures exposure to severely polluted river water and rain cover only.
- **River quality is a proxy** for local pollution. Severity is interpolated from 58 river sites to every block, including blocks far from a river. The P(clean) column in the hub table is the nearby river, not the hub water.
- **Rainwater quality is not modelled:** first-flush diversion and treatment at the cistern are assumed.
- **Demand areas:** WorldPop is a modelled estimate. Access distance is a constant placeholder and is no longer used to order the allocation.
- **Rain:** CHIRPS is a satellite estimate. Monthly totals cover 2017 to 2021; wet-day fractions come from 2020 only.
- **Assumptions to confirm:** reference values for dissolved oxygen, pH, COD, nitrate and phosphate were read from a page image of the 2023 water standard and need checking. The "bad" values, equal weights, the severe cut-off `tau = 0.35`, the cleanup effect (50%) and the hub settings (20,000 m2 catchment, 75,000 L/day for 5,000 people, 12,000 m3 tank, 25 km reach) are assumptions.
- The dataset's COD value is 70 mg/L in most samples, which compresses the severity spread. Worth asking the dataset owners.
- **Test status:** 286 passed, 0 failed in a sandbox without R-INLA (8 INLA-only tests skipped). The numbers above come from re-running the 17 Nov code on the surfaces fitted by R-INLA on the author's machine on 16 Nov. Run `source("run_real.R")` and `testthat::test_dir("tests/testthat")` again to confirm them on your machine.

## How to run

Needs R 4.3 or newer with R-INLA, plus the packages `sf`, `terra`, `dplyr`, `ggplot2`, `testthat`, `yaml`.

1. Open the project folder in VS Code and set the R working directory to this folder.
2. Tests: `testthat::test_dir("tests/testthat")`.
3. Synthetic run: `source("run_all.R")`. Outputs go to `outputs/synthetic_*`.
4. Real inputs, once: `source("scripts/fetch_real_inputs.R")` (downloads CHIRPS and WorldPop into `data/real/`).
5. Real-data run: `source("run_real.R")`. Outputs go to `outputs/real_*`, including the film.

Everything region-specific lives in `config.yml` and at the top of `run_real.R`.

## Folder guide

- `R/`: the code. `01` synthetic data, `02` Beta-Binomial, `03` rain model, `04` cleanliness model, `05` tank simulation, `06` hubs and allocation, `07` map and report, `08` real-data loader, `09` Dhaka data preparation, `10` severity index, `11` need, gap, cleanup priority and test-next, `12` severity outputs, `13` the real-data chain, `14` CHIRPS and WorldPop loaders, `15` Water Access Index and hub scale-up, `16` the film.
- `scripts/`: `fetch_real_inputs.R` (downloads), `build_film.R` and `film_template.html` (the animation).
- `tests/`: automated tests, plus smoke scripts that run the outputs without INLA.
- `data/`: synthetic and real tables. Real inputs are in `data/real/`.
- `docs/`: `plan.md` and `real_data_mapping.md`.
- `outputs/`: maps, tables, reports and the film from the last run.

## What is left before 20 Nov

1. Run `source("run_real.R")` on the author's machine to confirm the numbers above with a fresh R-INLA fit.
2. Confirm the assumptions listed above, above all the cistern settings, the severe cut-off and the cleanup effect.
3. Record the presentation video (screen-record the film in fullscreen and read the narration script).
4. Check Xylem's rules on contributors who are not students, before submitting.
