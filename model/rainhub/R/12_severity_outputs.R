# Plots and report sections for the severity -> need -> gap -> cleanup-priority chain.
# ggplot2 only. Coordinates are km.

# Map of the severity surface: pale = clean, dark red = most polluted, fixed 0-1 scale so
# two maps can be compared. `sites` (x, y; optional) are drawn as points.
plot_severity_map <- function(severity, grid, sites = NULL, title = "Pollution severity") {
  d <- merge(severity[, c("cell_id", "s_mean")], grid[, c("cell_id", "x", "y")], by = "cell_id")
  p <- ggplot2::ggplot() +
    ggplot2::geom_raster(data = d, ggplot2::aes(x, y, fill = s_mean)) +
    ggplot2::scale_fill_gradientn(
      colours = c("#fff5f0", "#fcbba1", "#fb6a4a", "#cb181d", "#67000d"),
      limits = c(0, 1), name = "Severity\n(0 clean,\n1 worst)")
  if (!is.null(sites) && nrow(sites) > 0) {
    p <- p + ggplot2::geom_point(data = sites, ggplot2::aes(x, y), shape = 21, size = 1.8,
                                 fill = "white", colour = "grey15", stroke = 0.5)
  }
  sub <- paste0("Colour = estimated pollution severity S per cell (mean of the 7 water-quality scores, 0 to 1).",
                if (!is.null(sites) && nrow(sites) > 0) " White dots = sampling sites." else "")
  p + ggplot2::coord_equal(expand = FALSE) +
    ggplot2::labs(title = title, subtitle = paste(strwrap(sub, 95), collapse = "\n"), x = "x (km)", y = "y (km)") +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(plot.subtitle = ggplot2::element_text(size = 8, colour = "grey30"),
                   panel.grid = ggplot2::element_blank())
}

# Horizontal bars per area: need vs people served, areas ordered by gap (largest gap on top).
plot_gap <- function(gap, title = "Need and supply gap", max_areas = 30) {
  tot <- sum(gap$need); met <- sum(gap$need - gap$gap); n_all <- nrow(gap)
  if (n_all > max_areas) gap <- utils::head(gap[order(-gap$gap, gap$area_id), ], max_areas)   # bars stay readable
  lev <- gap$area_id[order(gap$gap, gap$area_id)]   # last level is drawn on top
  d <- rbind(
    data.frame(area_id = gap$area_id, series = "Need", value = gap$need, stringsAsFactors = FALSE),
    data.frame(area_id = gap$area_id, series = "Served", value = gap$served_people, stringsAsFactors = FALSE))
  d$area_id <- factor(d$area_id, levels = lev)
  d$series <- factor(d$series, levels = c("Need", "Served"))
  sub <- sprintf("Need = people x chance the local river is severely polluted. Served = people a hub is expected to supply. Areas sorted by gap (largest on top). %.1f%% of need met overall%s.",
                 if (tot > 0) 100 * met / tot else 100,
                 if (n_all > max_areas) sprintf(" (all %d areas); the %d largest gaps are shown", n_all, max_areas) else "")
  ggplot2::ggplot(d, ggplot2::aes(x = area_id, y = value, fill = series)) +
    ggplot2::geom_col(position = ggplot2::position_dodge2(reverse = TRUE, padding = 0.1), width = 0.8) +
    ggplot2::coord_flip() +
    ggplot2::scale_fill_manual(values = c(Need = "#b2182b", Served = "#2166ac"), name = NULL) +
    ggplot2::scale_y_continuous(expand = ggplot2::expansion(mult = c(0, 0.05))) +
    ggplot2::labs(title = title, subtitle = paste(strwrap(sub, 95), collapse = "\n"),
                  x = NULL, y = "People") +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(plot.subtitle = ggplot2::element_text(size = 8, colour = "grey30"),
                   panel.grid.major.y = ggplot2::element_blank(), legend.position = "top")
}

# APPENDS two sections to a markdown report: '## Need and gap' and '## Pollution severity'.
# `prio` is the output of cleanup_priority() (sorted) or top_priority(); only its first 10
# rows with priority > 0 are shown.
write_gap_section <- function(gap, prio, path, cfg) {
  tot_need <- sum(gap$need)
  met <- sum(gap$need - gap$gap)
  pct <- if (tot_need > 0) 100 * met / tot_need else 100
  L <- character(0)
  add <- function(...) L <<- c(L, paste0(...))
  add("")
  add("## Need and gap")
  add("")
  add(sprintf("- Total need: %.0f people", tot_need))
  add(sprintf("- Total served: %.0f people (people reached by a hub, expected value)", sum(gap$served_people)))
  add(sprintf("- Need met: %.0f people (people in need whom a hub supplies)", met))
  add(sprintf("- %% of need met: %.1f%%", pct))
  add(sprintf("- Areas with a gap: %d of %d", sum(gap$gap > 1e-9), nrow(gap)))
  add("")
  add("### Top 10 cleanup priorities")
  add("")
  top <- utils::head(prio[prio$priority > 0, , drop = FALSE], 10)
  if (nrow(top) == 0) {
    add("No grid cell has a positive cleanup priority (no settlement is exposed to polluted river water).")
  } else {
    add("| cell | x (km) | y (km) | severity | people exposed | rain coverage | priority |")
    add("|---|---|---|---|---|---|---|")
    for (i in seq_len(nrow(top))) {
      add(sprintf("| %d | %.1f | %.1f | %.2f | %.0f | %.2f | %.1f |", top$cell_id[i], top$x[i], top$y[i],
                  top$s_mean[i], top$pop_exposed[i], top$rain_coverage[i], top$priority[i]))
    }
  }
  add("")
  add("**How to read.** Need is the number of people who live where the river is probably badly ",
      "polluted. Served is how many of them a rain hub can supply. The gap is the need that no hub ",
      "covers; an area with a big gap is a place where people are exposed and no rainwater supply ",
      "reaches them. Cleanup priority ranks grid cells: it is high where the river is dirty, many ",
      "people live within ", if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km,
      " km, and little of that population is covered by a hub. Start cleanup at the top of the table. ",
      "See the Data notes at the end of the report for whether the demand areas are real population or placeholders.")
  add("")
  add("## Pollution severity")
  add("")
  add("Each water sample gets a score per parameter, then the scores are averaged:")
  add("")
  add("```")
  add("s_k = clamp((x_k - ref_k) / (bad_k - ref_k), 0, 1)     0 = meets the reference, 1 = at or beyond 'bad'")
  add("S   = sum(w_k * s_k) / sum(w_k)                        over the parameters measured in that sample")
  add(sprintf("severe if S > tau = %s", format(cfg$severity$tau)))
  add("```")
  add("")
  add("| param | ref | bad | weight |")
  add("|---|---|---|---|")
  pr <- severity_params(cfg)
  for (i in seq_len(nrow(pr))) {
    add(sprintf("| %s | %s | %s | %.3f |", pr$param[i], format(pr$ref[i]), format(pr$bad[i]), pr$weight[i]))
  }
  add("")
  add("Notes: for DO, low is bad (ref 5 mg/L, bad 0). For pH, x is the distance outside the ",
      "accepted range (", cfg$severity$params$pH$ref_low, " to ", cfg$severity$params$pH$ref_high,
      "), so ref is 0 and bad is ", cfg$severity$params$pH$bad, " pH units outside. ",
      "Reference values and which are assumptions are annotated in config.yml.")
  add("")
  cat(paste0(L, "\n"), file = path, append = TRUE, sep = "")
  invisible(path)
}
