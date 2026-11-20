test_that("WAI scenarios follow the formula on a hand-built case", {
  need <- data.frame(area_id = c("A", "B"), x = c(1, 9), y = c(1, 9), population = c(100, 100), p_severe = c(1, 0.5))
  alloc <- data.frame(area_id = c("A", "B"), hub_id = c(1L, NA), distance_km = c(1, NA), p_served = c(0.8, 0))
  prio <- data.frame(cell_id = 1, x = 1, y = 1, s_mean = 0.5, pop_exposed = 100, rain_coverage = 0, priority = 50)
  sc <- wai_scenarios(need, alloc, prio, list(exposure_km = 2, cleanup_effect = 1), top_n = 1)
  expect_equal(sc$wai[1], (0 + 50) / 200)                    # baseline: A fully polluted, B half
  expect_equal(sc$wai[2], (0.8 * 100 + 50) / 200)            # hub serves A with R = 0.8
  expect_equal(sc$wai[3], (100 + 50) / 200)                  # cleanup near A restores A
  expect_equal(sc$wai[4], (100 + 50) / 200)
  expect_true(all(diff(c(sc$wai[1], sc$wai[2])) >= 0))
  expect_true(all(sc$wai >= 0 & sc$wai <= 1))
  expect_equal(attr(sc, "cleaned_population"), 100)
  expect_named(sc, c("scenario", "wai", "people_not_exposed", "gain_vs_baseline"))
  se <- wai_sensitivity(need, alloc, prio, list(exposure_km = 2), top_n = 1, effects = c(0, 1))
  expect_equal(se$wai_cleanup_only, c(sc$wai[1], (100 + 50) / 200))
  expect_equal(se$wai_hubs_and_cleanup[1], sc$wai[2])
})
test_that("WAI uses the served share when areas are split", {
  need <- data.frame(area_id = "A", x = 0, y = 0, population = 1000, p_severe = 1)
  alloc <- data.frame(area_id = "A", hub_id = 1L, distance_km = 1, p_served = 0.9, served_people = 100)
  prio <- data.frame(cell_id = 1, x = 50, y = 50, s_mean = 0.5, pop_exposed = 0, rain_coverage = 0, priority = 0)
  sc <- wai_scenarios(need, alloc, prio, list(exposure_km = 5))
  expect_equal(sc$wai[2], 0.9 * 0.1)
})
test_that("default cleanup effect halves E in cleaned areas", {
  need <- data.frame(area_id = "A", x = 0, y = 0, population = 100, p_severe = 0.8)
  alloc <- data.frame(area_id = "A", hub_id = NA_integer_, distance_km = NA_real_, p_served = 0)
  prio <- data.frame(cell_id = 1, x = 0, y = 0, s_mean = 0.5, pop_exposed = 100, rain_coverage = 0, priority = 10)
  sc <- wai_scenarios(need, alloc, prio, list(exposure_km = 1), top_n = 1)
  expect_equal(sc$wai[3], 1 - 0.4)
})
test_that("hub_scaleup covers the most exposed first and is capped by the population", {
  need <- data.frame(area_id = c("A", "B"), x = 0, y = 0, population = c(1000, 1000), p_severe = c(0.2, 1))
  su <- hub_scaleup(need, list(hub_capacity_people = 500), reliability = 0.8, n_hubs = c(1, 2, 10))
  expect_equal(su$people_covered, c(500, 1000, 2000))
  expect_equal(su$gain_vs_baseline, 0.8 * c(500, 1000, 1000 + 0.2 * 1000) / 2000)
  expect_true(all(diff(su$wai) >= 0))
})
