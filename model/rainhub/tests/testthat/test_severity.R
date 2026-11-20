cfg <- load_config("../../config.yml")

# one-row sample with every parameter at a "clean" value, then override
clean_row <- function(...) {
  base <- data.frame(`Temp (°C)` = 25, pH = 7, `DO (mg/L)` = 8, `COD (mg/L)` = 10,
                     `Nitrate (mg/L)` = 1, `Turbidity (NTU)` = 5, `Phosphate (mg/L)` = 0.1,
                     check.names = FALSE)
  ov <- list(...)
  for (n in names(ov)) base[[n]] <- ov[[n]]
  base
}

test_that("severity_params has the exact columns and weights sum to 1", {
  p <- severity_params(cfg)
  expect_identical(names(p), c("param", "column", "ref", "bad", "direction", "weight"))
  expect_equal(nrow(p), 7)
  expect_equal(sum(p$weight), 1, tolerance = 1e-9)
  expect_true("DO (mg/L)" %in% p$column)
})

test_that("DO: 5 -> 0, 0 -> 1, 12 -> 0 (low is bad)", {
  s <- function(v) sample_severity(clean_row(`DO (mg/L)` = v), cfg)$s_DO
  expect_equal(s(5), 0); expect_equal(s(0), 1); expect_equal(s(12), 0)
  expect_equal(s(2.5), 0.5)
})

test_that("pH: distance outside [6, 9]", {
  s <- function(v) sample_severity(clean_row(pH = v), cfg)$s_pH
  expect_equal(s(7), 0); expect_equal(s(4.5), 0.5); expect_equal(s(3), 1)
  expect_equal(s(11), 2 / 3); expect_equal(s(9), 0); expect_equal(s(1), 1)
})

test_that("high-is-bad parameters clamp to [0, 1]", {
  r <- sample_severity(clean_row(`COD (mg/L)` = -59, `Nitrate (mg/L)` = 367.8), cfg)
  expect_equal(r$s_COD, 0); expect_equal(r$s_nitrate, 1)
})

test_that("NA parameter is ignored and weights renormalise (hand computed)", {
  # only DO = 2.5 (s=0.5) and COD = 62.5 (s=0.5) and nitrate = 7 (s=0); others NA
  d <- clean_row(`DO (mg/L)` = 2.5, `COD (mg/L)` = 62.5, `Nitrate (mg/L)` = 7)
  d[, c(1, 2, 6, 7)] <- NA_real_      # temp, pH, turbidity, phosphate (by position: locale-proof)
  r <- sample_severity(d, cfg)
  expect_equal(r$severity, (0.5 + 0.5 + 0) / 3)       # equal weights renormalised over 3
  expect_true(is.na(r$s_pH))
})

test_that("all parameters NA gives NA severity", {
  d <- clean_row(); d[1, ] <- NA_real_
  expect_true(is.na(sample_severity(d, cfg)$severity))
})

test_that("severity is always within [0, 1]", {
  set.seed(1)
  n <- 500
  d <- data.frame(`Temp (°C)` = runif(n, -10, 60), pH = runif(n, 0, 14),
                  `DO (mg/L)` = runif(n, -5, 20), `COD (mg/L)` = runif(n, -100, 500),
                  `Nitrate (mg/L)` = runif(n, -5, 400), `Turbidity (NTU)` = runif(n, -5, 600),
                  `Phosphate (mg/L)` = runif(n, -1, 90), check.names = FALSE)
  s <- sample_severity(d, cfg)$severity
  expect_true(all(s >= 0 & s <= 1))
})

test_that("raw header names with newlines are normalised", {
  d <- clean_row(); names(d)[3] <- "DO\n(mg/L)"
  d[["DO\n(mg/L)"]] <- 0
  expect_equal(sample_severity(d, cfg)$s_DO, 1)
})

test_that("a missing parameter column is an error naming it", {
  d <- clean_row(); d[["pH"]] <- NULL
  expect_error(sample_severity(d, cfg), "pH")
})

