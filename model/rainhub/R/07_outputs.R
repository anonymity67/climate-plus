# Map, supply-network diagram and report (Task 7). ggplot2 only.
#
# Signature notes versus the plan:
#  - plot_map() takes an extra `grid` (cell_id, x, y), because the rain/clean
#    surfaces carry no coordinates (same reason select_hubs() takes `grid`).
#    It is optional only if rain/clean already have x and y columns.
#  - Both plots take `synthetic = FALSE`; when TRUE the title is prefixed
#    "SYNTHETIC DATA: " unless it already says synthetic.
#  - write_report() takes an optional `cfg` to print thresholds as labelled assumptions.

.title_for <- function(title, synthetic) {
  if (isTRUE(synthetic) && !grepl("synthetic", title, ignore.case = TRUE)) {
    title <- paste0("SYNTHETIC DATA: ", title)
  }
  title
}

plot_map <- function(rain, clean, hubs, settlements, title, grid = NULL,
                     synthetic = FALSE, show_rain_contours = TRUE) {
  title <- .title_for(title, synthetic)
  d <- clean
  if (!all(c("x", "y") %in% names(d))) {
    if (is.null(grid)) stop("plot_map needs `grid` (cell_id, x, y) when clean has no x/y.", call. = FALSE)
    d <- merge(d, grid[, c("cell_id", "x", "y")], by = "cell_id")
  }
  rr <- rain
  if (!all(c("x", "y") %in% names(rr)) && !is.null(grid)) rr <- merge(rr, grid[, c("cell_id", "x", "y")], by = "cell_id")
  # Unknown cells: grey fill with hatching drawn on top; P(clean) is NA there so the
  # map never colours uncertain water as if it were safe or unsafe.
  d$p_fill <- d$p_clean  # colour every cell by its estimate; unknown cells are faded and hatched below
  step <- function(v) { u <- sort(unique(round(v, 6))); if (length(u) > 1) min(diff(u)) else 1 }
  hw <- step(d$x) / 2; hh <- step(d$y) / 2
  unk <- d[d$status == "unknown", , drop = FALSE]

  p <- ggplot2::ggplot() +
    ggplot2::geom_raster(data = d, ggplot2::aes(x, y, fill = p_fill)) +
    ggplot2::geom_raster(data = unk, ggplot2::aes(x, y), fill = "white", alpha = 0.45) +
    ggplot2::scale_fill_gradient2(
      low = "#b2182b", mid = "#f7f7f7", high = "#2166ac", midpoint = 0.5, limits = c(0, 1),
      na.value = "grey93", name = "P(clean)")
  if (nrow(unk) > 0) {
    # diagonal hatch segments at the centre of each unknown cell
    p <- p + ggplot2::geom_segment(
      data = unk, ggplot2::aes(x = x - hw, y = y - hh, xend = x + hw, yend = y + hh),
      colour = "grey50", linewidth = 0.12, alpha = 0.45)
  }
  rain_step <- NA
  if (show_rain_contours && all(c("x", "y", "mean_mm") %in% names(rr)) &&
      length(unique(rr$mean_mm)) > 1) {
    br <- pretty(range(rr$mean_mm, na.rm = TRUE), n = 6)
    rain_step <- if (length(br) > 1) br[2] - br[1] else NA
    p <- p + ggplot2::geom_contour(data = rr, ggplot2::aes(x, y, z = mean_mm), breaks = br,
                                   colour = "grey25", linewidth = 0.3, alpha = 0.8)
  }
  if (!is.null(settlements) && nrow(settlements) > 0) {
    p <- p + ggplot2::geom_point(data = settlements, ggplot2::aes(x, y),
                                 shape = 21, size = if (nrow(settlements) > 100) 0.7 else 1.8, fill = "white",
                                 colour = "grey20", stroke = if (nrow(settlements) > 100) 0.2 else 0.4)
  }
  if (!is.null(hubs) && nrow(hubs) > 0) {
    p <- p + ggplot2::geom_point(data = hubs, ggplot2::aes(x, y),
                                 shape = 23, size = 5.5, fill = "#ffd92f", colour = "black", stroke = 0.9)
  }
  sub <- paste0("Colour = estimated P(clean): blue clean, red polluted. Faded and hatched = unknown ",
                "(95% interval spans the threshold, so not treated as safe or unsafe). ",
                "Diamonds = hubs, circles = settlements",
                if (show_rain_contours) paste0(", lines = mean monthly rain, one line per ",
                                              if (is.na(rain_step)) "step" else paste0(rain_step, " mm")) else "", ".")
  if (!is.null(hubs) && nrow(hubs) == 0) sub <- paste(sub, "No safe hub found.")
  p + ggplot2::coord_equal(expand = FALSE) +
    ggplot2::labs(title = title, subtitle = paste(strwrap(sub, 95), collapse = "\n"), x = "x (km)", y = "y (km)") +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(plot.subtitle = ggplot2::element_text(size = 8, colour = "grey30"),
                   panel.grid = ggplot2::element_blank())
}

