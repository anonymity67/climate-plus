# Run the pipeline on the real Dhaka river data (needs R-INLA; run from the project root).
# Usage: source("run_real.R")
# Chain: rain + cleanliness + severity surfaces -> need -> hubs -> allocation -> gap -> cleanup priority.
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
cfg <- load_config("config.yml")
cfg$hub_seasonal <- TRUE         # simulate a full year with the real monsoon/dry pattern (needs CHIRPS months)
# Community cistern (ASSUMPTIONS, collaborator to confirm): one hub = a big shared catchment + underground cistern
# serving 5,000 people at 15 L/person/day. Tested in the sandbox: 20,000 m2 catchment needs about 12,000 m3
# of storage to get through Dhaka's dry season at 90% reliability.
cfg$hub_capacity_people <- 5000
cfg$hub_demand_l_day <- 5000 * 15
cfg$hub_roof_m2 <- 20000
cfg$hub_tank_l <- 12e6
cfg$hub_final_draws <- 5000      # chosen hubs are re-simulated with 5,000 years so the reliability figure is stable
cfg$hub_n_max <- 15              # up to 15 hubs, at least hub_min_sep_km apart
cfg$hub_min_sep_km <- 6
cfg$allocate_by_exposure <- TRUE  # hub water goes first to blocks with the highest chance of severe pollution
cfg$allow_split <- TRUE          # real population blocks are far larger than one hub: serve them in part
cfg$hub_require_clean <- FALSE   # explicit: hubs are rain-harvest sites; river quality does not gate them
dir.create("outputs", showWarnings = FALSE)

# 1. Real data -> shared tables (d$samples = cleaned sample rows for the severity index)
d <- prepare_dhaka_data("data/real/dhaka_water_quality.csv", do_threshold = 5)

# 1b. Real rainfall (CHIRPS) and population (WorldPop), if scripts/fetch_real_inputs.R has been run.
#     Missing file -> the old placeholder is used and the report says so.
chirps_m <- "data/real/chirps_dhaka_monthly.csv"; chirps_d <- "data/real/chirps_dhaka_daily_2020.csv"; wp_f <- "data/real/worldpop_bgd_2020_1km.tif"
d$rain_source <- "sampling-day rainfall from the water file (rough)"
if (file.exists(chirps_m) && file.exists(chirps_d)) {
  d$rain_obs <- chirps_to_rain_obs(chirps_m, chirps_d, d)
  d$rain_source <- "CHIRPS v2.0 (monthly totals 2017-2021; wet-day fraction from daily 2020)"
} else message("No CHIRPS files in data/real: using rough sampling-day rainfall. Run scripts/fetch_real_inputs.R.")
settlements <- NULL
if (file.exists(wp_f)) {
  region <- list(xmin = -3, xmax = d$extent[["xmax"]] + 3, ymin = -3, ymax = d$extent[["ymax"]] + 3)
  settlements <- worldpop_to_settlements(wp_f, d, region, n = Inf)   # every 2 km block with 500+ people
} else message("No ", wp_f, ": using random placeholder demand areas. Run scripts/fetch_real_inputs.R.")

# 2. Everything else (region = data extent + 3 km margin)
res <- run_real_chain(d, cfg, out_dir = "outputs", settlements = settlements,
                      fit_rain = fit_rain_surface, fit_clean = fit_clean_surface, fit_sev = fit_severity_surface)
write.csv(d$quality_obs, "data/real_quality_obs.csv", row.names = FALSE)
write.csv(d$rain_obs, "data/real_rain_obs.csv", row.names = FALSE)
write.csv(res$settlements, "data/real_demand_areas.csv", row.names = FALSE)

# 3. The animated film, filled with this run's numbers (rebuild later with scripts/build_film.R)
saveRDS(list(res = res, d = d[c("quality_obs", "rain_obs", "rain_source", "origin", "epsg")]), "outputs/real_result.rds")
build_film(res, d, "outputs/real_film.html")
# 4. The results file the Climate++ web platform reads (page "Plan hubs"): copy it to the platform's public/data/
export_platform(res, d, "outputs/rainhub-model.json")
# Inside the Aquavelle package, also refresh the copy the web app serves.
if (dir.exists("../../web/public/data")) file.copy("outputs/rainhub-model.json", "../../web/public/data/rainhub-model.json", overwrite = TRUE)
message("Done: outputs/real_report.md, real_film.html, real_map.png, real_supply_network.png, real_severity_map.png, real_gap.png, ",
        "real_cleanup_priority.csv, real_test_next.csv, real_wai.csv")
