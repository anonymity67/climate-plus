# Hub selection and supply allocation (Task 6).
# Coordinates (grid and settlements) are in km, so distances are plain Euclidean km.
#
# Signature note: the plan says select_hubs(rain, clean, cfg, n_max = 5). Cell
# coordinates are not in the rain/clean surfaces, so a `grid` data frame
# (cell_id, x, y) is added after cfg with no default:
#   select_hubs(rain, clean, cfg, grid, n_max = 5)
#
# Config keys read (documented in config.yml): hub_roof_m2, hub_demand_l_day,
# hub_tank_l, runoff_coef, reliability_target, thresholds$clean_p.

.empty_hubs <- function() {
  out <- data.frame(cell_id = integer(0), x = numeric(0), y = numeric(0),
                    reliability = numeric(0), tank_l = numeric(0), p_clean = numeric(0))
  attr(out, "message") <- "no safe hub found"
  out
}

# Join the rain surface, clean surface and grid coordinates by cell_id.
.join_surfaces <- function(rain, clean, grid) {
  d <- merge(grid[, c("cell_id", "x", "y")], rain[, c("cell_id", "mean_mm", "sd_mm", "p_wet")], by = "cell_id")
  d <- merge(d, clean[, c("cell_id", "p_clean", "status")], by = "cell_id")
  d[order(d$cell_id), ]
}

# Candidates: status "clean" and p_clean >= threshold (cfg$hub_require_clean, NULL = TRUE;
# when FALSE all cells qualify, the score is reliability alone and reach is weighted by
# settlements$need if present). Score = reliability x p_clean,
# where reliability = P(demand met every day) for a tank of hub_tank_l. Greedy pick of
# the best-scoring cells that are >= min_sep_km from every hub already chosen.
# tank_l = smallest tank (500-20000 L) reaching reliability_target; NA if none does.
select_hubs <- function(rain, clean, cfg, grid, n_max = 5,
                        min_sep_km = if (is.null(cfg$hub_min_sep_km)) 3 else cfg$hub_min_sep_km,
                        settlements = NULL,
                        max_km = if (is.null(cfg$max_km)) 15 else cfg$max_km) {
  seed <- if (is.null(cfg$seed)) 1 else cfg$seed
  d <- .join_surfaces(rain, clean, grid)
  require_clean <- is.null(cfg$hub_require_clean) || isTRUE(cfg$hub_require_clean)
  if (require_clean) {
    d <- d[d$status == "clean" & d$p_clean >= cfg$thresholds$clean_p, , drop = FALSE]
  }  # else every cell is a candidate: rain-harvest hubs do not drink river water
  if (nrow(d) == 0) return(.empty_hubs())
  d$reliability <- vapply(seq_len(nrow(d)), function(i) {
    tank_reliability(d$mean_mm[i], d$sd_mm[i], d$p_wet[i], roof_m2 = cfg$hub_roof_m2,
                     tank_l = cfg$hub_tank_l, demand_l_day = cfg$hub_demand_l_day,
                     seed = seed, runoff_coef = cfg$runoff_coef, season = cfg$season)
  }, numeric(1))
  min_rel <- if (is.null(cfg$hub_min_reliability)) 0 else cfg$hub_min_reliability
  rel_all <- d$reliability
  d <- d[d$reliability > 0 & d$reliability >= min_rel, , drop = FALSE]  # weak hubs are not hubs
  if (nrow(d) == 0) {
    message("select_hubs: no cell reaches reliability ", min_rel, ". Best reliability over ", length(rel_all),
            " candidate cells: ", round(max(rel_all), 3), " (median ", round(stats::median(rel_all), 3),
            "). Median surface values: mean_mm ", round(stats::median(rain$mean_mm), 1), ", sd_mm ",
            round(stats::median(rain$sd_mm), 1), ", p_wet ", round(stats::median(rain$p_wet), 3), ".")
    return(.empty_hubs())
  }
  d$score <- if (require_clean) d$reliability * d$p_clean else d$reliability
  if (!is.null(settlements) && nrow(settlements) > 0) {
    # Put hubs where people (or, if a `need` column exists and hub_require_clean is
    # FALSE, where unmet need) are: weight by the share of the total within max_km.
    w <- settlements$population
    if (!require_clean && "need" %in% names(settlements) && sum(settlements$need, na.rm = TRUE) > 0) {
      w <- settlements$need
    }
    w[is.na(w)] <- 0
    reach <- vapply(seq_len(nrow(d)), function(i) {
      near <- sqrt((settlements$x - d$x[i])^2 + (settlements$y - d$y[i])^2) <= max_km
      sum(w[near])
    }, numeric(1))
    d$score <- d$score * (reach / sum(w))
    d <- d[d$score > 0, , drop = FALSE]
    if (nrow(d) == 0) return(.empty_hubs())
  }
  d <- d[order(-d$score, d$cell_id), ]
  keep <- integer(0)
  for (i in seq_len(nrow(d))) {
    if (length(keep) >= n_max) break
    if (length(keep) == 0 ||
        all(sqrt((d$x[keep] - d$x[i])^2 + (d$y[keep] - d$y[i])^2) >= min_sep_km)) {
      keep <- c(keep, i)
    }
  }
  h <- d[keep, ]
  fin <- cfg$hub_final_draws      # more draws for the chosen hubs only: screening noise is about +/- 0.013 at 500 draws
  if (!is.null(fin) && nrow(h) > 0) h$reliability <- vapply(seq_len(nrow(h)), function(i) {
    tank_reliability(h$mean_mm[i], h$sd_mm[i], h$p_wet[i], roof_m2 = cfg$hub_roof_m2,
                     tank_l = cfg$hub_tank_l, demand_l_day = cfg$hub_demand_l_day, n_draws = fin,
                     seed = seed, runoff_coef = cfg$runoff_coef, season = cfg$season)
  }, numeric(1))
  h$tank_l <- vapply(seq_len(nrow(h)), function(i) {
    min_tank_size(h$mean_mm[i], h$sd_mm[i], h$p_wet[i], roof_m2 = cfg$hub_roof_m2,
                  demand_l_day = cfg$hub_demand_l_day, target = cfg$reliability_target,
                  seed = seed, runoff_coef = cfg$runoff_coef, season = cfg$season, n_draws = if (is.null(fin)) 500 else fin,
                  sizes = if (is.null(cfg$season)) seq(500, 20000, by = 500) else seq(cfg$hub_tank_l / 20, cfg$hub_tank_l * 2, length.out = 40))
  }, numeric(1))
  out <- h[, c("cell_id", "x", "y", "reliability", "tank_l", "p_clean")]
  rownames(out) <- NULL
  out
}