plot_supply_network <- function(hubs, allocation, settlements, title, synthetic = FALSE) {
  title <- .title_for(title, synthetic)
  a <- merge(settlements[, c("area_id", "x", "y", "population")], allocation, by = "area_id")
  a$served <- !is.na(a$hub_id)
  a$status <- ifelse(a$served, "Served", "Unserved")
  edges <- NULL
  if (nrow(hubs) > 0 && any(a$served)) {
    s <- a[a$served, ]
    h <- hubs[match(s$hub_id, hubs$cell_id), c("x", "y")]
    edges <- data.frame(x = h$x, y = h$y, xend = s$x, yend = s$y, p_served = s$p_served)
  }
  p <- ggplot2::ggplot()
  if (!is.null(edges)) {
    p <- p + ggplot2::geom_segment(
      data = edges, ggplot2::aes(x = x, y = y, xend = xend, yend = yend, alpha = p_served, linewidth = p_served),
      colour = "#2166ac", lineend = "round") +
      ggplot2::scale_alpha_continuous(range = c(0.25, 0.95), limits = c(0, 1), name = "P(served)") +
      ggplot2::scale_linewidth_continuous(range = c(0.3, 1.8), limits = c(0, 1), guide = "none")
  }
  p <- p +
    ggplot2::geom_point(data = a[order(a$served), ], ggplot2::aes(x, y, colour = status),
                        size = if (nrow(a) > 100) 1 else 2.6) +
    ggplot2::scale_colour_manual(values = c(Served = "#1b7837", Unserved = "grey60"), name = NULL, drop = FALSE)
  if (any(!a$served) && sum(!a$served) <= 30) {   # labels only when they stay readable
    p <- p + ggplot2::geom_text(data = a[!a$served, ], ggplot2::aes(x, y, label = area_id),
                                colour = "grey35", size = 2.8, vjust = -1, fontface = "italic")
  }
  if (nrow(hubs) > 0) {
    p <- p + ggplot2::geom_point(data = hubs, ggplot2::aes(x, y), shape = 23, size = 6,
                                 fill = "#ffd92f", colour = "black", stroke = 0.9) +
      ggplot2::geom_text(data = hubs, ggplot2::aes(x, y, label = paste0("Hub ", cell_id)),
                         size = 2.8, vjust = 2.4)
  }
  sub <- if (nrow(hubs) == 0) "No safe hub found: every area is unserved."
         else sprintf("%d hub(s) (diamonds); %d of %d areas reached. Edge strength = P(served).",
                      nrow(hubs), sum(a$served), nrow(a))
  p + ggplot2::coord_equal() +
    ggplot2::scale_x_continuous(expand = ggplot2::expansion(mult = 0.12)) +
    ggplot2::scale_y_continuous(expand = ggplot2::expansion(mult = 0.08)) +
    ggplot2::labs(title = title, subtitle = sub, x = "x (km)", y = "y (km)") +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(plot.subtitle = ggplot2::element_text(size = 8, colour = "grey30"))
}

