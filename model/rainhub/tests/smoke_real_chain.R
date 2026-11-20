# Smoke test: the WHOLE real-data chain on the real CSV with INLA-free stand-ins
# (nearest-site fallbacks and a constant rain surface). Run from the project root.
# Usage: Rscript tests/smoke_real_chain.R <out_dir> [p_wet = 0.3]
# (p_wet 0.3 gives reliability ~0.6 < hub_min_reliability, so NO hubs; try 0.5 to exercise supply/gap.)
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
args <- commandArgs(TRUE)
out_dir <- if (length(args)) args[1] else tempfile("smoke_real")
p_wet <- if (length(args) > 1) as.numeric(args[2]) else 0.3
cfg <- load_config("config.yml")
cfg$hub_require_clean <- FALSE
d <- prepare_dhaka_data("data/real/dhaka_water_quality.csv", do_threshold = 5)
const_rain <- function(rain_obs, grid, cfg)
  data.frame(cell_id = grid$cell_id, mean_mm = 235, sd_mm = 40, p_wet = p_wet, p_wet_sd = 0.05)
res <- run_real_chain(d, cfg, out_dir, fit_rain = const_rain,
                      fit_clean = fit_clean_fallback, fit_sev = fit_severity_fallback)
g <- res$gap
cat(sprintf("sites: %d  samples: %d  grid cells: %d\n", nrow(res$sev_obs), nrow(d$samples), nrow(res$grid)))
cat(sprintf("site severity: min %.3f mean %.3f max %.3f; cells with p_severe>0.5: %d\n",
            min(res$sev_obs$s_mean), mean(res$sev_obs$s_mean), max(res$sev_obs$s_mean), sum(res$severity$p_severe > 0.5)))
cat(sprintf("hubs: %d  unserved areas: %d of %d\n", nrow(res$hubs), sum(is.na(res$alloc$hub_id)), nrow(res$alloc)))
cat(sprintf("total need: %.1f  total served: %.1f  need met: %.1f%%\n",
            sum(g$need), sum(g$served_people), 100 * sum(g$need - g$gap) / sum(g$need)))
cat("top 3 priorities:\n"); print(utils::head(res$top[, c("cell_id", "x", "y", "s_mean", "pop_exposed", "rain_coverage", "priority")], 3), row.names = FALSE)
stopifnot(file.exists(file.path(out_dir, c("real_map.png", "real_supply_network.png", "real_severity_map.png",
                                           "real_gap.png", "real_cleanup_priority.csv", "real_report.md"))))
cat("written to", out_dir, "\n")
