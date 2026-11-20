cfg <- load_config("../../config.yml")

test_that("synthetic data has the agreed columns", {
  d <- generate_synthetic(cfg, 1)
  expect_identical(names(d$rain_obs),
    c("station_id", "x", "y", "month", "rain_mm", "wet_days", "days"))
  expect_identical(names(d$quality_obs), c("site_id", "x", "y", "tests", "passes"))
  expect_identical(names(d$settlements),
    c("area_id", "x", "y", "population", "access_distance_km"))
  expect_true(isTRUE(attr(d, "synthetic")))
})

test_that("passes never exceed tests", {
  d <- generate_synthetic(cfg, 1)
  expect_true(all(d$quality_obs$passes <= d$quality_obs$tests))
})

test_that("same seed gives identical data", {
  expect_identical(generate_synthetic(cfg, 7), generate_synthetic(cfg, 7))
})

test_that("truth hotspots are polluted", {
  d <- generate_synthetic(cfg, 1)
  cc <- d$truth$clean_cell
  expect_length(d$truth$hotspots, 3)
  expect_lt(mean(cc$value[cc$cell_id %in% d$truth$hotspots]), mean(cc$value))
  expect_equal(nrow(cc), nrow(make_grid(cfg)))
})
