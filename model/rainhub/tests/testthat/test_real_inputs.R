test_that("chirps_to_rain_obs combines monthly totals and daily wet fractions", {
  d <- list(origin = c(0, 0), epsg = 32646)
  hdr <- data.frame(time = "UTC", latitude = "degrees_north", longitude = "degrees_east", precip = "mm/day")
  cells <- expand.grid(latitude = c(23.725, 23.775), longitude = 90.375)
  # monthly: 3 years x 12 months; Jun-Aug 300 mm, otherwise 20 mm  (annual 1020)
  mo <- expand.grid(i = seq_len(nrow(cells)), y = 2018:2020, m = 1:12)
  mon <- data.frame(time = sprintf("%d-%02d-01T00:00:00Z", mo$y, mo$m), cells[mo$i, ],
                    precip = ifelse(mo$m %in% 6:8, 300, 20))
  fm <- tempfile(fileext = ".csv"); utils::write.csv(rbind(setNames(hdr, names(mon)), mon), fm, row.names = FALSE)
  days <- seq(as.Date("2020-01-01"), as.Date("2020-12-31"), by = "day")
  g <- expand.grid(time = days, i = seq_len(nrow(cells)))
  dly <- data.frame(time = paste0(format(g$time), "T00:00:00Z"), cells[g$i, ],
                    precip = ifelse(as.integer(format(g$time, "%m")) %in% 6:8, 10, 0))
  fd <- tempfile(fileext = ".csv"); utils::write.csv(rbind(hdr, dly), fd, row.names = FALSE)
  r <- chirps_to_rain_obs(fm, fd, d)
  expect_equal(nrow(r), 2 * 12)
  expect_named(r, c("station_id", "x", "y", "month", "rain_mm", "wet_days", "days"))
  one <- r[r$station_id == r$station_id[1], ]
  expect_equal(one$rain_mm[one$month == 6], 300)
  expect_equal(one$wet_days[one$month == 6], one$days[one$month == 6])
  expect_equal(one$wet_days[one$month == 1], 0)
  expect_equal(sum(one$days), 365)
})

test_that("chirps_to_rain_obs rejects wrong units and missing columns", {
  d <- list(origin = c(0, 0), epsg = 32646)
  f <- tempfile(fileext = ".csv"); utils::write.csv(data.frame(a = 1), f, row.names = FALSE)
  expect_error(chirps_to_rain_obs(f, f, d), "precip")
  expect_error(chirps_to_rain_obs("nope.csv", f, d), "not found")
})

test_that("worldpop_to_settlements sums blocks, filters to the region and ranks by population", {
  skip_if_not_installed("terra")
  r <- terra::rast(nrows = 10, ncols = 10, xmin = 90.30, xmax = 90.40, ymin = 23.70, ymax = 23.80, crs = "EPSG:4326")
  terra::values(r) <- 100
  r[1, 1] <- 5000
  f <- tempfile(fileext = ".tif"); terra::writeRaster(r, f)
  d <- list(origin = c(0, 0), epsg = 32646)
  all_region <- list(xmin = -1e6, xmax = 1e6, ymin = -1e6, ymax = 1e6)
  s <- worldpop_to_settlements(f, d, all_region, fact = 2, min_pop = 0, n = 100)
  expect_equal(nrow(s), 25)
  expect_equal(sum(s$population), 5000 - 100 + 100 * 100)   # nothing lost by aggregation
  expect_equal(s$area_id[1], "W01"); expect_equal(max(s$population), s$population[1])
  expect_named(s, c("area_id", "x", "y", "population", "access_distance_km"))
  expect_error(worldpop_to_settlements(f, d, list(xmin = 0, xmax = 1, ymin = 0, ymax = 1), min_pop = 0), "No WorldPop")
})
