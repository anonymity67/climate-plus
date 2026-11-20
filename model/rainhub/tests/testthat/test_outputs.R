# Hand-built fixtures (INLA not needed): 10 x 10 grid of 1 km cells.
cfg <- list(thresholds = list(clean_p = 0.80, max_interval = 0.30),
            reliability_target = 0.90, runoff_coef = 0.8,
            hub_roof_m2 = 400, hub_demand_l_day = 5000, hub_tank_l = 20000)
grid <- expand.grid(x = 1:10 - 0.5, y = 1:10 - 0.5)
grid$cell_id <- seq_len(nrow(grid))
grid <- grid[, c("cell_id", "x", "y")]
make_rain <- function(mean_mm = 300) {
  data.frame(cell_id = grid$cell_id, mean_mm = mean_mm + grid$x * 5, sd_mm = 30, p_wet = 0.4, p_wet_sd = 0.05)
}
make_clean <- function(p = 0.95, status = "clean") {
  data.frame(cell_id = grid$cell_id, p_clean = p, lower = p - 0.05, upper = p + 0.04, status = status)
}
make_settlements <- function() {
  data.frame(area_id = sprintf("A%02d", 1:6), x = c(1, 2, 8, 9, 5, 5), y = c(1, 8, 2, 9, 5, 9.5),
             population = c(100, 200, 150, 120, 80, 60), access_distance_km = c(5, 3, 7, 2, 4, 6))
}
fix <- function(with_hub = TRUE) {
  cl <- make_clean(0.95)
  cl$status[1:20] <- "unknown"; cl$p_clean[1:20] <- 0.5
  cl$status[21:40] <- "polluted"; cl$p_clean[21:40] <- 0.1
  hubs <- if (with_hub) select_hubs(make_rain(), cl, cfg, grid, n_max = 2) else {
    h <- data.frame(cell_id = integer(0), x = numeric(0), y = numeric(0), reliability = numeric(0),
                    tank_l = numeric(0), p_clean = numeric(0)); attr(h, "message") <- "no safe hub found"; h }
  s <- make_settlements()
  list(rain = make_rain(), clean = cl, hubs = hubs, s = s,
       alloc = allocate_supply(hubs, s, cfg, max_km = 6))
}

test_that("plot_map returns a ggplot with synthetic in the title", {
  f <- fix()
  p <- plot_map(f$rain, f$clean, f$hubs, f$s, "Map", grid = grid, synthetic = TRUE)
  expect_s3_class(p, "ggplot")
  expect_match(p$labels$title, "synthetic", ignore.case = TRUE)
  expect_no_error(ggplot2::ggplot_build(p))
  p0 <- plot_map(f$rain, f$clean, f$hubs[0, ], f$s, "Map", grid = grid)
  expect_no_error(ggplot2::ggplot_build(p0))
})

test_that("plot_supply_network returns a ggplot with synthetic in the title", {
  f <- fix()
  expect_gt(sum(is.na(f$alloc$hub_id)), 0)
  p <- plot_supply_network(f$hubs, f$alloc, f$s, "Network", synthetic = TRUE)
  expect_s3_class(p, "ggplot")
  expect_match(p$labels$title, "synthetic", ignore.case = TRUE)
  expect_no_error(ggplot2::ggplot_build(p))
  f0 <- fix(FALSE)
  expect_no_error(ggplot2::ggplot_build(plot_supply_network(f0$hubs, f0$alloc, f0$s, "N")))
})

test_that("write_report flags synthetic data and counts unserved areas", {
  f <- fix(); path <- tempfile(fileext = ".md")
  out <- write_report(f$rain, f$clean, f$hubs, f$alloc, path, synthetic = TRUE)
  expect_equal(out, path); expect_true(file.exists(path))
  txt <- readLines(path)
  expect_match(txt[1], "SYNTHETIC DATA")
  n_un <- sum(is.na(f$alloc$hub_id))
  expect_match(paste(txt, collapse = "\n"), sprintf("Unserved areas: %d", n_un), fixed = TRUE)
  expect_match(paste(txt, collapse = "\n"), "clean: 60", fixed = TRUE)
  expect_match(paste(txt, collapse = "\n"), "polluted: 20", fixed = TRUE)
  expect_match(paste(txt, collapse = "\n"), "unknown: 20", fixed = TRUE)
  path2 <- write_report(f$rain, f$clean, f$hubs, f$alloc, tempfile(fileext = ".md"), synthetic = FALSE)
  expect_false(grepl("SYNTHETIC DATA", readLines(path2)[1]))
})

test_that("report states no safe hub found with fallback actions", {
  f <- fix(FALSE); path <- tempfile(fileext = ".md")
  write_report(f$rain, f$clean, f$hubs, f$alloc, path, synthetic = TRUE)
  txt <- paste(readLines(path), collapse = "\n")
  expect_match(txt, "no safe hub found", fixed = TRUE)
  expect_match(txt, "Fallback actions", fixed = TRUE)
  expect_match(txt, "Unserved areas: 6", fixed = TRUE)
})
