# Hand-built fixtures: 3 x 2 grid, 3 areas, 12 priority rows.
so_grid <- data.frame(cell_id = 1:6, x = rep(c(1, 2, 3), 2), y = rep(c(1, 2), each = 3))
so_sev <- data.frame(cell_id = 1:6, s_mean = c(0, 0.1, 0.2, 0.3, 0.4, 0.5), s_sd = 0.05, p_severe = 0.5)
so_sites <- data.frame(site_id = c("a", "b"), x = c(1.2, 2.8), y = c(1.1, 1.9), n = c(5, 7), s_mean = c(0.1, 0.4))
so_gap <- data.frame(area_id = c("A", "B", "C"), population = c(100, 200, 50),
                     need = c(50, 40, 50), served_people = c(80, 0, 25),
                     gap = c(0, 40, 25), pct_need_met = c(100, 0, 50), stringsAsFactors = FALSE)
so_prio <- data.frame(cell_id = 1:12, x = 1:12, y = 12:1, s_mean = seq(0.5, 0.06, length.out = 12),
                      pop_exposed = rep(100, 12), rain_coverage = 0.25, priority = 12:1 * 3.5)
so_cfg <- load_config("../../config.yml")

test_that("plot_severity_map: ggplot, fill s_mean on a 0-1 scale, sites as points", {
  p <- plot_severity_map(so_sev, so_grid, sites = so_sites, title = "Sev")
  expect_s3_class(p, "ggplot")
  expect_equal(p$labels$title, "Sev")
  b <- ggplot2::ggplot_build(p)
  expect_equal(b$plot$scales$get_scales("fill")$limits, c(0, 1))
  expect_true(any(vapply(p$layers, function(l) inherits(l$geom, "GeomPoint"), logical(1))))
  p0 <- plot_severity_map(so_sev, so_grid, title = "No sites")
  expect_false(any(vapply(p0$layers, function(l) inherits(l$geom, "GeomPoint"), logical(1))))
  expect_no_error(ggplot2::ggplot_build(p0))
})

test_that("plot_gap: two series per area, ordered by gap", {
  p <- plot_gap(so_gap, "Gap")
  expect_s3_class(p, "ggplot")
  expect_no_error(ggplot2::ggplot_build(p))
  d <- p$data
  expect_equal(nrow(d), 6)
  expect_setequal(as.character(unique(d[[setdiff(names(d), c("area_id", "value"))[1]]])),
                  c("Need", "Served"))
  # largest gap (B) is drawn at the top: last factor level
  expect_equal(levels(d$area_id), c("A", "C", "B"))
})

test_that("write_gap_section appends need/gap totals, top-10 table and severity section", {
  path <- tempfile(fileext = ".md")
  writeLines(c("# Existing report", "", "## Hubs"), path)
  write_gap_section(so_gap, so_prio, path, so_cfg)
  txt <- readLines(path)
  expect_equal(txt[1:3], c("# Existing report", "", "## Hubs"))
  all <- paste(txt, collapse = "\n")
  expect_match(all, "## Need and gap", fixed = TRUE)
  expect_match(all, "Total need: 140", fixed = TRUE)
  expect_match(all, "Total served: 105", fixed = TRUE)    # 80 + 0 + 25 (served as people, not capped)
  expect_match(all, "Need met: 75", fixed = TRUE)         # need minus gap in the fixture: 50 + 0 + 25
  expect_match(all, "% of need met: 53.6", fixed = TRUE)  # 75 / 140
  expect_match(all, "Areas with a gap: 2", fixed = TRUE)
  expect_match(all, "## Pollution severity", fixed = TRUE)
  expect_match(all, "```", fixed = TRUE)
  expect_match(all, "| param | ref | bad | weight |", fixed = TRUE)
  expect_true(any(grepl("^\\| DO \\|", txt)))
  expect_true(any(grepl("^\\| pH \\|", txt)))
  expect_match(all, "How to read", fixed = TRUE)
  # table rows: header + separator + 10 data rows, none for ranks 11-12
  i <- grep("^\\| cell \\|", txt)
  expect_length(i, 1)
  rows <- txt[(i + 2):length(txt)]
  rows <- rows[grepl("^\\| \\d+ \\|", rows)]
  expect_length(rows, 10)
  expect_true(grepl("^\\| 1 \\|", rows[1]))   # highest priority first
})

test_that("write_gap_section copes with no priorities and creates the file if missing", {
  path <- tempfile(fileext = ".md")
  none <- so_prio[0, ]
  expect_no_error(write_gap_section(so_gap, none, path, so_cfg))
  expect_match(paste(readLines(path), collapse = "\n"), "## Need and gap", fixed = TRUE)
})