test_that("site_severity averages sample severity per site", {
  d <- rbind(clean_row(`DO (mg/L)` = 0), clean_row(`DO (mg/L)` = 5), clean_row(`DO (mg/L)` = 5))
  d$site <- c("a", "a", "b"); d$lon <- c(1, 3, 10); d$lat <- c(2, 4, 20)
  ss <- site_severity(d, cfg, "site", "lon", "lat")
  expect_identical(names(ss), c("site_id", "x", "y", "n", "s_mean"))
  a <- ss[ss$site_id == "a", ]
  expect_equal(a$n, 2); expect_equal(a$x, 2); expect_equal(a$y, 3)
  s_hi <- sample_severity(clean_row(`DO (mg/L)` = 0), cfg)$severity
  s_lo <- sample_severity(clean_row(`DO (mg/L)` = 5), cfg)$severity
  expect_equal(a$s_mean, (s_hi + s_lo) / 2)
})

test_that("nearest-site fallback returns exact columns, p_severe in [0,1], method attr", {
  sev <- data.frame(site_id = letters[1:3], x = c(10, 30, 50), y = c(10, 30, 50),
                    n = c(5, 8, 3), s_mean = c(0.2, 0.6, 0.9))
  grid <- make_grid(cfg)
  out <- fit_severity_fallback(sev, grid, cfg)
  expect_identical(names(out), c("cell_id", "s_mean", "s_sd", "p_severe"))
  expect_equal(nrow(out), nrow(grid))
  expect_identical(attr(out, "method"), "fallback")
  expect_true(all(out$p_severe >= 0 & out$p_severe <= 1))
  expect_true(all(out$s_sd > 0))
  i <- which.min((grid$x - 10)^2 + (grid$y - 10)^2)
  expect_equal(out$s_mean[i], 0.2)
})

test_that("fit_severity_surface uses the fallback below min_sites_for_spde", {
  sev <- data.frame(site_id = letters[1:3], x = c(10, 30, 50), y = c(10, 30, 50),
                    n = c(5, 8, 3), s_mean = c(0.2, 0.6, 0.9))
  out <- suppressMessages(fit_severity_surface(sev, make_grid(cfg), cfg))
  expect_identical(attr(out, "method"), "fallback")
})

test_that("SPDE surface returns valid columns (needs INLA)", {
  skip_if_not_installed("INLA")
  set.seed(2)
  sev <- data.frame(site_id = 1:25, x = runif(25, 0, 60), y = runif(25, 0, 60), n = 4)
  sev$s_mean <- pmin(pmax(0.3 + 0.01 * sev$x + rnorm(25, 0, 0.05), 0), 1)
  out <- fit_severity_surface(sev, make_grid(cfg), cfg)
  expect_identical(names(out), c("cell_id", "s_mean", "s_sd", "p_severe"))
  expect_identical(attr(out, "method"), "spde")
  expect_true(all(out$p_severe >= 0 & out$p_severe <= 1))
  expect_true(all(out$s_sd > 0))
})

test_that("real data: site severity correlates positively with site-mean WQI", {
  path <- "../../data/real/dhaka_water_quality.csv"
  skip_if(!file.exists(path), "real data file not present")
  raw <- utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
  names(raw) <- gsub("\\s+", " ", names(raw))
  raw <- raw[stats::complete.cases(raw[, c("Latitude", "Longitude")]), ]
  raw$site <- paste(round(raw$Latitude, 4), round(raw$Longitude, 4))
  ss <- site_severity(raw, cfg, "site", "Longitude", "Latitude")
  wqi <- tapply(raw$WQI, raw$site, mean, na.rm = TRUE)
  rho <- stats::cor(ss$s_mean, wqi[ss$site_id], method = "spearman", use = "complete.obs")
  message("Spearman(site severity, site-mean WQI) = ", round(rho, 3))
  expect_gt(rho, 0.3)
})
