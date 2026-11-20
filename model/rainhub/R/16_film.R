# The animated film (Problem, Purpose, Method, Solution, Conclusion) as one self-contained HTML page.
# build_film() takes the result of run_real_chain() plus the prepared data and fills
# scripts/film_template.html with the run's own numbers, so the film always matches the report.
#   res: list returned by run_real_chain()      d: list from prepare_dhaka_data() (after CHIRPS, if used)
#   out: path of the .html to write             template: the template file
#   standalone = TRUE wraps the page in <!doctype html> ... so it opens directly in a browser.
# Rebuild without re-running the models: source("scripts/build_film.R").

.js_num <- function(x, digits = 3) paste0("[", paste(ifelse(is.na(x), "null", trimws(formatC(round(x, digits), format = "fg", digits = 12))), collapse = ","), "]")
.js_rows <- function(df, digits = 3) paste0("[", paste(apply(as.matrix(df), 1, function(r) .js_num(as.numeric(r), digits)), collapse = ","), "]")

film_data <- function(res, d) {
  cfg <- res$cfg
  g <- merge(res$grid[, c("cell_id", "x", "y")], res$severity[, c("cell_id", "s_mean")], by = "cell_id")
  step <- function(v) { u <- sort(unique(round(v, 6))); if (length(u) > 1) stats::median(diff(u)) else 1 }
  dx <- step(g$x); dy <- step(g$y)
  wai <- res$wai$wai
  clean_gain <- wai[3] - wai[1]
  match_n <- NA
  if (nrow(res$hubs) > 0 && clean_gain > 0) {      # hubs needed for rain alone to equal the cleanup gain (upper bound)
    su <- hub_scaleup(res$need, cfg, mean(res$hubs$reliability), n_hubs = seq(10, 20000, by = 10))
    hit <- which(su$gain_vs_baseline >= clean_gain)
    if (length(hit)) match_n <- su$n_hubs[hit[1]]
  }
  mm <- if (!is.null(cfg$season)) cfg$season$monthly_mm else numeric(0)
  q <- d$quality_obs
  stats <- c(
    samples = sum(q$tests), sites = nrow(q), pass_pct = 100 * sum(q$passes) / sum(q$tests),
    pop = sum(res$need$population), need = sum(res$need$need),
    hubs_n = nrow(res$hubs), hub_people = cfg$hub_capacity_people, served = sum(res$gap$served_people),
    rel_min = if (nrow(res$hubs)) min(res$hubs$reliability) else NA, rel_max = if (nrow(res$hubs)) max(res$hubs$reliability) else NA,
    top_n = nrow(res$top), exposure_km = if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km,
    wai_base = wai[1], wai_hubs = wai[2], wai_clean = wai[3], wai_both = wai[4],
    cleanup_effect = attr(res$wai, "cleanup_effect"), hubs_to_match = match_n, tau = cfg$severity$tau,
    smin = min(g$s_mean), smax = max(g$s_mean),
    annual_mm = if (length(mm)) sum(mm) else NA, dry_mm = if (length(mm)) sum(sort(mm)[1:5]) else NA,
    real = as.numeric(identical(attr(res$settlements, "source"), "WorldPop")))
  paste0("{",
    "\"cells\":", .js_rows(g[, c("x", "y", "s_mean")]), ",",
    "\"ext\":{\"xmin\":", min(g$x) - dx / 2, ",\"xmax\":", max(g$x) + dx / 2, ",\"ymin\":", min(g$y) - dy / 2, ",\"ymax\":", max(g$y) + dy / 2, ",\"dx\":", dx, ",\"dy\":", dy, "},",
    "\"hubs\":", if (nrow(res$hubs)) .js_rows(res$hubs[, c("x", "y")], 2) else "[]", ",",
    "\"top\":", if (nrow(res$top)) .js_rows(res$top[, c("x", "y")], 2) else "[]", ",",
    "\"rain\":", if (length(mm)) .js_num(mm, 1) else "[]", ",",
    "\"stats\":{", paste0("\"", names(stats), "\":", ifelse(is.na(stats), "null", trimws(formatC(stats, format = "fg", digits = 10))), collapse = ","), "}}")
}

build_film <- function(res, d, out, template = "scripts/film_template.html", standalone = TRUE) {
  if (!file.exists(template)) stop("Film template not found: ", template, call. = FALSE)
  page <- readChar(template, file.info(template)$size, useBytes = TRUE)     # bytes in, bytes out: no encoding surprises
  if (!grepl("/*__DATA__*/null", page, fixed = TRUE, useBytes = TRUE)) stop("Template has no /*__DATA__*/null marker", call. = FALSE)
  page <- sub("/*__DATA__*/null", film_data(res, d), page, fixed = TRUE, useBytes = TRUE)
  if (standalone) page <- paste0("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n",
                                 "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n</head>\n<body>\n", page, "\n</body>\n</html>\n")
  writeBin(charToRaw(page), out)
  invisible(out)
}
