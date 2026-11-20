# Tank reliability simulation (Task 5).
# Approximations (stated, as per plan):
#  * Rain parameters are drawn independently per draw from Normal(mean_mm, sd_mm)
#    truncated at 0 (not from the full joint posterior). mean_mm is a mean monthly
#    total over a 30-day month.
#  * Daily rain = Bernoulli(p_wet) x Gamma(shape, mean = M / (30 * p_wet)), so the
#    expected daily total is M / 30 and the expected monthly total matches the draw M.
#    Gamma shape is fixed (0.7, skewed wet-day amounts); wet days are independent.
#  * Inflow litres = rain_mm x roof_m2 x runoff_coef (1 mm on 1 m2 = 1 L).
#  * Tank starts full; each day demand is taken first, then inflow is added, capped at tank_l.
#  * Reliability = share of draws with no unmet-demand day in the window.
# Random numbers are fixed by `seed`, so results are common-random-number comparable
# across tank sizes (reliability is then exactly monotone in tank size).
tank_reliability <- function(mean_mm, sd_mm, p_wet, roof_m2, tank_l, demand_l_day,
                             n_draws = 500, days = 120, seed = 1,
                             runoff_coef = 0.8, gamma_shape = 0.7, season = NULL) {
  if (demand_l_day <= 0) return(1)
  if (!is.null(season)) return(.tank_reliability_seasonal(mean_mm, sd_mm, p_wet, roof_m2, tank_l, demand_l_day,
                                                          n_draws, seed, runoff_coef, gamma_shape, season))
  set.seed(seed)
  p_wet <- min(max(p_wet, 0), 1)
  # Truncated-at-0 Normal via inverse CDF (exact, vectorised).
  if (sd_mm > 0) {
    lo <- pnorm(0, mean_mm, sd_mm)
    m <- if (lo >= 1) rep(0, n_draws)
         else qnorm(lo + runif(n_draws) * (1 - lo), mean_mm, sd_mm)
  } else {
    m <- rep(max(mean_mm, 0), n_draws)
    runif(n_draws)
  }
  m <- pmax(m, 0)
  amount_mean <- if (p_wet > 0) m / (30 * p_wet) else rep(0, n_draws)
  wet  <- matrix(runif(n_draws * days) < p_wet, n_draws, days)
  gam  <- matrix(rgamma(n_draws * days, shape = gamma_shape), n_draws, days) / gamma_shape
  rain <- wet * gam * amount_mean            # mm per day, draws x days
  inflow <- rain * roof_m2 * runoff_coef
  store <- rep(tank_l, n_draws)
  ok <- rep(TRUE, n_draws)
  for (d in seq_len(days)) {
    ok <- ok & (store >= demand_l_day)
    store <- pmax(store - demand_l_day, 0)
    store <- pmin(store + inflow[, d], tank_l)
  }
  mean(ok)
}

# Smallest tank in `sizes` (ascending) that reaches the target. Reliability never falls when the tank grows
# (same random numbers for every size), so a binary search finds it in a few simulations.
min_tank_size <- function(mean_mm, sd_mm, p_wet, roof_m2, demand_l_day,
                          target = 0.90, sizes = seq(500, 20000, by = 500), ...) {
  rel <- function(s) tank_reliability(mean_mm, sd_mm, p_wet, roof_m2, s, demand_l_day, ...)
  sizes <- sort(sizes)
  lo <- 1L; hi <- length(sizes)
  if (rel(sizes[hi]) < target) return(NA_real_)
  while (lo < hi) {
    mid <- (lo + hi) %/% 2L
    if (rel(sizes[mid]) >= target) hi <- mid else lo <- mid + 1L
  }
  sizes[lo]
}

# Seasonal version: simulates TWO years with a monthly rain profile and scores the second one.
# season = list(mult = 12 rain multipliers, wet_mult = 12 wet-day multipliers, start_month = 1..12).
# mult[m] = (mean rain of calendar month m) / (mean over months), so the average of mult is 1 and a year's
# rain is 12 x mean_mm on average. Wet-day probability of month m = p_wet x wet_mult[m], kept between
# 1/30 and 0.98 (ASSUMPTION: at least about one wet day a month, because the wet-day data are one year only).
# The tank starts full, but year 1 is only a warm-up: by year 2 the tank level is whatever the weather left,
# so the answer does not depend on the starting month or on the full-tank start.
# Reliability = share of draws with NO unmet-demand day in year 2 (the dry season decides it).
# The spread between draws comes almost entirely from the assumed day-to-day weather (wet or dry day, Gamma
# amounts); the posterior sd of the rain surface is small and adds little.
.tank_reliability_seasonal <- function(mean_mm, sd_mm, p_wet, roof_m2, tank_l, demand_l_day,
                                       n_draws, seed, runoff_coef, gamma_shape, season) {
  days <- 730
  set.seed(seed)
  if (sd_mm > 0) {
    lo <- pnorm(0, mean_mm, sd_mm)
    m <- if (lo >= 1) rep(0, n_draws) else qnorm(lo + runif(n_draws) * (1 - lo), mean_mm, sd_mm)
  } else { m <- rep(max(mean_mm, 0), n_draws); runif(n_draws) }
  m <- pmax(m, 0)
  mon <- ((season$start_month - 1 + floor(((seq_len(days) - 1) %% 365) / (365 / 12))) %% 12) + 1
  mult <- season$mult[mon]
  pw <- pmin(pmax(p_wet * season$wet_mult[mon], 1 / 30), 0.98)
  per_day <- mult / ((365 / 12) * pw)                    # mean wet-day amount per unit of m; a month is 365/12 days
  store <- rep(tank_l, n_draws); ok <- rep(TRUE, n_draws)
  for (d in seq_len(days)) {                             # one day at a time keeps memory small for many draws
    if (d > 365) ok <- ok & (store >= demand_l_day)
    store <- pmax(store - demand_l_day, 0)
    rain <- (runif(n_draws) < pw[d]) * (rgamma(n_draws, shape = gamma_shape) / gamma_shape) * m * per_day[d]
    store <- pmin(store + rain * roof_m2 * runoff_coef, tank_l)
  }
  mean(ok)
}
