# End-to-end run on synthetic data. Needs R-INLA (run on the team's computer).
# Usage: Rscript run_all.R   (from the project root)
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)

cfg <- load_config("config.yml")
cfg$hub_require_clean <- TRUE   # synthetic run keeps river-clean hubs
dir.create("data", showWarnings = FALSE)
dir.create("outputs", showWarnings = FALSE)

# 1. Data (synthetic); tables saved so every number traces to a file.
syn <- generate_synthetic(cfg, cfg$seed)
grid <- make_grid(cfg)
write.csv(syn$rain_obs, "data/synthetic_rain_obs.csv", row.names = FALSE)
write.csv(syn$quality_obs, "data/synthetic_quality_obs.csv", row.names = FALSE)
write.csv(syn$settlements, "data/synthetic_settlements.csv", row.names = FALSE)
write.csv(syn$truth$rain_cell, "data/synthetic_truth_rain.csv", row.names = FALSE)
write.csv(syn$truth$clean_cell, "data/synthetic_truth_clean.csv", row.names = FALSE)

# 2. Models
rain  <- fit_rain_surface(syn$rain_obs, grid, cfg)
clean <- fit_clean_surface(syn$quality_obs, grid, cfg)

# 3-4. Hubs and allocation
hubs  <- select_hubs(rain, clean, cfg, grid, settlements = syn$settlements)
alloc <- allocate_supply(hubs, syn$settlements, cfg, max_km = cfg$max_km, hub_capacity_people = cfg$hub_capacity_people)

# 5. Outputs
ggplot2::ggsave("outputs/synthetic_map.png",
  plot_map(rain, clean, hubs, syn$settlements, "Water cleanliness and rainfall", grid = grid, synthetic = TRUE),
  width = 8, height = 7, dpi = 150, bg = "white")
ggplot2::ggsave("outputs/synthetic_supply_network.png",
  plot_supply_network(hubs, alloc, syn$settlements, "Hub supply network", synthetic = TRUE),
  width = 8, height = 7, dpi = 150, bg = "white")
write_report(rain, clean, hubs, alloc, "outputs/synthetic_report.md", synthetic = TRUE, cfg = cfg)
message("Done: outputs/synthetic_map.png, synthetic_supply_network.png, synthetic_report.md")
