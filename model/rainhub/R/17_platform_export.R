# Bridge to the Climate++ web platform: the model stays in R, the platform only DISPLAYS its results.
# export_platform(res, d, out) writes ONE json file (outputs/rainhub-model.json). Copy it to the platform's
# public/data/ folder and the "Plan hubs" page reads it. Re-run run_real.R, copy the file again: the page updates.
#   res: result of run_real_chain()    d: prepare_dhaka_data() output (needs $origin, $epsg)

# Local model kilometres (x, y) -> longitude / latitude (undoes the projection used in prepare_dhaka_data()).
xy_to_lonlat <- function(x, y, d) {
  e <- (x + d$origin[1]) * 1000; n <- (y + d$origin[2]) * 1000
  p <- sf::st_transform(sf::st_as_sf(data.frame(e = e, n = n), coords = c("e", "n"), crs = d$epsg), 4326)
  m <- sf::st_coordinates(p)
  data.frame(lon = round(m[, 1], 5), lat = round(m[, 2], 5))
}

platform_data <- function(res, d) {
  cfg <- res$cfg
  nd <- res$need
  C <- res$alloc$p_served[match(nd$area_id, res$alloc$area_id)]; C[is.na(C)] <- 0
  sv <- res$alloc$served_people[match(nd$area_id, res$alloc$area_id)]; sv[is.na(sv)] <- 0
  C <- C * pmin(pmax(sv / nd$population, 0), 1)               # cover C_i exactly as in the WAI
  km <- if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km
  cleaned <- rep(FALSE, nrow(nd))
  for (j in seq_len(nrow(res$top))) cleaned <- cleaned | sqrt((nd$x - res$top$x[j])^2 + (nd$y - res$top$y[j])^2) <= km
  ll <- xy_to_lonlat(nd$x, nd$y, d)
  blocks <- data.frame(id = nd$area_id, lon = ll$lon, lat = ll$lat, pop = round(nd$population),
                       s = round(nd$s_mean, 4), e = round(nd$p_severe, 4), c = round(C, 4),
                       hub = match(res$alloc$hub_id[match(nd$area_id, res$alloc$area_id)], res$hubs$cell_id), cleaned = cleaned)
  hl <- if (nrow(res$hubs)) xy_to_lonlat(res$hubs$x, res$hubs$y, d) else data.frame(lon = numeric(0), lat = numeric(0))
  hubs <- data.frame(id = seq_len(nrow(res$hubs)), lon = hl$lon, lat = hl$lat,
                     reliability = round(res$hubs$reliability, 3), tank_m3 = round(res$hubs$tank_l / 1000),
                     served = round(vapply(seq_len(nrow(res$hubs)), function(i) sum(res$alloc$served_people[res$alloc$hub_id %in% res$hubs$cell_id[i]], na.rm = TRUE), numeric(1))))
  tl <- if (nrow(res$top)) xy_to_lonlat(res$top$x, res$top$y, d) else data.frame(lon = numeric(0), lat = numeric(0))
  top <- data.frame(lon = tl$lon, lat = tl$lat, severity = round(res$top$s_mean, 3), people = round(res$top$pop_exposed))
  sg <- merge(res$grid[, c("cell_id", "x", "y")], res$severity[, c("cell_id", "s_mean", "p_severe")], by = "cell_id")
  if (!is.null(res$rain) && "mean_mm" %in% names(res$rain))       # rain model: mean monthly mm per cell
    sg$rain <- round(12 * res$rain$mean_mm[match(sg$cell_id, res$rain$cell_id)])
  gl <- xy_to_lonlat(sg$x, sg$y, d)
  cells <- data.frame(lon = gl$lon, lat = gl$lat, s = round(sg$s_mean, 3), e = round(sg$p_severe, 3))
  if (!is.null(sg$rain)) cells$rain_mm_year <- sg$rain
  so <- res$sev_obs; sl <- xy_to_lonlat(so$x, so$y, d)       # the measured river sites behind the surface
  sites <- data.frame(lon = sl$lon, lat = sl$lat, s = round(so$s_mean, 3), n = so$n)
  sp <- cfg$severity$params
  params <- lapply(names(sp), function(k) { p <- sp[[k]]
    list(name = k, column = p$column, direction = p$direction, weight = round(p$weight, 4),
         good = if (!is.null(p$ref)) p$ref else c(p$ref_low, p$ref_high), bad = p$bad) })
  list(meta = list(model = "Bayesian rainwater-hub system (R-INLA SPDE)", generated = format(Sys.time(), "%Y-%m-%d"),
                   region = "Dhaka study area", population = sum(nd$population), tau = cfg$severity$tau,
                   cleanup_effect = attr(res$wai, "cleanup_effect"), exposure_km = km,
                   hub_capacity_people = cfg$hub_capacity_people, hub_tank_m3 = cfg$hub_tank_l / 1000,
                   exposed = sum(nd$population * nd$p_severe),
                   samples = if (!is.null(d$quality_obs)) sum(d$quality_obs$tests) else NA,
                   sites = if (!is.null(d$quality_obs)) nrow(d$quality_obs) else NA,
                   pass_pct = if (!is.null(d$quality_obs)) round(100 * sum(d$quality_obs$passes) / sum(d$quality_obs$tests), 1) else NA,
                   monthly_mm = if (!is.null(cfg$season$monthly_mm)) round(cfg$season$monthly_mm) else NULL,
                   hubs_reliability = if (nrow(res$hubs)) range(round(res$hubs$reliability, 3)) else NA,
                   source = "Dhaka river dataset (Mendeley, CC BY 4.0), CHIRPS rain, WorldPop population"),
       params = params, blocks = blocks, sites = sites, hubs = hubs, cleanup_zones = top, cells = cells,
       wai = res$wai[, c("scenario", "wai", "people_not_exposed", "gain_vs_baseline")],
       wai_sensitivity = res$wai_sens, scaleup = res$scaleup)
}

export_platform <- function(res, d, out = "outputs/rainhub-model.json") {
  if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Package 'jsonlite' is needed: install.packages('jsonlite')", call. = FALSE)
  dir.create(dirname(out), showWarnings = FALSE, recursive = TRUE)
  writeLines(jsonlite::toJSON(platform_data(res, d), auto_unbox = TRUE, digits = 5, na = "null", dataframe = "rows"), out, useBytes = TRUE)
  invisible(out)
}