write_report <- function(rain, clean, hubs, allocation, path, synthetic, cfg = NULL) {
  n_un <- sum(is.na(allocation$hub_id))
  cnt <- function(s) sum(clean$status == s)
  L <- character(0)
  add <- function(...) L <<- c(L, paste0(...))
  add(if (isTRUE(synthetic)) "# SYNTHETIC DATA: rainwater hub report (not real conditions)" else "# Rainwater hub report")
  add("")
  if (isTRUE(synthetic)) {
    add("All numbers below come from simulated data with known hidden truth (data/synthetic_*.csv). ",
        "They show that the pipeline works; they say nothing about any real place.")
    add("")
  }
  add("## Water cleanliness (grid cells)")
  add("")
  add("Source: fitted P(clean) surface (method: ", attr(clean, "method") %||% "not recorded", ").")
  add("")
  add("- clean: ", cnt("clean"))
  add("- polluted: ", cnt("polluted"))
  add("- unknown: ", cnt("unknown"), " (95% interval spans the safety threshold; not treated as safe)")
  add("- of the unknown cells, likely polluted (point estimate below 0.5): ",
      sum(clean$status == "unknown" & clean$p_clean < 0.5),
      "; leaning clean (0.5 or above): ", sum(clean$status == "unknown" & clean$p_clean >= 0.5))
  add("")
  if (identical(attr(clean, "method"), "fallback")) {
    add("Note: fewer than 10 test sites, so the nearest-site Beta-Binomial fallback was used instead of the spatial model.")
    add("")
  }
  add("## Rainfall")
  add("")
  add(sprintf("Mean monthly rain across cells: %.0f mm (range %.0f to %.0f mm), from the fitted rain surface.",
              mean(rain$mean_mm), min(rain$mean_mm), max(rain$mean_mm)))
  add("")
  add("## Hubs")
  add("")
  if (nrow(hubs) == 0) {
    add("**", attr(hubs, "message") %||% "no safe hub found", "**: no cell is both clean enough and rain-reliable enough.")
    add("")
    add("Fallback actions:")
    add("")
    add("1. Collect more water tests near promising cells so 'unknown' cells can resolve to clean or polluted.")
    add("2. Treat water at the point of use and use existing sources until a safe hub is confirmed.")
    add("3. Reconsider the assumptions (smaller demand per hub, larger roof area) listed below.")
  } else {
    add("| Hub cell | x (km) | y (km) | P(clean) | Reliability | Tank for target (L) |")
    add("|---|---|---|---|---|---|")
    for (i in seq_len(nrow(hubs))) {
      add(sprintf("| %d | %.1f | %.1f | %.2f | %.2f | %s |", hubs$cell_id[i], hubs$x[i], hubs$y[i],
                  hubs$p_clean[i], hubs$reliability[i],
                  if (is.na(hubs$tank_l[i])) "none reaches target" else format(hubs$tank_l[i], big.mark = ",", scientific = FALSE)))
    }
  }
  add("")
  add("## Supply allocation")
  add("")
  add("- Areas: ", nrow(allocation))
  if ("served_people" %in% names(allocation)) add("- Areas reached: ", nrow(allocation) - n_un, " (areas can be served in part; ",
                                                    format(round(sum(allocation$served_people)), big.mark = ",", scientific = FALSE), " people allocated)")
  else add("- Served: ", nrow(allocation) - n_un)
  add("- Unserved areas: ", n_un)
  if (n_un > 0 && n_un <= 30) add("- Unserved IDs: ", paste(allocation$area_id[is.na(allocation$hub_id)], collapse = ", "))
  add("")
  add("## Assumptions")
  add("")
  if (!is.null(cfg)) {
    add(sprintf("- Safety threshold: P(clean) >= %.2f with interval width <= %.2f (config.yml)",
                cfg$thresholds$clean_p, cfg$thresholds$max_interval))
    add(sprintf("- Reliability target: %.2f (config.yml)", cfg$reliability_target))
  }
  add("- Tank simulation draws cell rain parameters independently, not from the full joint posterior.")
  add("- Allocation is greedy (", if (!is.null(cfg) && isTRUE(cfg$allocate_by_exposure)) "most exposed areas first" else "lowest access first",
      ", nearest hub with capacity), not optimal.")
  dir.create(dirname(path), showWarnings = FALSE, recursive = TRUE)
  writeLines(L, path)
  path
}

`%||%` <- function(a, b) if (is.null(a)) b else a
