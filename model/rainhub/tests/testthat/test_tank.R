args <- list(mean_mm = 250, sd_mm = 40, p_wet = 0.4, roof_m2 = 50, demand_l_day = 150)

test_that("reliability rises monotonically with tank size", {
  sizes <- c(500, 2000, 5000, 10000, 20000)
  r <- sapply(sizes, function(t) do.call(tank_reliability, c(args, list(tank_l = t))))
  expect_true(all(diff(r) >= 0))
  expect_true(r[length(r)] > r[1])
})

test_that("zero demand gives reliability 1", {
  a <- modifyList(args, list(demand_l_day = 0))
  expect_equal(do.call(tank_reliability, c(a, list(tank_l = 1000))), 1)
})

test_that("zero rain gives reliability 0 for positive demand", {
  a <- modifyList(args, list(mean_mm = 0, sd_mm = 0, demand_l_day = 500))
  expect_equal(do.call(tank_reliability, c(a, list(tank_l = 5000))), 0)
})

test_that("reliability is in [0, 1]", {
  r <- do.call(tank_reliability, c(args, list(tank_l = 3000)))
  expect_true(r >= 0 && r <= 1)
})

test_that("min_tank_size returns NA when rain is zero", {
  a <- modifyList(args, list(mean_mm = 0, sd_mm = 0, demand_l_day = 500))
  expect_true(is.na(do.call(min_tank_size, a)))
})

test_that("min_tank_size returns a size that meets the target", {
  s <- do.call(min_tank_size, c(args, list(target = 0.5)))
  expect_false(is.na(s))
  expect_true(do.call(tank_reliability, c(args, list(tank_l = s))) >= 0.5)
})

test_that("500 draws x 120 days runs in under 2 seconds", {
  t <- system.time(do.call(tank_reliability, c(args, list(tank_l = 5000))))[["elapsed"]]
  expect_lt(t, 2)
})

test_that("seasonal tank: dry season decides reliability and a bigger tank helps", {
  season <- list(mult = c(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 9) / 1 * 1, wet_mult = rep(1, 12), start_month = 1)
  season$mult <- season$mult / mean(season$mult)       # all rain in Nov-Dec, none in Jan-Oct
  r_small <- tank_reliability(150, 1, 0.4, 1000, 10000, 500, season = season)
  r_big   <- tank_reliability(150, 1, 0.4, 1000, 2e6,   500, season = season)
  expect_equal(r_small, 0)
  expect_gt(r_big, r_small)
  expect_equal(tank_reliability(150, 1, 0.4, 1000, 1e6, 500, season = season), tank_reliability(150, 1, 0.4, 1000, 1e6, 500, season = season))
  flat <- list(mult = rep(1, 12), wet_mult = rep(1, 12), start_month = 1)
  expect_gte(tank_reliability(300, 1, 0.5, 3000, 20000, 500, season = flat), 0.9)
})
test_that("season_profile needs 12 months and averages to 1", {
  ro <- data.frame(month = rep(1:12, 2), rain_mm = rep(c(10, 20, 30, 40, 100, 300, 400, 300, 200, 100, 20, 10), 2),
                   wet_days = 5, days = 30)
  sp <- season_profile(ro); expect_equal(mean(sp$mult), 1); expect_equal(sp$start_month, 9)  # wet peak May-Jul/Jun-Aug
  expect_null(season_profile(ro[ro$month < 12, ]))
})

test_that("seasonal reliability barely depends on the starting month (year 1 is a warm-up)", {
  mm <- c(9, 15, 67, 222, 333, 341, 461, 306, 270, 234, 26, 17)
  mk <- function(start) list(mult = mm / mean(mm), wet_mult = rep(1, 12), start_month = start)
  r <- vapply(c(1, 5, 8, 11), function(s) tank_reliability(192, 1.5, 0.33, 20000, 12e6, 75000, n_draws = 2000, season = mk(s)), numeric(1))
  expect_lt(diff(range(r)), 0.05)
  expect_equal(tank_reliability(192, 1.5, 0.33, 20000, 20000, 75000, season = mk(8)), 0)   # a 20,000 L tank cannot bridge the dry season
})
test_that("min_tank_size (binary search) agrees with a plain scan", {
  sizes <- seq(1000, 20000, by = 1000)
  scan <- NA_real_
  for (s in sizes) if (tank_reliability(150, 20, 0.4, 100, s, 300) >= 0.9) { scan <- s; break }
  expect_equal(min_tank_size(150, 20, 0.4, 100, 300, target = 0.9, sizes = sizes), scan)
  expect_true(is.na(min_tank_size(1, 0, 0.1, 1, 5000, sizes = sizes)))
})
