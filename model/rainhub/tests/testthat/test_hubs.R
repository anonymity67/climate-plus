# Hand-built fixtures (INLA not needed): 10 x 10 grid of 1 km cells.
cfg <- list(thresholds = list(clean_p = 0.80, max_interval = 0.30),
            reliability_target = 0.90, runoff_coef = 0.8,
            hub_roof_m2 = 3000, hub_demand_l_day = 1500, hub_tank_l = 20000)
grid <- expand.grid(x = 1:10 - 0.5, y = 1:10 - 0.5)
grid$cell_id <- seq_len(nrow(grid))
grid <- grid[, c("cell_id", "x", "y")]
make_rain <- function(mean_mm = 300) {
  data.frame(cell_id = grid$cell_id, mean_mm = mean_mm, sd_mm = 30,
             p_wet = 0.4, p_wet_sd = 0.05)
}
make_clean <- function(p = 0.95, status = "clean") {
  data.frame(cell_id = grid$cell_id, p_clean = p, lower = p - 0.05,
             upper = p + 0.04, status = status)
}
# Wide fixture (60 x 60 km grid, 6 km cells) for distance tests.
wgrid <- expand.grid(x = seq(3, 57, by = 6), y = seq(3, 57, by = 6))
wgrid$cell_id <- seq_len(nrow(wgrid)); wgrid <- wgrid[, c("cell_id", "x", "y")]
wrain <- data.frame(cell_id = wgrid$cell_id, mean_mm = 300, sd_mm = 30, p_wet = 0.4, p_wet_sd = 0.05)
wclean <- data.frame(cell_id = wgrid$cell_id, p_clean = 0.95, lower = 0.9, upper = 0.99, status = "clean")

test_that("every selected hub is clean with p_clean >= threshold", {
  cl <- make_clean(0.95)
  cl$status[1:50] <- "unknown"; cl$p_clean[1:50] <- 0.5
  cl$p_clean[51:60] <- 0.85; cl$status[51:60] <- "polluted"  # status gate matters
  hubs <- select_hubs(make_rain(), cl, cfg, grid)
  expect_gt(nrow(hubs), 0)
  expect_named(hubs, c("cell_id", "x", "y", "reliability", "tank_l", "p_clean"))
  m <- merge(hubs, cl, by = "cell_id", suffixes = c("", ".c"))
  expect_true(all(m$p_clean >= cfg$thresholds$clean_p))
  expect_true(all(m$status == "clean"))
})

test_that("hubs are at least 3 km apart and at most n_max", {
  hubs <- select_hubs(make_rain(), make_clean(), cfg, grid, n_max = 5)
  expect_lte(nrow(hubs), 5)
  expect_gt(nrow(hubs), 1)
  d <- as.matrix(dist(hubs[, c("x", "y")]))
  expect_true(all(d[upper.tri(d)] >= 3))
})

test_that("no safe hub gives empty frame with message and everyone unserved", {
  hubs <- select_hubs(make_rain(), make_clean(0.3, "polluted"), cfg, grid)
  expect_equal(nrow(hubs), 0)
  expect_equal(attr(hubs, "message"), "no safe hub found")
  expect_named(hubs, c("cell_id", "x", "y", "reliability", "tank_l", "p_clean"))
  s <- data.frame(area_id = 1:3, x = c(1, 2, 3), y = 1, population = 100,
                  access_distance_km = c(1, 2, 3))
  a <- allocate_supply(hubs, s, cfg)
  expect_named(a, c("area_id", "hub_id", "distance_km", "p_served"))
  expect_equal(nrow(a), 3)
  expect_true(all(is.na(a$hub_id)))
})

test_that("an area beyond max_km of every hub is unserved", {
  hubs <- data.frame(cell_id = 7L, x = 5, y = 5, reliability = 0.95, tank_l = 10000, p_clean = 0.9)
  s <- data.frame(area_id = c(1, 2), x = c(6, 40), y = c(5, 40), population = 100,
                  access_distance_km = c(2, 9))
  a <- allocate_supply(hubs, s, cfg, max_km = 15)
  expect_equal(a$hub_id[a$area_id == 1], 7L)
  expect_equal(a$p_served[a$area_id == 1], 0.95)
  expect_true(is.na(a$hub_id[a$area_id == 2]))
})

test_that("no hub exceeds hub_capacity_people", {
  hubs <- select_hubs(wrain, wclean, cfg, wgrid, n_max = 2)
  set.seed(2)
  s <- data.frame(area_id = 1:20, x = runif(20, 0, 60), y = runif(20, 0, 60),
                  population = sample(100:300, 20), access_distance_km = runif(20, 1, 10))
  a <- allocate_supply(hubs, s, cfg, max_km = 100, hub_capacity_people = 500)
  m <- merge(a[!is.na(a$hub_id), ], s, by = "area_id")
  load <- tapply(m$population, m$hub_id, sum)
  expect_true(all(load <= 500))
  expect_true(sum(is.na(a$hub_id)) > 0)   # capacity forced some areas out
})

