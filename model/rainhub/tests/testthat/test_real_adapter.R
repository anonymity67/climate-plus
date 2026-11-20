write_fixtures <- function(dir) {
  rain <- data.frame(Stn = c("A", "B", "C"), lon_km = c(1, 2, 3), lat_km = c(4, 5, 6),
                     mon = c(7, 7, 8), total_mm = c(300, 250, 0),
                     rain_days = c(20, 18, 0), n_days = c(31, 31, 31))
  qual <- data.frame(Site = c("s1", "s2"), lon_km = c(1, 2), lat_km = c(1, 2),
                     n_samples = c(5, 4), n_ok = c(3, 4))
  sett <- data.frame(Village = c("v1", "v2"), lon_km = c(1, 2), lat_km = c(3, 4),
                     pop = c(100, 200), dist_safe_km = c(2.5, 4))
  write.csv(rain, file.path(dir, "rain.csv"), row.names = FALSE)
  write.csv(qual, file.path(dir, "qual.csv"), row.names = FALSE)
  write.csv(sett, file.path(dir, "sett.csv"), row.names = FALSE)
  list(rain = file.path(dir, "rain.csv"), qual = file.path(dir, "qual.csv"),
       sett = file.path(dir, "sett.csv"))
}

mapping <- list(
  station_id = "Stn", x = "lon_km", y = "lat_km", month = "mon", rain_mm = "total_mm",
  wet_days = "rain_days", days = "n_days",
  site_id = "Site", tests = "n_samples", passes = "n_ok",
  area_id = "Village", population = "pop", access_distance_km = "dist_safe_km")

test_that("renamed columns load into the exact shared column names", {
  p <- write_fixtures(tempfile("fx")  |> (\(d) { dir.create(d); d })())
  r <- load_real_data(p$rain, p$qual, p$sett, mapping)
  expect_identical(names(r$rain_obs),
                   c("station_id", "x", "y", "month", "rain_mm", "wet_days", "days"))
  expect_identical(names(r$quality_obs), c("site_id", "x", "y", "tests", "passes"))
  expect_identical(names(r$settlements),
                   c("area_id", "x", "y", "population", "access_distance_km"))
  expect_equal(r$rain_obs$rain_mm, c(300, 250, 0))
  expect_equal(r$quality_obs$passes, c(3, 4))
})

test_that("columns not in the mapping are assumed to have the shared name", {
  d <- tempfile("fx"); dir.create(d)
  p <- write_fixtures(d)
  write.csv(data.frame(station_id = "A", x = 1, y = 2, month = 7, rain_mm = 10,
                       wet_days = 3, days = 31), p$rain, row.names = FALSE)
  write.csv(data.frame(site_id = "s1", x = 1, y = 2, tests = 5, passes = 2),
            p$qual, row.names = FALSE)
  write.csv(data.frame(area_id = "v", x = 1, y = 2, population = 9,
                       access_distance_km = 1), p$sett, row.names = FALSE)
  r <- load_real_data(p$rain, p$qual, p$sett, mapping = list())
  expect_equal(r$quality_obs$site_id, "s1")
  expect_equal(r$settlements$population, 9)
})

test_that("a missing mapped column errors and names it", {
  d <- tempfile("fx"); dir.create(d)
  p <- write_fixtures(d)
  q <- read.csv(p$qual); q$n_ok <- NULL
  write.csv(q, p$qual, row.names = FALSE)
  expect_error(load_real_data(p$rain, p$qual, p$sett, mapping), "passes")
})

test_that("rows with NA coordinates are dropped and counted in a message", {
  d <- tempfile("fx"); dir.create(d)
  p <- write_fixtures(d)
  r <- read.csv(p$rain); r$lon_km[2] <- NA
  write.csv(r, p$rain, row.names = FALSE)
  expect_message(out <- load_real_data(p$rain, p$qual, p$sett, mapping),
                 "Dropped 1 row")
  expect_equal(nrow(out$rain_obs), 2)
})

test_that("derive_pass_fail counts samples and passes per site", {
  df <- data.frame(site = c("a", "a", "a", "b", "b", "b"),
                   lon = c(1, 1, 1, 2, 2, 2), lat = c(5, 5, 5, 6, 6, 6),
                   do_mgl = c(6, 4, 5, 2, NA, 3))
  above <- derive_pass_fail(df, "do_mgl", 5, "above", "site", "lon", "lat")
  expect_identical(names(above), c("site_id", "x", "y", "tests", "passes"))
  expect_equal(above$tests, c(3, 2))      # NA sample not counted
  expect_equal(above$passes, c(2, 0))     # 6 and 5 meet >= 5
  below <- derive_pass_fail(df, "do_mgl", 4, "below", "site", "lon", "lat")
  expect_equal(below$passes, c(1, 2))     # 4 meets <= 4; 2 and 3 meet it
  expect_true(all(above$passes <= above$tests))
})
