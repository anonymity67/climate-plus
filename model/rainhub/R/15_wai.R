# Water Access Index (WAI): one number for the whole system.
#   E_i = P(S(u_i) > tau)                 chance the local river is severely polluted (need$p_severe)
#   C_i = R_hub(i) * share served         chance a hub supplies the area (allocation$p_served x people share)
#   A_i = (1 - E_i) + E_i * C_i           chance the area is not left exposed
#   WAI = sum(pop_i * A_i) / sum(pop_i)   0 to 1
# What it means: the expected share of people who are NOT left depending on a severely polluted river,
# either because their river is not severely polluted or because a rain hub covers them.
# What it does not know: piped or groundwater supply. It is an index of river exposure and rain cover,
# not a census of who has safe tap water.
# Scenarios (same formula, different inputs):
#   baseline            C = 0
#   rain hubs           C as allocated
#   cleanup only        areas within cfg$exposure_km of the top-n cleanup-priority cells get E x (1 - cleanup_effect), C = 0
#                       cleanup_effect = cfg$cleanup_effect, default 0.5 (ASSUMPTION: cleanup halves the chance of severe pollution)
#   hubs + cleanup      both
# With cleanup_effect = 1 the cleanup scenario is an idealised upper bound (river fully restored).

# E, C and the "cleaned" flag per area, shared by the functions below.
.wai_parts <- function(need, allocation, prio, cfg, top_n) {
  km <- if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km
  C <- allocation$p_served[match(need$area_id, allocation$area_id)]
  C[is.na(C)] <- 0
  if ("served_people" %in% names(allocation)) {
    fr <- allocation$served_people[match(need$area_id, allocation$area_id)] / need$population
    C <- C * pmin(pmax(ifelse(is.na(fr), 0, fr), 0), 1)
  }
  top <- top_priority(prio, top_n)
  cleaned <- rep(FALSE, nrow(need))
  for (j in seq_len(nrow(top)))
    cleaned <- cleaned | sqrt((need$x - top$x[j])^2 + (need$y - top$y[j])^2) <= km
  list(E = need$p_severe, C = C, cleaned = cleaned, pop = need$population)
}
.wai <- function(pop, E, C) sum(pop * ((1 - E) + E * C)) / sum(pop)

wai_scenarios <- function(need, allocation, prio, cfg, top_n = 10) {
  k <- .wai_parts(need, allocation, prio, cfg, top_n)
  eff <- if (is.null(cfg$cleanup_effect)) 0.5 else cfg$cleanup_effect
  E_clean <- ifelse(k$cleaned, k$E * (1 - eff), k$E)
  sc <- data.frame(
    scenario = c("Baseline (no action)", "Rain hubs only", sprintf("Cleanup only (zones around the top %d cells)", top_n), "Rain hubs + cleanup"),
    wai = c(.wai(k$pop, k$E, 0), .wai(k$pop, k$E, k$C), .wai(k$pop, E_clean, 0), .wai(k$pop, E_clean, k$C)),
    stringsAsFactors = FALSE)
  sc$people_not_exposed <- sc$wai * sum(k$pop)
  sc$gain_vs_baseline <- sc$wai - sc$wai[1]
  attr(sc, "population") <- sum(k$pop)
  attr(sc, "cleaned_population") <- sum(k$pop[k$cleaned])
  attr(sc, "cleanup_effect") <- eff
  sc
}

# The cleanup effect is an assumption, so show the answer for several values of it.
wai_sensitivity <- function(need, allocation, prio, cfg, top_n = 10, effects = c(0.25, 0.5, 0.75, 1)) {
  k <- .wai_parts(need, allocation, prio, cfg, top_n)
  data.frame(cleanup_effect = effects,
             wai_cleanup_only = vapply(effects, function(e) .wai(k$pop, ifelse(k$cleaned, k$E * (1 - e), k$E), 0), numeric(1)),
             wai_hubs_and_cleanup = vapply(effects, function(e) .wai(k$pop, ifelse(k$cleaned, k$E * (1 - e), k$E), k$C), numeric(1)))
}

