test_that("xy_to_lonlat undoes the projection", {
  d <- list(epsg = 32646, origin = c(0, 0))
  p <- sf::st_transform(sf::st_as_sf(data.frame(lon = 90.4, lat = 23.8), coords = c("lon", "lat"), crs = 4326), 32646)
  m <- sf::st_coordinates(p) / 1000
  d$origin <- c(m[1] - 5, m[2] - 7)
  r <- xy_to_lonlat(5, 7, d)
  expect_equal(r$lon, 90.4, tolerance = 1e-4); expect_equal(r$lat, 23.8, tolerance = 1e-4)
})
test_that("platform_data carries the run and the WAI inputs", {
  f <- film_fixture()
  f$d$epsg <- 32646; f$d$origin <- c(300, 2600); f$res$need$s_mean <- c(0.5, 0.2); f$res$sev_obs <- data.frame(site_id = c("a", "b"), x = c(1, 3), y = c(1, 3), n = c(10, 10), s_mean = c(0.4, 0.2)); f$res$severity$p_severe <- c(0.8, 0.5, 0.3, 0.2)
  f$res$cfg$severity$params <- list(DO = list(column = "DO (mg/L)", direction = "low_is_bad", ref = 5, bad = 0, weight = 1))
  f$res$cfg$hub_tank_l <- 1e6
  j <- platform_data(f$res, f$d)
  expect_equal(nrow(j$blocks), 2); expect_equal(nrow(j$hubs), 1)
  expect_equal(j$blocks$pop, c(1000, 3000)); expect_equal(j$blocks$c[1], 0.9 * 0.5)
  # the platform recomputes WAI = sum(pop*((1-e)+e*c))/sum(pop): it must equal the R value
  w <- sum(j$blocks$pop * ((1 - j$blocks$e) + j$blocks$e * j$blocks$c)) / sum(j$blocks$pop)
  expect_equal(w, f$res$wai$wai[2])
  expect_equal(nrow(j$sites), 2); expect_equal(j$sites$n, c(10, 10))
  expect_equal(j$meta$samples, 20); expect_equal(j$meta$pass_pct, 15); expect_equal(j$meta$exposed, 1400)
  expect_null(j$cells$rain_mm_year)
  expect_equal(j$params[[1]]$name, "DO")
  expect_equal(j$hubs$served, 500)
})
test_that("export_platform writes valid json", {
  skip_if_not_installed("jsonlite")
  f <- film_fixture(); f$d$epsg <- 32646; f$d$origin <- c(300, 2600); f$res$need$s_mean <- c(0.5, 0.2); f$res$sev_obs <- data.frame(site_id = c("a", "b"), x = c(1, 3), y = c(1, 3), n = c(10, 10), s_mean = c(0.4, 0.2)); f$res$severity$p_severe <- c(0.8, 0.5, 0.3, 0.2)
  f$res$cfg$severity$params <- list(DO = list(column = "DO (mg/L)", direction = "low_is_bad", ref = 5, bad = 0, weight = 1)); f$res$cfg$hub_tank_l <- 1e6
  p <- export_platform(f$res, f$d, tempfile(fileext = ".json"))
  j <- jsonlite::fromJSON(p); expect_equal(nrow(j$blocks), 2); expect_equal(j$meta$tau, 0.35)
})

test_that("platform_data carries annual rain per cell and the monthly pattern when the run has them", {
  f <- film_fixture(); f$d$epsg <- 32646; f$d$origin <- c(300, 2600); f$res$need$s_mean <- c(0.5, 0.2)
  f$res$severity$p_severe <- c(0.8, 0.5, 0.3, 0.2)
  f$res$sev_obs <- data.frame(site_id = "a", x = 1, y = 1, n = 3, s_mean = 0.3)
  f$res$cfg$severity$params <- list(DO = list(column = "DO", direction = "low_is_bad", ref = 5, bad = 0, weight = 1)); f$res$cfg$hub_tank_l <- 1e6
  f$res$rain <- data.frame(cell_id = f$res$grid$cell_id, mean_mm = c(100, 150, 200, 250))
  f$res$cfg$season <- list(monthly_mm = c(10, 20, 60, 220, 330, 400, 380, 330, 300, 150, 30, 8))
  j <- platform_data(f$res, f$d)
  expect_equal(sort(j$cells$rain_mm_year), c(1200, 1800, 2400, 3000))
  expect_equal(j$meta$monthly_mm[6], 400)
})
