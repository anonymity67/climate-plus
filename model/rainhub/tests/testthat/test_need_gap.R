# Hand-built fixtures: 10 x 10 grid of 1 km cells (centres 0.5 .. 9.5), 3 settlements.
ng_grid <- expand.grid(x = 1:10 - 0.5, y = 1:10 - 0.5)
ng_grid$cell_id <- seq_len(nrow(ng_grid))
ng_grid <- ng_grid[, c("cell_id", "x", "y")]
# Cell (1.5, 1.5) is id 12, (2.5, 1.5) is id 13, (9.5, 9.5) is id 100.
ng_sev <- data.frame(cell_id = ng_grid$cell_id, s_mean = 0.1, s_sd = 0.05, p_severe = 0.1)
ng_sev$s_mean[12] <- 0.5; ng_sev$p_severe[12] <- 0.5
ng_sev$s_mean[13] <- 0.4; ng_sev$p_severe[13] <- 0.2
ng_sev$s_mean[100] <- 0.9; ng_sev$p_severe[100] <- 1.0
ng_set <- data.frame(area_id = c("A", "B", "C"), x = c(1.6, 2.4, 9.4), y = c(1.4, 1.6, 9.6),
                     population = c(100, 200, 50), access_distance_km = c(3, 2, 1),
                     stringsAsFactors = FALSE)
ng_alloc <- data.frame(area_id = c("A", "B", "C"), hub_id = c(5L, NA, 7L),
                       distance_km = c(1, NA, 2), p_served = c(0.8, 0, 0.5))
ng_cfg <- list(exposure_km = 2)

test_that("compute_need joins nearest cell and multiplies pop by p_severe", {
  n <- compute_need(ng_set, ng_sev, ng_grid)
  expect_true(all(c("cell_id", "s_mean", "p_severe", "need") %in% names(n)))
  expect_true(all(names(ng_set) %in% names(n)))
  expect_equal(n$cell_id, c(12L, 13L, 100L))
  expect_equal(n$s_mean, c(0.5, 0.4, 0.9))
  expect_equal(n$need, c(50, 40, 50))
})

test_that("compute_gap: gap, served people and percent need met", {
  g <- compute_gap(compute_need(ng_set, ng_sev, ng_grid), ng_alloc)
  expect_named(g, c("area_id", "population", "need", "served_people", "gap", "pct_need_met"))
  expect_equal(g$served_people, c(80, 0, 25))
  expect_equal(g$gap, c(10, 40, 25))           # gap = need x (1 - cover): A 50 x 0.2, B 40 x 1, C 50 x 0.5
  expect_equal(g$pct_need_met, c(80, 0, 50))
})

test_that("compute_gap: need 0 gives 100 percent met; rows follow need", {
  n <- compute_need(ng_set, ng_sev, ng_grid); n$need[2] <- 0
  g <- compute_gap(n[3:1, ], ng_alloc)
  expect_equal(g$area_id, c("C", "B", "A"))
  expect_equal(g$pct_need_met[g$area_id == "B"], 100)
  expect_equal(g$gap[g$area_id == "B"], 0)
})

test_that("cleanup_priority: formula, every cell, sorted descending", {
  n <- compute_need(ng_set, ng_sev, ng_grid)
  p <- cleanup_priority(ng_sev, n, ng_grid, ng_alloc, ng_cfg)
  expect_named(p, c("cell_id", "x", "y", "s_mean", "pop_exposed", "rain_coverage", "priority"))
  expect_equal(nrow(p), 100)
  expect_false(is.unsorted(rev(p$priority)))
  r <- p[p$cell_id == 12, ]
  expect_equal(r$pop_exposed, 300)                       # A and B within 2 km
  expect_equal(r$rain_coverage, (100 * 0.8 + 200 * 0) / 300)
  expect_equal(r$priority, 0.5 * 300 * (1 - r$rain_coverage))
  r100 <- p[p$cell_id == 100, ]
  expect_equal(r100$pop_exposed, 50)
  expect_equal(r100$priority, 0.9 * 50 * (1 - 0.5))
  far <- p[p$cell_id == 91, ]                            # (0.5, 9.0..) no settlement near
  expect_equal(far$pop_exposed, 0)
  expect_equal(far$rain_coverage, 0)
  expect_equal(far$priority, 0)
})

test_that("cleanup_priority defaults exposure_km to 5", {
  n <- compute_need(ng_set, ng_sev, ng_grid)
  p <- cleanup_priority(ng_sev, n, ng_grid, ng_alloc, list())
  expect_equal(p$pop_exposed[p$cell_id == 12], 300)
  expect_equal(p$pop_exposed[p$cell_id == 100], 50)
})

test_that("top_priority returns first n rows with priority > 0", {
  n <- compute_need(ng_set, ng_sev, ng_grid)
  p <- cleanup_priority(ng_sev, n, ng_grid, ng_alloc, ng_cfg)
  t3 <- top_priority(p, 3)
  expect_equal(nrow(t3), 3)
  expect_equal(t3$cell_id, p$cell_id[1:3])
  expect_true(all(t3$priority > 0))
  expect_lt(nrow(top_priority(p, 100)), 100)
  expect_true(all(top_priority(p, 100)$priority > 0))
  expect_equal(nrow(top_priority(p)), min(10, sum(p$priority > 0)))
})

test_that("sampling_priority ranks open calls with many people first", {
  s <- sampling_priority(ng_sev, compute_need(ng_set, ng_sev, ng_grid), ng_grid, ng_cfg)
  expect_true(all(c("decision_uncertainty", "people_at_stake", "test_value") %in% names(s)))
  expect_equal(s$cell_id[1], 12L)                       # p = 0.5 next to areas A and B (300 people)
  expect_equal(s$test_value[1], 0.25 * 300)
  expect_equal(s$decision_uncertainty[s$cell_id == 100], 0)   # p = 1: nothing left to learn
  expect_true(all(diff(s$test_value) <= 0))
})