write_wai_section <- function(sc, path, cfg, sens = NULL) {
  L <- c("", "## Water Access Index (WAI)", "",
    "```",
    "E_i = P(severity > tau)             chance the local river is severely polluted",
    "C_i = hub reliability x share of the area a hub serves",
    "A_i = (1 - E_i) + E_i * C_i         chance the area is not left exposed",
    "WAI = sum(pop_i * A_i) / sum(pop_i)  0 to 1",
    "```", "",
    "WAI is the expected share of people who are not left depending on a severely polluted river: their river is",
    "not severely polluted, or a rain hub covers them. It does not know about piped or groundwater supply.", "",
    "| scenario | WAI | people not exposed | gain vs baseline |", "|---|---|---|---|")
  for (i in seq_len(nrow(sc)))
    L <- c(L, sprintf("| %s | %.3f | %s | %+.3f |", sc$scenario[i], sc$wai[i],
                      format(round(sc$people_not_exposed[i]), big.mark = ",", scientific = FALSE), sc$gain_vs_baseline[i]))
  L <- c(L, "", sprintf("Population in the demand areas: %s. Cleanup rows assume that cleaning the zones within %s km of the top-priority cells (%s people live in them) cuts the chance of severe pollution by %.0f%% (an assumption).",
                        format(round(attr(sc, "population")), big.mark = ",", scientific = FALSE), if (is.null(cfg$exposure_km)) 5 else cfg$exposure_km,
                        format(round(attr(sc, "cleaned_population")), big.mark = ",", scientific = FALSE), 100 * attr(sc, "cleanup_effect")))
  if (!is.null(sens)) {
    L <- c(L, "", "Because that cut is an assumption, here is the index for other values of it:", "",
           "| cleanup cuts severe chance by | WAI, cleanup only | WAI, hubs + cleanup |", "|---|---|---|")
    for (i in seq_len(nrow(sens)))
      L <- c(L, sprintf("| %.0f%% | %.3f | %.3f |", 100 * sens$cleanup_effect[i], sens$wai_cleanup_only[i], sens$wai_hubs_and_cleanup[i]))
  }
  cat(L, file = path, append = TRUE, sep = "\n")
  invisible(path)
}

# How far could rain hubs alone go? IDEALISED upper bound: each hub's capacity goes to the most exposed
# people left anywhere in the region (no distance limit), at the given reliability.
# Returns one row per hub count: people covered, WAI, and gain over the baseline.
hub_scaleup <- function(need, cfg, reliability, n_hubs = c(15, 50, 100, 250, 500, 1000, 2500)) {
  cap <- cfg$hub_capacity_people
  o <- order(-need$p_severe, -need$population)
  E <- need$p_severe[o]; pop <- need$population[o]; cum <- cumsum(pop)
  base <- .wai(pop, E, 0)
  out <- lapply(n_hubs, function(n) {
    budget <- n * cap
    take <- pmin(pop, pmax(0, budget - (cum - pop)))        # people covered in each area, most exposed first
    data.frame(n_hubs = n, people_covered = sum(take),
               wai = base + reliability * sum(E * take) / sum(pop))
  })
  out <- do.call(rbind, out)
  out$gain_vs_baseline <- out$wai - base
  out
}

# APPENDS '### How many hubs?' to a markdown report.
write_scaleup_section <- function(su, path, cfg) {
  L <- c("", "### How many hubs would it take?", "",
         sprintf("Upper bound: every hub (%s people each) serves the most exposed people left, with no distance limit.",
                 format(cfg$hub_capacity_people, big.mark = ",", scientific = FALSE)), "",
         "| hubs | people covered | WAI | gain vs baseline |", "|---|---|---|---|")
  for (i in seq_len(nrow(su)))
    L <- c(L, sprintf("| %s | %s | %.3f | %+.3f |", format(su$n_hubs[i], big.mark = ",", scientific = FALSE),
                      format(round(su$people_covered[i]), big.mark = ",", scientific = FALSE), su$wai[i], su$gain_vs_baseline[i]))
  cat(L, file = path, append = TRUE, sep = "\n")
  invisible(path)
}
