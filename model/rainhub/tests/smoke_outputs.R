# Smoke test: output functions on fixtures built from the synthetic truth (no INLA).
# Usage: Rscript tests/smoke_outputs.R [out_dir]
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
args <- commandArgs(TRUE)
out_dir <- if (length(args)) args[1] else tempfile("smoke")
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
cfg <- load_config("config.yml")
syn <- generate_synthetic(cfg, cfg$seed); grid <- make_grid(cfg)
rain <- data.frame(cell_id = syn$truth$rain_cell$cell_id, mean_mm = syn$truth$rain_cell$value,
                   sd_mm = 15, p_wet = 0.5, p_wet_sd = 0.05)
p <- syn$truth$clean_cell$value
clean <- data.frame(cell_id = grid$cell_id, p_clean = p, lower = pmax(0, p - 0.15), upper = pmin(1, p + 0.15))
clean$status <- ifelse(clean$lower >= cfg$thresholds$clean_p, "clean",
                ifelse(clean$upper < cfg$thresholds$clean_p, "polluted", "unknown"))
hubs <- select_hubs(rain, clean, cfg, grid)
alloc <- allocate_supply(hubs, syn$settlements, cfg)
ggplot2::ggsave(file.path(out_dir, "map.png"),
  plot_map(rain, clean, hubs, syn$settlements, "Map", grid = grid, synthetic = TRUE), width = 8, height = 7, dpi = 100)
ggplot2::ggsave(file.path(out_dir, "network.png"),
  plot_supply_network(hubs, alloc, syn$settlements, "Network", synthetic = TRUE), width = 8, height = 7, dpi = 100)
write_report(rain, clean, hubs, alloc, file.path(out_dir, "report.md"), TRUE, cfg)
cat("hubs:", nrow(hubs), " unserved:", sum(is.na(alloc$hub_id)), "\nwritten to", out_dir, "\n")
