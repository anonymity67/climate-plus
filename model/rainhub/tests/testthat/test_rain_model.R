cfg <- load_config("../../config.yml")
d <- generate_synthetic(cfg, 1)
grid <- make_grid(cfg)

# Fit once and reuse (INLA fits take a while). Only called after skip_if_not_installed("INLA").
.cache <- new.env()
get_fit <- function() {
  if (is.null(.cache$fit)) .cache$fit <- fit_rain_surface(d$rain_obs, grid, cfg)
  .cache$fit
}

test_that("fit_rain_surface fails clearly when INLA is missing", {
  skip_if(requireNamespace("INLA", quietly = TRUE), "INLA is installed")
  expect_error(fit_rain_surface(d$rain_obs, grid, cfg), "R-INLA")
  expect_error(make_mesh(cfg, d$rain_obs), "R-INLA")
})

test_that("rain surface has one row per cell and no NaN", {
  skip_if_not_installed("INLA")
  fit <- get_fit()
  expect_equal(nrow(fit), nrow(grid))
  expect_identical(fit$cell_id, grid$cell_id)
  expect_identical(names(fit), c("cell_id", "mean_mm", "sd_mm", "p_wet", "p_wet_sd"))
  expect_false(anyNA(fit))
  expect_true(all(is.finite(as.matrix(fit))))
})

test_that("mean_mm tracks the true rainfall surface", {
  skip_if_not_installed("INLA")
  fit <- get_fit()
  expect_gte(cor(fit$mean_mm, d$truth$rain_cell$value), 0.7)
})

test_that("sd_mm is larger far from stations than near them", {
  skip_if_not_installed("INLA")
  fit <- get_fit()
  st <- unique(d$rain_obs[, c("x", "y")])
  dist <- vapply(seq_len(nrow(grid)), function(i) {
    min(sqrt((st$x - grid$x[i])^2 + (st$y - grid$y[i])^2))
  }, numeric(1))
  far <- dist >= quantile(dist, 0.9)
  near <- dist <= quantile(dist, 0.1)
  expect_gt(mean(fit$sd_mm[far]), mean(fit$sd_mm[near]))
})

test_that("a station with zero rain in every month does not break the fit", {
  skip_if_not_installed("INLA")
  r <- d$rain_obs
  r$rain_mm[r$station_id == "S01"] <- 0
  r$wet_days[r$station_id == "S01"] <- 0L
  fit <- NULL
  expect_no_error(fit <- fit_rain_surface(r, grid, cfg))
  expect_false(anyNA(fit))
  expect_true(all(is.finite(as.matrix(fit))))
})
