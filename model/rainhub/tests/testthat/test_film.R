# Film builder: runs on a tiny hand-built result, no models needed.

test_that("film_data carries the run's own numbers", {
  f <- film_fixture(); j <- film_data(f$res, f$d)
  expect_match(j, "\"samples\":20", fixed = TRUE)
  expect_match(j, "\"pass_pct\":15", fixed = TRUE)
  expect_match(j, "\"pop\":4000", fixed = TRUE)
  expect_match(j, "\"need\":1400", fixed = TRUE)
  expect_match(j, "\"served\":450", fixed = TRUE)
  expect_match(j, "\"real\":1", fixed = TRUE)
  expect_match(j, "\"dry_mm\":134", fixed = TRUE)
  expect_false(grepl("NA|NaN|Inf", j))
  skip_if_not_installed("jsonlite")
  p <- jsonlite::fromJSON(j)
  expect_equal(nrow(p$cells), 4); expect_equal(length(p$rain), 12)
  expect_equal(p$stats$wai_base, 1 - 1400 / 4000)
})

test_that("build_film fills the template and writes a standalone page", {
  f <- film_fixture(); tpl <- tempfile(fileext = ".html"); out <- tempfile(fileext = ".html")
  writeLines(c("<title>t</title>", "<script>const D = /*__DATA__*/null;</script>"), tpl)
  build_film(f$res, f$d, out, template = tpl)
  page <- paste(readLines(out, warn = FALSE), collapse = "\n")
  expect_match(page, "<!doctype html>", fixed = TRUE)
  expect_match(page, "const D = {\"cells\":", fixed = TRUE)
  expect_false(grepl("__DATA__", page, fixed = TRUE))
  writeLines("<p>no marker</p>", tpl)
  expect_error(build_film(f$res, f$d, out, template = tpl), "marker")
  expect_error(build_film(f$res, f$d, out, template = "nope.html"), "not found")
})

test_that("the real template keeps its data marker and is plain ASCII", {
  tpl <- file.path("..", "..", "scripts", "film_template.html")
  skip_if_not(file.exists(tpl))
  raw <- readBin(tpl, "raw", file.info(tpl)$size)
  expect_true(all(raw < as.raw(128)))
  expect_match(rawToChar(raw), "/*__DATA__*/null", fixed = TRUE)
})
