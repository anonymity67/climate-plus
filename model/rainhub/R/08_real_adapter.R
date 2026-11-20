# Real-data adapter: reads user CSVs and maps their column names to the
# shared names used by the pipeline. Column names are never guessed beyond
# the mapping: anything missing stops with a message naming the column.

.shared_cols <- list(
  rain_obs    = c("station_id", "x", "y", "month", "rain_mm", "wet_days", "days"),
  quality_obs = c("site_id", "x", "y", "tests", "passes"),
  settlements = c("area_id", "x", "y", "population", "access_distance_km")
)

# mapping: named list, shared column name -> user's column name. Columns not
# in the mapping are assumed to already have the shared name. Note x and y
# share one mapping entry across all three files.
.read_mapped <- function(path, table, mapping) {
  if (!file.exists(path)) stop("File not found: ", path, call. = FALSE)
  raw <- utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
  shared <- .shared_cols[[table]]
  src <- vapply(shared, function(s) {
    if (!is.null(mapping[[s]])) mapping[[s]] else s
  }, character(1))
  missing <- !src %in% names(raw)
  if (any(missing)) {
    stop("In ", basename(path), " (", table, "): missing column(s) ",
         paste0("'", shared[missing], "' (looked for '", src[missing], "')",
                collapse = ", "),
         ". Columns found: ", paste(names(raw), collapse = ", "), ".",
         call. = FALSE)
  }
  out <- raw[, src, drop = FALSE]
  names(out) <- shared
  for (nm in setdiff(shared, c("station_id", "site_id", "area_id"))) {
    if (!is.numeric(out[[nm]])) {
      out[[nm]] <- suppressWarnings(as.numeric(out[[nm]]))
    }
  }
  bad <- is.na(out$x) | is.na(out$y)
  if (any(bad)) {
    message("Dropped ", sum(bad), " row", if (sum(bad) != 1) "s", " with missing ",
            "coordinates from ", table, " (", basename(path), ").")
    out <- out[!bad, , drop = FALSE]
  }
  rownames(out) <- NULL
  out
}

load_real_data <- function(rain_path, quality_path, settlements_path, mapping = list()) {
  list(
    rain_obs    = .read_mapped(rain_path, "rain_obs", mapping),
    quality_obs = .read_mapped(quality_path, "quality_obs", mapping),
    settlements = .read_mapped(settlements_path, "settlements", mapping)
  )
}

# Turn per-sample measurements into quality_obs (tests, passes per site).
# direction "below": a sample passes when value <= threshold (e.g. nitrate);
# "above": passes when value >= threshold (e.g. dissolved oxygen).
# NA measurements are not counted as tests. Site coordinates = mean of samples.
derive_pass_fail <- function(df, value_col, threshold, direction = c("below", "above"),
                             site_col, x_col, y_col) {
  direction <- match.arg(direction)
  need <- c(value_col, site_col, x_col, y_col)
  miss <- setdiff(need, names(df))
  if (length(miss)) stop("derive_pass_fail: missing column(s) ", paste(miss, collapse = ", "),
                         call. = FALSE)
  v <- suppressWarnings(as.numeric(df[[value_col]]))
  keep <- !is.na(v) & !is.na(df[[site_col]])
  d <- data.frame(site_id = df[[site_col]][keep], x = as.numeric(df[[x_col]][keep]),
                  y = as.numeric(df[[y_col]][keep]), v = v[keep],
                  stringsAsFactors = FALSE)
  d$ok <- if (direction == "below") d$v <= threshold else d$v >= threshold
  sites <- unique(d$site_id)
  out <- do.call(rbind, lapply(sites, function(s) {
    g <- d[d$site_id == s, ]
    data.frame(site_id = s, x = mean(g$x, na.rm = TRUE), y = mean(g$y, na.rm = TRUE),
               tests = nrow(g), passes = sum(g$ok), stringsAsFactors = FALSE)
  }))
  if (is.null(out)) {
    out <- data.frame(site_id = character(), x = numeric(), y = numeric(),
                      tests = integer(), passes = integer())
  }
  rownames(out) <- NULL
  out
}
