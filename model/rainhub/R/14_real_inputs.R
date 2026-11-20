# Real rainfall (CHIRPS) and real population (WorldPop) -> the pipeline's shared tables.
# Both are optional: run_real.R uses them when the files exist (see scripts/fetch_real_inputs.R)
# and falls back to the old placeholders otherwise, and says which one it used.
#
#  * CHIRPS: satellite+station rainfall (monthly totals 2017-2021; wet days from daily 2020), 0.05 deg (~5 km). One row per CHIRPS cell and
#    calendar month, so the existing rain model sees ~80 "stations" instead of sampling-day rain.
#  * WorldPop: people per grid cell. Summed into coarser blocks that act as demand areas.
# Known limits: CHIRPS is a satellite estimate, not a gauge; WorldPop is a modelled estimate.

# monthly_csv: ERDDAP CHIRPS MONTHLY csv (time, latitude, longitude, precip in mm/month), several years.
# daily_csv:   ERDDAP CHIRPS DAILY csv for one full year (same columns, mm/day), used only for the
#              wet-day fraction of each cell-month. (The ERDDAP daily series is sparse before 2020.)
# d: output of prepare_dhaka_data() (needs $origin, $epsg). Returns the rain_obs schema.
.read_erddap <- function(path) {
  if (!file.exists(path)) stop("CHIRPS file not found: ", path, call. = FALSE)
  raw <- utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
  need <- c("time", "latitude", "longitude", "precip")
  miss <- setdiff(need, names(raw))
  if (length(miss)) stop("CHIRPS file ", basename(path), " is missing column(s): ", paste(miss, collapse = ", "),
                         ". Found: ", paste(names(raw), collapse = ", "), call. = FALSE)
  raw <- raw[raw$time != "UTC", need]                       # ERDDAP's units row
  for (nm in c("latitude", "longitude", "precip")) raw[[nm]] <- suppressWarnings(as.numeric(raw[[nm]]))
  raw <- raw[stats::complete.cases(raw) & raw$precip >= 0, ]  # missing is NaN / -9999
  if (nrow(raw) == 0) stop("CHIRPS file ", basename(path), " has no usable rows", call. = FALSE)
  day <- as.Date(substr(raw$time, 1, 10))
  raw$year <- as.integer(format(day, "%Y")); raw$month <- as.integer(format(day, "%m"))
  raw$cell <- sprintf("chirps_%.3f_%.3f", raw$latitude, raw$longitude)
  raw
}

chirps_to_rain_obs <- function(monthly_csv, daily_csv, d, wet_mm = 1) {
  m <- .read_erddap(monthly_csv); dd <- .read_erddap(daily_csv)
  mon <- stats::aggregate(precip ~ cell + latitude + longitude + month, m, mean)   # mean over years
  names(mon)[names(mon) == "precip"] <- "rain_mm"
  wet <- stats::aggregate(I(precip > wet_mm) ~ cell + month, dd, mean)
  names(wet)[3] <- "wet_frac"
  out <- merge(mon, wet, by = c("cell", "month"))
  if (nrow(out) == 0) stop("Monthly and daily CHIRPS files share no cells", call. = FALSE)
  ann <- mean(tapply(out$rain_mm, out$cell, sum))
  if (ann < 300 || ann > 6000) stop("Annual rain ", round(ann), " mm looks wrong for the monthly file: check its units (expected mm/month)", call. = FALSE)
  dim <- c(31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[out$month]
  out$days <- round(dim)                                    # one year of days in total
  out$wet_days <- round(out$wet_frac * out$days)

  pts <- sf::st_transform(sf::st_as_sf(out, coords = c("longitude", "latitude"), crs = 4326), d$epsg)
  xy <- sf::st_coordinates(pts) / 1000
  r <- data.frame(station_id = out$cell, x = xy[, 1] - d$origin[1], y = xy[, 2] - d$origin[2],
                  month = out$month, rain_mm = out$rain_mm, wet_days = out$wet_days, days = out$days,
                  stringsAsFactors = FALSE)
  r <- r[order(r$station_id, r$month), ]; rownames(r) <- NULL; r
}

# tif: WorldPop people-per-cell GeoTIFF (EPSG:4326). Sums `fact` x `fact` cells into one demand
# area, keeps blocks inside `region` (km box, same frame as the grid) with at least min_pop people,
# and returns the n biggest (n = Inf: every such block, the whole study-area population).
# area_ids W01, W02, ... run from the most to the least populated.
# access_distance_km has no real source here, so it is a constant placeholder (5); ties in the
# allocation therefore go to the more populated area (lower id).
worldpop_to_settlements <- function(tif, d, region, fact = 2, min_pop = 500, n = 40) {
  if (!file.exists(tif)) stop("WorldPop file not found: ", tif, call. = FALSE)
  r <- terra::rast(tif)
  r <- terra::aggregate(r, fact = fact, fun = "sum", na.rm = TRUE)
  v <- terra::as.data.frame(r, xy = TRUE, na.rm = TRUE)
  names(v) <- c("lon", "lat", "pop")
  pts <- sf::st_transform(sf::st_as_sf(v, coords = c("lon", "lat"), crs = 4326), d$epsg)
  xy <- sf::st_coordinates(pts) / 1000
  v$x <- xy[, 1] - d$origin[1]; v$y <- xy[, 2] - d$origin[2]
  v <- v[v$x >= region$xmin & v$x <= region$xmax & v$y >= region$ymin & v$y <= region$ymax &
           v$pop >= min_pop, ]
  if (nrow(v) == 0) stop("No WorldPop block inside the region with at least ", min_pop, " people", call. = FALSE)
  v <- utils::head(v[order(-v$pop), ], n)
  s <- data.frame(area_id = sprintf("W%0*d", max(2, nchar(nrow(v))), seq_len(nrow(v))), x = v$x, y = v$y,
                  population = round(v$pop), access_distance_km = 5, stringsAsFactors = FALSE)
  attr(s, "source") <- "WorldPop"
  s
}

# Monthly rain profile for the seasonal tank simulation, from a rain_obs table with a `month` column
# (needs all 12 months). Region-wide: the profile is the same for every cell, the cell's own level
# comes from the fitted surface. start_month = the month after the wettest 3-month window ends
# (the tank is assumed full then).
season_profile <- function(rain_obs) {
  if (!all(1:12 %in% rain_obs$month)) return(NULL)
  mm <- vapply(1:12, function(m) mean(rain_obs$rain_mm[rain_obs$month == m]), numeric(1))
  wf <- vapply(1:12, function(m) { g <- rain_obs[rain_obs$month == m, ]; sum(g$wet_days) / sum(g$days) }, numeric(1))
  win <- vapply(1:12, function(m) sum(mm[((m - 1):(m + 1)) %% 12 + 1]), numeric(1))
  end_month <- (which.max(win) + 1) %% 12 + 1
  list(mult = mm / mean(mm), wet_mult = wf / (sum(rain_obs$wet_days) / sum(rain_obs$days)),
       start_month = end_month %% 12 + 1, monthly_mm = mm)
}
