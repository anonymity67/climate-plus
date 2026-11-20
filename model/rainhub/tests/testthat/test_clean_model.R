cfg <- load_config("../../config.yml")
d <- generate_synthetic(cfg, 1)
grid <- make_grid(cfg)

.cache <- new.env()
get_fit <- function() {
  if (is.null(.cache$fit)) .cache$fit <- fit_clean_surface(d$quality_obs, grid, cfg)
  .cache$fit
}

# ---- Tests that run without INLA ----

test_that("status rule: clean, polluted, unknown", {
  thr <- cfg$thresholds$clean_p                      # 0.80
  lower <- c(0.82, 0.10, 0.60, 0.05)
  upper <- c(0.95, 0.35, 0.90, 0.30)
  expect_identical(.clean_status(lower, upper, cfg),
                   c("clean", "polluted", "unknown", "polluted"))
})

test_that("an interval that spans the threshold is unknown", {
  expect_identical(.clean_status(0.70, 0.90, cfg), "unknown")
})

test_that("an interval wider than max_interval is unknown even if it clears the threshold", {
  cfg2 <- cfg
  cfg2$thresholds$max_interval <- 0.10
  expect_identical(.clean_status(0.80, 0.95, cfg2), "unknown")   # width 0.15 > 0.10
  expect_identical(.clean_status(0.05, 0.30, cfg2), "unknown")   # polluted but too wide
})

test_that("with only 8 sites the fallback is used, says so, and does not error", {
  q8 <- d$quality_obs[1:8, ]
  res <- NULL
  expect_message(res <- fit_clean_surface(q8, grid, cfg), "fallback")
  expect_identical(attr(res, "method"), "fallback")
  expect_equal(nrow(res), nrow(grid))
  expect_identical(names(res), c("cell_id", "p_clean", "lower", "upper", "status"))
  expect_true(all(res$lower <= res$p_clean & res$p_clean <= res$upper))
  expect_true(all(res$status %in% c("clean", "polluted", "unknown")))
  expect_false(anyNA(res))
})

test_that("fallback takes the Beta-Binomial update of the nearest site", {
  q <- data.frame(site_id = c("a", "b"), x = c(0, 60), y = c(0, 60),
                  tests = c(4, 30), passes = c(4, 0))
  g <- data.frame(cell_id = 1:2, x = c(1, 59), y = c(1, 59))
  res <- fit_clean_fallback(q, g, cfg)
  expect_equal(res$p_clean, c(5 / 6, 1 / 32))
  expect_equal(res$lower[1], qbeta(0.025, 5, 1))
  expect_identical(res$status[1], "unknown")   # Beta(5,1): interval too wide
  expect_identical(res$status[2], "polluted")  # Beta(1,31): upper ~0.11, width < 0.30
})

test_that("fit_clean_surface fails clearly when INLA is missing and sites >= 10", {
  skip_if(requireNamespace("INLA", quietly = TRUE), "INLA is installed")
  expect_error(fit_clean_surface(d$quality_obs, grid, cfg), "R-INLA")
})

test_that("missing columns are named in the error", {
  expect_error(fit_clean_surface(d$quality_obs[, c("site_id", "x", "y", "tests")], grid, cfg), "passes")
})

# ---- Tests that need INLA (run on the team's computer) ----

test_that("p_clean tracks the true cleanliness surface", {
  skip_if_not_installed("INLA")
  res <- get_fit()
  expect_identical(attr(res, "method"), "spde")
  expect_gte(cor(res$p_clean, d$truth$clean_cell$value), 0.7)
})

test_that("cells whose interval spans the threshold are unknown", {
  skip_if_not_installed("INLA")
  res <- get_fit()
  thr <- cfg$thresholds$clean_p
  spans <- res$lower < thr & res$upper >= thr
  expect_true(all(res$status[spans] == "unknown"))
  wide <- (res$upper - res$lower) > cfg$thresholds$max_interval
  expect_true(all(res$status[wide] == "unknown"))
  expect_true(all(res$status[res$status == "clean"] == "clean" & res$lower[res$status == "clean"] >= thr))
})

test_that("lower <= p_clean <= upper everywhere and all values are probabilities", {
  skip_if_not_installed("INLA")
  res <- get_fit()
  expect_equal(nrow(res), nrow(grid))
  expect_true(all(res$lower <= res$p_clean & res$p_clean <= res$upper))
  expect_true(all(res$lower >= 0 & res$upper <= 1))
  expect_false(anyNA(res))
})