# Greedy allocation: areas with the lowest access (largest access_distance_km) go first, or, when the
# settlements table has an `alloc_priority` column, the highest priority first (ties: larger population);
# each takes the nearest hub within max_km whose remaining capacity covers the whole
# population (an area is never split). Otherwise it is unserved: hub_id NA,
# distance_km NA, p_served 0. p_served = the hub's reliability. Rows follow `settlements`.
# cfg$allow_split = TRUE (real runs with real population): an area can be served only in part, up to the
# remaining capacity of its nearest hub within max_km; capacity still free afterwards tops up part-served areas.
# The people reached are in `served_people` and p_served is their people-weighted hub reliability.
allocate_supply <- function(hubs, settlements, cfg, max_km = 15, hub_capacity_people = 500) {
  n <- nrow(settlements)
  split <- isTRUE(cfg$allow_split)
  out <- data.frame(area_id = settlements$area_id, hub_id = rep(NA_integer_, n),
                    distance_km = rep(NA_real_, n), p_served = rep(0, n))
  if (split) out$served_people <- rep(0, n)
  if (nrow(hubs) > 0 && n > 0) {
    remaining <- rep(hub_capacity_people, nrow(hubs))
    ord <- if ("alloc_priority" %in% names(settlements))   # e.g. chance of severe pollution: most exposed first
      order(-settlements$alloc_priority, -settlements$population, settlements$area_id)
    else order(-settlements$access_distance_km, settlements$area_id)
    hub_dist <- function(i) sqrt((hubs$x - settlements$x[i])^2 + (hubs$y - settlements$y[i])^2)
    if (split) {
      rel_people <- rep(0, n)                      # sum of people x reliability, for the weighted p_served
      take_from <- function(i, j, dist) {
        take <- min(remaining[j], settlements$population[i] - out$served_people[i])
        remaining[j] <<- remaining[j] - take
        if (is.na(out$hub_id[i])) { out$hub_id[i] <<- as.integer(hubs$cell_id[j]); out$distance_km[i] <<- dist[j] }
        out$served_people[i] <<- out$served_people[i] + take
        rel_people[i] <<- rel_people[i] + take * hubs$reliability[j]
      }
      for (i in ord) {                             # pass 1: every area, in priority order, draws on its nearest hub with room
        dist <- hub_dist(i); ok <- which(dist <= max_km & remaining >= 1)
        if (length(ok)) take_from(i, ok[which.min(dist[ok])], dist)
      }
      for (i in ord) {                             # pass 2: capacity still free tops up part-served areas, nearest hub first
        if (out$served_people[i] >= settlements$population[i]) next
        dist <- hub_dist(i)
        for (j in order(dist)) {
          if (dist[j] > max_km || out$served_people[i] >= settlements$population[i]) break
          if (remaining[j] >= 1) take_from(i, j, dist)
        }
      }
      out$p_served <- ifelse(out$served_people > 0, rel_people / pmax(out$served_people, 1e-12), 0)
    } else {
      for (i in ord) {
        dist <- hub_dist(i)
        ok <- which(dist <= max_km & remaining >= settlements$population[i])
        if (length(ok) == 0) next
        j <- ok[which.min(dist[ok])]
        remaining[j] <- remaining[j] - settlements$population[i]
        out$hub_id[i] <- as.integer(hubs$cell_id[j])
        out$distance_km[i] <- dist[j]
        out$p_served[i] <- hubs$reliability[j]
      }
    }
  }
  out
}
