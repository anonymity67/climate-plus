# Real Dhaka river data (Mendeley xftpv7jvx3, CC BY 4.0) -> the pipeline's shared tables.
# Column names were checked against the file header on 2026-11-16.
#
# Known limits (state them in anything built from this):
#  * Rain: the file only has rainfall on the SAMPLING DAY, not a monthly record. A
#    station-month's mean rain is mean(daily rain) * 30 and wet days are the sampled days
#    above 1 mm. Replace with CHIRPS for a proper rain surface.
#  * Quality: these are RIVER samples. Pass = dissolved oxygen >= do_threshold. River
#    cleanliness is a proxy for local pollution, not a measure of roof-collected rainwater.
#  * Demand areas are NOT in this file; see make_demo_settlements().

prepare_dhaka_data <- function(csv_path, do_threshold = 5, epsg = 32646) {
  raw <- utils::read.csv(csv_path, stringsAsFactors = FALSE, check.names = FALSE)
  names(raw) <- gsub("\\s+", " ", names(raw))
  need <- c("Date", "Latitude", "Longitude", "DO (mg/L)", "Rainfall (mm)")
  miss <- setdiff(need, names(raw))
  if (length(miss)) stop("Dhaka file is missing column(s): ", paste(miss, collapse = ", "),
                         ". Found: ", paste(names(raw), collapse = ", "), call. = FALSE)
  raw <- raw[stats::complete.cases(raw[, c("Latitude", "Longitude")]), ]
  # lon/lat -> projected km, origin at the south-west corner of the data
  pts <- sf::st_transform(sf::st_as_sf(raw, coords = c("Longitude", "Latitude"), crs = 4326), epsg)
  xy <- sf::st_coordinates(pts) / 1000
  origin <- c(min(xy[, 1]), min(xy[, 2]))
  raw$x <- xy[, 1] - origin[1]; raw$y <- xy[, 2] - origin[2]
  raw$site <- paste(round(raw$Latitude, 4), round(raw$Longitude, 4))
  raw$month <- as.integer(format(as.Date(raw$Date), "%m"))

  quality_obs <- derive_pass_fail(raw, "DO (mg/L)", do_threshold, "above",
                                  site_col = "site", x_col = "x", y_col = "y")

  key <- paste(raw$site, raw$month)
  rain_obs <- do.call(rbind, lapply(unique(key), function(k) {
    g <- raw[key == k, ]
    data.frame(station_id = g$site[1], x = mean(g$x), y = mean(g$y), month = g$month[1],
               rain_mm = mean(g[["Rainfall (mm)"]], na.rm = TRUE) * 30,
               wet_days = sum(g[["Rainfall (mm)"]] > 1, na.rm = TRUE),
               days = sum(!is.na(g[["Rainfall (mm)"]])), stringsAsFactors = FALSE)
  }))
  rain_obs <- rain_obs[rain_obs$days > 0, ]
  rownames(rain_obs) <- NULL
  # Sample-level rows (x, y, site + all original columns, whitespace-normalised headers) for sample_severity().
  samples <- raw
  rownames(samples) <- NULL
  list(rain_obs = rain_obs, quality_obs = quality_obs, samples = samples, origin = origin, epsg = epsg,
       extent = c(xmax = max(raw$x), ymax = max(raw$y)))
}

# Placeholder demand areas inside the region (the real data has none). Population grids
# (WorldPop) must replace this before any claim about people served.
make_demo_settlements <- function(cfg, seed = 1, n = 25) {
  set.seed(seed)
  r <- cfg$region
  s <- data.frame(area_id = sprintf("D%02d", seq_len(n)),
                  x = stats::runif(n, r$xmin, r$xmax), y = stats::runif(n, r$ymin, r$ymax),
                  population = sample(10:40, n, replace = TRUE),
                  access_distance_km = round(stats::runif(n, 0.5, 8), 1))
  s
}
