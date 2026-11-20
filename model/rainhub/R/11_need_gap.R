# Need, supply gap and cleanup priority (links river severity to people).
#
# Need_i   = pop_i * p_severe(cell of area i)
# C_i      = p_served_i x share of the area a hub serves   (cover; p_served from allocate_supply, 0 if unserved)
# Served_i = pop_i * C_i            people a hub is expected to supply
# Gap_i    = Need_i * (1 - C_i)     people in need whom no hub supplies (the same cover as the Water Access Index)
# Cleanup priority(cell) = s_mean * pop_exposed * (1 - rain_coverage)
#   pop_exposed   = sum of populations of settlements within cfg$exposure_km (default 5 km)
#                   of the cell centre
#   rain_coverage = population-weighted mean of p_served over those settlements (0 if none)
# Coordinates are in km.

# Settlements plus cell_id (nearest grid cell), s_mean, p_severe and need.
compute_need <- function(settlements, severity, grid) {
  out <- settlements
  out$cell_id <- vapply(seq_len(nrow(out)), function(i) {
    as.integer(grid$cell_id[which.min((grid$x - out$x[i])^2 + (grid$y - out$y[i])^2)])
  }, integer(1))
  idx <- match(out$cell_id, severity$cell_id)
  out$s_mean <- severity$s_mean[idx]
  out$p_severe <- severity$p_severe[idx]
  out$need <- out$population * out$p_severe
  out
}

# One row per area (rows follow `need`). served_people = pop * cover; gap = need * (1 - cover).
compute_gap <- function(need, allocation) {
  ps <- allocation$p_served[match(need$area_id, allocation$area_id)]
  ps[is.na(ps)] <- 0
  sp <- if ("served_people" %in% names(allocation)) allocation$served_people[match(need$area_id, allocation$area_id)] else need$population
  sp[is.na(sp)] <- 0
  cover <- ps * pmin(pmax(sp / need$population, 0), 1)
  cover[!is.finite(cover)] <- 0
  served <- need$population * cover
  gap <- need$need * (1 - cover)
  pct <- ifelse(need$need == 0, 100, 100 * cover)
  data.frame(area_id = need$area_id, population = need$population, need = need$need,
             served_people = served, gap = gap, pct_need_met = pct,
             stringsAsFactors = FALSE)
}

# Priority for every grid cell, sorted by priority descending (ties by cell_id).
cleanup_priority <- function(severity, need, grid, allocation, cfg) {
  km <- if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km
  ps <- allocation$p_served[match(need$area_id, allocation$area_id)]
  ps[is.na(ps)] <- 0
  if ("served_people" %in% names(allocation)) {   # partly served areas count only for the share served
    fr <- allocation$served_people[match(need$area_id, allocation$area_id)] / need$population
    ps <- ps * pmin(pmax(ifelse(is.na(fr), 0, fr), 0), 1)
  }
  g <- merge(grid[, c("cell_id", "x", "y")], severity[, c("cell_id", "s_mean")], by = "cell_id")
  n <- nrow(g)
  pop_exposed <- numeric(n); rain_cov <- numeric(n)
  for (i in seq_len(n)) {
    near <- sqrt((need$x - g$x[i])^2 + (need$y - g$y[i])^2) <= km
    if (any(near)) {
      pop_exposed[i] <- sum(need$population[near])
      if (pop_exposed[i] > 0) rain_cov[i] <- sum(need$population[near] * ps[near]) / pop_exposed[i]
    }
  }
  g$pop_exposed <- pop_exposed
  g$rain_coverage <- rain_cov
  g$priority <- g$s_mean * g$pop_exposed * (1 - g$rain_coverage)
  g <- g[order(-g$priority, g$cell_id), c("cell_id", "x", "y", "s_mean", "pop_exposed", "rain_coverage", "priority")]
  rownames(g) <- NULL
  g
}

# First n rows (prio is already sorted) with priority > 0.
top_priority <- function(prio, n = 10) {
  prio <- prio[prio$priority > 0, , drop = FALSE]
  utils::head(prio, n)
}

# Where to test next. For each grid cell:
#   decision_uncertainty = p_severe * (1 - p_severe)     0 when the model is sure either way, 0.25 at a coin flip
#   people_at_stake      = population within cfg$exposure_km
#   test_value           = decision_uncertainty * people_at_stake
# A new water test is worth most where the severe / not-severe call is still open AND many people depend on it.
# This is a simple ranking in the spirit of "value of information", not a full expected-value calculation.
sampling_priority <- function(severity, need, grid, cfg) {
  km <- if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km
  g <- merge(grid[, c("cell_id", "x", "y")], severity[, c("cell_id", "s_mean", "s_sd", "p_severe")], by = "cell_id")
  g$people_at_stake <- vapply(seq_len(nrow(g)), function(i)
    sum(need$population[sqrt((need$x - g$x[i])^2 + (need$y - g$y[i])^2) <= km]), numeric(1))
  g$decision_uncertainty <- g$p_severe * (1 - g$p_severe)
  g$test_value <- g$decision_uncertainty * g$people_at_stake
  g <- g[order(-g$test_value, g$cell_id), ]
  rownames(g) <- NULL
  g
}

# APPENDS '## Where to test next' to a markdown report (first n rows with test_value > 0).
write_sampling_section <- function(samp, path, cfg, n = 10) {
  top <- utils::head(samp[samp$test_value > 0, , drop = FALSE], n)
  L <- c("", "## Where to test next", "",
         "A new water test is worth most where the model cannot yet say whether the river is severely polluted",
         "(chance near 50%) and many people live nearby. Rank = chance x (1 - chance) x people within the exposure distance.", "")
  if (nrow(top) == 0) L <- c(L, "No cell has an open severe / not-severe call.")
  else {
    L <- c(L, "| cell | x (km) | y (km) | severity | chance severe | people nearby | test value |", "|---|---|---|---|---|---|---|")
    for (i in seq_len(nrow(top)))
      L <- c(L, sprintf("| %d | %.1f | %.1f | %.2f | %.2f | %s | %s |", top$cell_id[i], top$x[i], top$y[i], top$s_mean[i],
                        top$p_severe[i], format(round(top$people_at_stake[i]), big.mark = ",", scientific = FALSE),
                        format(round(top$test_value[i]), big.mark = ",", scientific = FALSE)))
  }
  cat(L, file = path, append = TRUE, sep = "\n")
  invisible(path)
}