test_that("lowest-access areas are served first when capacity is short", {
  hubs <- data.frame(cell_id = 1L, x = 0, y = 0, reliability = 0.9, tank_l = 5000, p_clean = 0.9)
  s <- data.frame(area_id = 1:2, x = c(1, 1), y = 0, population = 400,
                  access_distance_km = c(1, 8))
  a <- allocate_supply(hubs, s, cfg, hub_capacity_people = 500)
  expect_equal(a$hub_id[a$area_id == 2], 1L)
  expect_true(is.na(a$hub_id[a$area_id == 1]))
})

test_that("settlements pull hubs toward people and weak hubs are dropped", {
  st <- data.frame(area_id = c("A", "B"), x = c(9, 9.5), y = c(9, 9.5),
                   population = c(50, 50), access_distance_km = c(5, 5))
  hubs <- select_hubs(make_rain(), make_clean(), cfg, grid, n_max = 1, settlements = st, max_km = 3)
  expect_equal(nrow(hubs), 1)
  expect_lt(sqrt((hubs$x - 9.25)^2 + (hubs$y - 9.25)^2), 3)
  cfg2 <- cfg; cfg2$hub_min_reliability <- 1.01
  expect_equal(nrow(select_hubs(make_rain(), make_clean(), cfg2, grid)), 0)
})

test_that("hub_require_clean FALSE makes polluted cells eligible, TRUE does not", {
  cl <- make_clean(0.3, "polluted")
  cfg_t <- cfg; cfg_t$hub_require_clean <- TRUE
  expect_equal(nrow(select_hubs(make_rain(), cl, cfg_t, grid)), 0)
  expect_equal(nrow(select_hubs(make_rain(), cl, cfg, grid)), 0)   # NULL means TRUE
  cfg_f <- cfg; cfg_f$hub_require_clean <- FALSE
  hubs <- select_hubs(make_rain(), cl, cfg_f, grid)
  expect_gt(nrow(hubs), 0)
  expect_named(hubs, c("cell_id", "x", "y", "reliability", "tank_l", "p_clean"))
  expect_true(all(hubs$p_clean == 0.3))
})

test_that("hub_require_clean FALSE still applies the rain reliability filter", {
  cfg_f <- cfg; cfg_f$hub_require_clean <- FALSE; cfg_f$hub_min_reliability <- 1.01
  expect_equal(nrow(select_hubs(make_rain(), make_clean(0.3, "polluted"), cfg_f, grid)), 0)
})

test_that("with hub_require_clean FALSE, the need column steers the hub", {
  st <- data.frame(area_id = c("A", "B"), x = c(1, 9), y = c(1, 9),
                   population = c(1000, 10), access_distance_km = c(5, 5),
                   need = c(1, 500))
  cfg_f <- cfg; cfg_f$hub_require_clean <- FALSE
  cl <- make_clean(0.3, "polluted")
  h <- select_hubs(make_rain(), cl, cfg_f, grid, n_max = 1, settlements = st, max_km = 3)
  expect_equal(nrow(h), 1)
  expect_lt(sqrt((h$x - 9)^2 + (h$y - 9)^2), 3)          # next to the high-need settlement
  h2 <- select_hubs(make_rain(), cl, cfg_f, grid, n_max = 1, settlements = st[, -6], max_km = 3)
  expect_lt(sqrt((h2$x - 1)^2 + (h2$y - 1)^2), 3)        # no need column: population wins
})

test_that("allocate_supply serves the highest alloc_priority first and can split areas", {
  hubs <- data.frame(cell_id = 1L, x = 0, y = 0, reliability = 0.9, tank_l = 1, p_clean = 1)
  st <- data.frame(area_id = c("A", "B"), x = c(1, 2), y = c(0, 0), population = c(800, 800),
                   access_distance_km = c(5, 5), alloc_priority = c(0.2, 0.9), stringsAsFactors = FALSE)
  a <- allocate_supply(hubs, st, list(allow_split = TRUE), max_km = 10, hub_capacity_people = 1000)
  expect_equal(a$served_people, c(200, 800))            # B (more exposed) is served in full first
  st$alloc_priority <- NULL
  a2 <- allocate_supply(hubs, st, list(allow_split = TRUE), max_km = 10, hub_capacity_people = 1000)
  expect_equal(a2$served_people, c(800, 200))           # old rule: access distance, then id
})

test_that("a split area is topped up from the next hub, so no capacity in reach sits idle", {
  hubs <- data.frame(cell_id = 1:2, x = c(0, 4), y = 0, reliability = c(0.9, 0.5), tank_l = 1, p_clean = 1)
  st <- data.frame(area_id = c("A", "B"), x = c(1, 1), y = c(0, 1), population = c(800, 100),
                   access_distance_km = c(9, 1), stringsAsFactors = FALSE)
  a <- allocate_supply(hubs, st, list(allow_split = TRUE), max_km = 10, hub_capacity_people = 500)
  expect_equal(a$served_people, c(800, 100))                                   # A: 500 from hub 1 + 300 from hub 2
  expect_equal(a$p_served[1], (500 * 0.9 + 300 * 0.5) / 800)
  expect_equal(a$hub_id, c(1L, 2L))
})
