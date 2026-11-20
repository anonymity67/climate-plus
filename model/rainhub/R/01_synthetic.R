# Synthetic data generated from known hidden surfaces, so models can be checked.

# Position given as a fraction of the region box (keeps coordinates in config).
.frac_pos <- function(cfg, fx, fy) {
  r <- cfg$region
  list(x = r$xmin + fx * (r$xmax - r$xmin), y = r$ymin + fy * (r$ymax - r$ymin))
}

.bump <- function(x, y, cx, cy, s) exp(-((x - cx)^2 + (y - cy)^2) / (2 * s^2))

# True mean monthly rain (mm): 3 Gaussian bumps plus a linear trend.
.true_rain <- function(x, y, cfg) {
  r <- cfg$region
  w <- r$xmax - r$xmin
  u <- (x - r$xmin) / w
  v <- (y - r$ymin) / (r$ymax - r$ymin)
  centres <- list(c(0.25, 0.30), c(0.70, 0.70), c(0.60, 0.20))
  amp <- c(150, 120, 90)
  b <- 0
  for (i in 1:3) {
    p <- .frac_pos(cfg, centres[[i]][1], centres[[i]][2])
    b <- b + amp[i] * .bump(x, y, p$x, p$y, 0.18 * w)
  }
  60 + 60 * u + b
}

# Hotspot locations (fractions of the region box).
.hotspot_fracs <- list(c(0.30, 0.65), c(0.75, 0.35), c(0.50, 0.50))

# True P(clean): logistic of a smooth surface minus 3 pollution hotspots.
.true_clean <- function(x, y, cfg) {
  r <- cfg$region
  w <- r$xmax - r$xmin
  u <- (x - r$xmin) / w
  v <- (y - r$ymin) / (r$ymax - r$ymin)
  smooth <- 2.5 + 0.8 * sin(2 * pi * u) * cos(pi * v)
  pol <- 0
  for (h in .hotspot_fracs) {
    p <- .frac_pos(cfg, h[1], h[2])
    pol <- pol + 5 * .bump(x, y, p$x, p$y, 0.08 * w)
  }
  plogis(smooth - pol)
}

generate_synthetic <- function(cfg, seed = cfg$seed) {
  set.seed(seed)
  r <- cfg$region
  grid <- make_grid(cfg)
  runif_xy <- function(n) data.frame(x = runif(n, r$xmin, r$xmax),
                                     y = runif(n, r$ymin, r$ymax))

  # Rain: stations observed over wet-season months (Gamma noise around truth).
  st <- runif_xy(cfg$rain$n_stations)
  st$station_id <- sprintf("S%02d", seq_len(nrow(st)))
  months <- 6:9
  rain_obs <- merge(st, data.frame(month = months), by = NULL)
  mu <- .true_rain(rain_obs$x, rain_obs$y, cfg)
  shape <- 6
  rain_obs$rain_mm <- rgamma(nrow(rain_obs), shape = shape, rate = shape / mu)
  rain_obs$days <- 30L
  p_wet <- pmin(0.9, pmax(0.05, mu / 300))
  rain_obs$wet_days <- rbinom(nrow(rain_obs), rain_obs$days, p_wet)
  rain_obs <- rain_obs[order(rain_obs$station_id, rain_obs$month),
                       c("station_id", "x", "y", "month", "rain_mm", "wet_days", "days")]
  rownames(rain_obs) <- NULL

  # Water quality: Binomial tests at random sites.
  q <- runif_xy(cfg$quality$n_sites)
  q$site_id <- sprintf("Q%02d", seq_len(nrow(q)))
  q$tests <- sample(3:8, nrow(q), replace = TRUE)
  q$passes <- rbinom(nrow(q), q$tests, .true_clean(q$x, q$y, cfg))
  quality_obs <- q[, c("site_id", "x", "y", "tests", "passes")]

  # Settlements: random places with population and distance to current water.
  s <- runif_xy(cfg$settlements$n)
  s$area_id <- sprintf("A%02d", seq_len(nrow(s)))
  s$population <- sample(10:40, nrow(s), replace = TRUE)
  s$access_distance_km <- round(runif(nrow(s), 0.5, 8), 1)
  settlements <- s[, c("area_id", "x", "y", "population", "access_distance_km")]

  hs <- do.call(rbind, lapply(.hotspot_fracs, function(h) {
    p <- .frac_pos(cfg, h[1], h[2])
    grid[which.min((grid$x - p$x)^2 + (grid$y - p$y)^2), "cell_id", drop = FALSE]
  }))

  out <- list(
    rain_obs = rain_obs, quality_obs = quality_obs, settlements = settlements,
    truth = list(
      rain_cell = data.frame(cell_id = grid$cell_id, value = .true_rain(grid$x, grid$y, cfg)),
      clean_cell = data.frame(cell_id = grid$cell_id, value = .true_clean(grid$x, grid$y, cfg)),
      hotspots = hs$cell_id
    )
  )
  attr(out, "synthetic") <- TRUE
  out
}
