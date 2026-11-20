# The whole real-data chain after the data are loaded: rain + cleanliness + severity surfaces
# -> need -> hubs -> allocation -> gap -> cleanup priority -> PNGs, CSV and report.
# The three surface fitters are arguments so run_real.R can pass the R-INLA ones and
# tests/smoke_real_chain.R can pass INLA-free stand-ins through exactly the same code.
#   fit_rain(rain_obs, grid, cfg), fit_clean(quality_obs, grid, cfg), fit_sev(sev_obs, grid, cfg)
# Set cfg$hub_require_clean before calling (the real run sets it FALSE explicitly).

run_real_chain <- function(d, cfg, out_dir, fit_rain, fit_clean, fit_sev,
                           settlements = NULL, tag = "Dhaka rivers (real water data)") {
  dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
  out <- function(f) file.path(out_dir, f)
  cfg$region <- list(xmin = -3, xmax = d$extent[["xmax"]] + 3, ymin = -3, ymax = d$extent[["ymax"]] + 3)
  grid <- make_grid(cfg)
  if (is.null(cfg$season) && isTRUE(cfg$hub_seasonal)) cfg$season <- season_profile(d$rain_obs)
  if (isTRUE(cfg$hub_seasonal) && is.null(cfg$season))
    stop("hub_seasonal is TRUE but the rain table does not cover all 12 calendar months, so there is no seasonal profile. ",
         "Run scripts/fetch_real_inputs.R (CHIRPS), or set cfg$hub_seasonal <- FALSE and use small-tank settings.", call. = FALSE)
  if (is.null(settlements)) settlements <- make_demo_settlements(cfg, seed = cfg$seed)   # PLACEHOLDER demand areas

  # Surfaces
  rain  <- fit_rain(d$rain_obs, grid, cfg)
  clean <- fit_clean(d$quality_obs, grid, cfg)
  sev_obs <- site_severity(d$samples, cfg, site_col = "site", x_col = "x", y_col = "y")
  severity <- fit_sev(sev_obs, grid, cfg)

  # Save the fitted surfaces so every map can be re-checked from files.
  utils::write.csv(merge(grid, rain, by = "cell_id"), out("real_rain_surface.csv"), row.names = FALSE)
  utils::write.csv(merge(grid, clean, by = "cell_id"), out("real_clean_surface.csv"), row.names = FALSE)
  utils::write.csv(merge(grid, severity, by = "cell_id"), out("real_severity_surface.csv"), row.names = FALSE)

  # Need -> hubs (weighted by need when hub_require_clean is FALSE) -> allocation -> gap -> priority
  need  <- compute_need(settlements, severity, grid)
  if (isTRUE(cfg$allocate_by_exposure)) need$alloc_priority <- need$p_severe   # most exposed areas get hub water first
  hubs  <- select_hubs(rain, clean, cfg, grid, n_max = if (is.null(cfg$hub_n_max)) 5 else cfg$hub_n_max, settlements = need)
  alloc <- allocate_supply(hubs, need, cfg, max_km = cfg$max_km, hub_capacity_people = cfg$hub_capacity_people)
  gap   <- compute_gap(need, alloc)
  prio  <- cleanup_priority(severity, need, grid, alloc, cfg)
  top   <- top_priority(prio, 10)

  # Outputs
  ggplot2::ggsave(out("real_map.png"),
    plot_map(rain, clean, hubs, settlements, paste(tag, "- cleanliness and rainfall"), grid = grid),
    width = 8, height = 7, dpi = 150, bg = "white")
  ggplot2::ggsave(out("real_supply_network.png"),
    plot_supply_network(hubs, alloc, settlements, paste(tag, "- supply network")),
    width = 8, height = 7, dpi = 150, bg = "white")
  ggplot2::ggsave(out("real_severity_map.png"),
    plot_severity_map(severity, grid, sites = sev_obs, title = "Dhaka rivers - pollution severity"),
    width = 8, height = 7, dpi = 150, bg = "white")
  ggplot2::ggsave(out("real_gap.png"),
    plot_gap(gap, "Dhaka demand areas - need vs people served"),
    width = 8, height = max(5, 0.28 * min(nrow(gap), 30) + 2), dpi = 150, bg = "white")
  utils::write.csv(top, out("real_cleanup_priority.csv"), row.names = FALSE)

  report <- out("real_report.md")
  write_report(rain, clean, hubs, alloc, report, synthetic = FALSE, cfg = cfg)
  write_gap_section(gap, prio, report, cfg)
  wai <- wai_scenarios(need, alloc, prio, cfg)
  wai_sens <- wai_sensitivity(need, alloc, prio, cfg)
  write_wai_section(wai, report, cfg, sens = wai_sens)
  scaleup <- if (nrow(hubs) > 0) hub_scaleup(need, cfg, mean(hubs$reliability)) else NULL
  if (!is.null(scaleup)) write_scaleup_section(scaleup, report, cfg)
  utils::write.csv(wai, out("real_wai.csv"), row.names = FALSE)
  samp <- sampling_priority(severity, need, grid, cfg)
  write_sampling_section(samp, report, cfg)
  utils::write.csv(utils::head(samp[samp$test_value > 0, ], 10), out("real_test_next.csv"), row.names = FALSE)
  real_pop <- identical(attr(settlements, "source"), "WorldPop")
  rain_src <- if (is.null(d$rain_source)) "sampling-day rainfall from the water file (rough)" else d$rain_source
  rain_real <- grepl("CHIRPS", rain_src)
  cat("\n## Data notes\n\n",
      "- Water tests: 1,495 river samples at 58 sites (2017-2021); a sample passes if dissolved oxygen >= 5 mg/L.\n",
      "- Pollution severity uses all 7 covariates (temperature, pH, DO, COD, nitrate, turbidity, phosphate), ",
      "averaged per site and then interpolated; the 'severe' cut-off tau is an assumption (see config.yml).\n",
      "- Rainfall source: ", rain_src, if (rain_real) ". The fitted surface is the annual mean; the monthly pattern enters only through the tank simulation." else ": treat the rain surface as rough.", "\n",
      if (real_pop) paste0("- Demand areas: ", nrow(settlements), " WorldPop 2020 blocks (~2 km) holding ", format(sum(settlements$population), big.mark = ",", scientific = FALSE), " people; ",
                           if (isTRUE(cfg$allocate_by_exposure)) "hub water goes to the most exposed blocks first; " else "",
                           "access distance is a constant placeholder. One hub serves ", cfg$hub_capacity_people,
                           " people; the ", nrow(hubs), " hubs here cover a small part of the need (see 'How many hubs would it take?').\n")
      else "- Demand areas are PLACEHOLDERS (random), so 'areas served', need, gap and cleanup-priority people counts are not real findings.\n",
      if (!is.null(cfg$season)) paste0("- Tank reliability is simulated over two years with the real monthly rain pattern and scored on the second year",
          "; the dry season decides it. The year-to-year spread comes from an assumed day-to-day weather model.",
          if (!is.null(cfg$hub_final_draws)) paste0(" Chosen hubs use ", format(cfg$hub_final_draws, big.mark = ","), " simulated years (noise about +/- 0.005).") else "", " Hub tank assumed ", format(cfg$hub_tank_l, big.mark = ",", scientific = FALSE),
          " L, demand ", cfg$hub_demand_l_day, " L/day, roof ", cfg$hub_roof_m2, " m2 (assumptions, see config.yml).\n"),
      "- Hubs are rain-harvest sites (hub_require_clean = ", isTRUE(cfg$hub_require_clean), "): river quality does not gate them.\n",
      "- River cleanliness is a proxy for local pollution, not a measure of roof-collected rainwater.\n",
      file = report, append = TRUE, sep = "")
  invisible(list(grid = grid, settlements = settlements, rain = rain, clean = clean, sev_obs = sev_obs,
                 severity = severity, need = need, hubs = hubs, alloc = alloc, gap = gap,
                 prio = prio, top = top, wai = wai, wai_sens = wai_sens, scaleup = scaleup, samp = samp, cfg = cfg, out_dir = out_dir))
}
