for (f in sort(list.files("../../R", pattern = "\\.R$", full.names = TRUE))) source(f)

# Tiny hand-built run shared by the film and platform-export tests.
film_fixture <- function() {
  grid <- expand.grid(x = c(1, 3), y = c(1, 3)); grid$cell_id <- 1:4; grid <- grid[, c("cell_id", "x", "y")]
  need <- data.frame(area_id = c("A", "B"), x = c(1, 3), y = c(1, 3), population = c(1000, 3000), p_severe = c(0.8, 0.2))
  need$need <- need$population * need$p_severe
  hubs <- data.frame(cell_id = 1L, x = 1, y = 1, reliability = 0.9, tank_l = 1e6, p_clean = 0.1)
  alloc <- data.frame(area_id = c("A", "B"), hub_id = c(1L, NA), distance_km = c(0, NA), p_served = c(0.9, 0), served_people = c(500, 0))
  prio <- data.frame(cell_id = 1L, x = 1, y = 1, s_mean = 0.4, pop_exposed = 1000, rain_coverage = 0.45, priority = 220)
  cfg <- list(hub_capacity_people = 500, exposure_km = 1, severity = list(tau = 0.35),
              season = list(monthly_mm = c(9, 15, 67, 222, 333, 341, 461, 306, 270, 234, 26, 17)))
  settlements <- need[, c("area_id", "x", "y", "population")]; attr(settlements, "source") <- "WorldPop"
  list(res = list(grid = grid, severity = data.frame(cell_id = 1:4, s_mean = c(0.4, 0.3, 0.25, 0.2)), need = need, hubs = hubs,
                  alloc = alloc, gap = compute_gap(need, alloc), prio = prio, top = prio, settlements = settlements,
                  wai = wai_scenarios(need, alloc, prio, cfg, top_n = 1), cfg = cfg),
       d = list(quality_obs = data.frame(site_id = c("s1", "s2"), x = 1, y = 1, tests = c(10, 10), passes = c(3, 0))))
}
