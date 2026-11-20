# Rainfall surface: two R-INLA SPDE models on station data.
#  (1) Gaussian on log(1 + station-mean monthly rain)  -> mean monthly rain
#  (2) Binomial on wet_days / days                -> wet-day probability
# Both are predicted on the grid through an inla.stack with NA-response
# prediction rows, so the posterior sd includes the intercept and field jointly.

fit_rain_surface <- function(rain_obs, grid, cfg) {
  .require_inla("fit_rain_surface")
  need <- c("station_id", "x", "y", "rain_mm", "wet_days", "days")
  miss <- setdiff(need, names(rain_obs))
  if (length(miss)) stop("rain_obs is missing column(s): ", paste(miss, collapse = ", "), call. = FALSE)
  ok <- stats::complete.cases(rain_obs[, need])
  if (!all(ok)) {
    message("fit_rain_surface: dropping ", sum(!ok), " rain_obs row(s) with missing values")
    rain_obs <- rain_obs[ok, , drop = FALSE]
  }
  if (nrow(rain_obs) == 0) stop("rain_obs has no usable rows", call. = FALSE)
  if (any(rain_obs$rain_mm < 0)) stop("rain_obs$rain_mm has negative values", call. = FALSE)
  if (any(rain_obs$wet_days > rain_obs$days | rain_obs$wet_days < 0)) {
    stop("rain_obs$wet_days must be between 0 and days", call. = FALSE)
  }

  # One record per station. log1p keeps zero-rain months finite.
  rain_obs$z <- log1p(rain_obs$rain_mm)
  ids <- unique(rain_obs$station_id)
  st <- do.call(rbind, lapply(ids, function(id) {
    d <- rain_obs[rain_obs$station_id == id, , drop = FALSE]
    data.frame(station_id = id, x = d$x[1], y = d$y[1],
               z = log1p(mean(d$rain_mm)), k = nrow(d),
               wet = sum(d$wet_days), trials = sum(d$days),
               ss = sum((d$z - mean(d$z))^2))
  }))
  # Pooled within-station variance of monthly log-rain (0 if every station has 1 month).
  dof <- sum(st$k - 1)
  # The station value is log(1 + mean monthly rain), i.e. the log of the MEAN, not the mean of
  # monthly logs, so no log-normal correction is needed. (The old correction exp(sigma_w2/2)
  # inflated rain about six-fold on real data with many zero-rain days.)
  sigma_w2 <- 0

  mesh <- make_mesh(cfg, st)
  span <- .region_span(cfg)
  # Penalised-complexity priors: P(range < span/5) = 0.5, P(sigma > s0) = 0.01.
  spde_g <- INLA::inla.spde2.pcmatern(mesh, alpha = 2,
                                      prior.range = c(span / 5, 0.5), prior.sigma = c(2, 0.01))
  spde_b <- INLA::inla.spde2.pcmatern(mesh, alpha = 2,
                                      prior.range = c(span / 5, 0.5), prior.sigma = c(2, 0.01))

  A_est  <- INLA::inla.spde.make.A(mesh, loc = as.matrix(st[, c("x", "y")]))
  A_pred <- INLA::inla.spde.make.A(mesh, loc = as.matrix(grid[, c("x", "y")]))
  n_est <- nrow(st); n_pred <- nrow(grid)

  build_stack <- function(spde, y_est, trials_est, scale_est) {
    idx <- INLA::inla.spde.make.index("spatial", n.spde = spde$n.spde)
    s_est <- INLA::inla.stack(
      tag = "est",
      data = list(y = y_est, Ntrials = trials_est, scl = scale_est),
      A = list(A_est, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_est))))
    s_pred <- INLA::inla.stack(
      tag = "pred",
      data = list(y = rep(NA_real_, n_pred), Ntrials = rep(1, n_pred), scl = rep(1, n_pred)),
      A = list(A_pred, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_pred))))
    INLA::inla.stack(s_est, s_pred)
  }

  # --- (1) Gaussian on station-mean log(rain + 1) ---
  # `scale = k` because a station mean over k months has noise variance sigma^2 / k.
  stk_g <- build_stack(spde_g, st$z, rep(1, n_est), st$k)
  f_g <- y ~ 0 + b0 + f(spatial, model = spde_g)
  fit_g <- INLA::inla(
    f_g, family = "gaussian", data = INLA::inla.stack.data(stk_g),
    scale = INLA::inla.stack.data(stk_g)$scl,
    control.predictor = list(A = INLA::inla.stack.A(stk_g), compute = TRUE),
    verbose = FALSE)
  ip <- INLA::inla.stack.index(stk_g, "pred")$data
  m <- fit_g$summary.linear.predictor$mean[ip]   # posterior mean of eta = E[log(rain+1)]
  s <- fit_g$summary.linear.predictor$sd[ip]     # posterior sd of eta

  # Back-transform (delta method). Let g(eta) = exp(eta + sigma_w2 / 2) - 1, where
  # sigma_w2 is the pooled month-to-month variance of log(rain + 1) within stations
  # (log-normal mean correction: E[R + 1] = exp(eta + sigma_w2 / 2)).
  #   mean_mm = g(m)
  #   sd_mm   = |g'(m)| * s = exp(m + sigma_w2 / 2) * s
  # First-order approximation: it ignores curvature, so it is rough where s is large.
  # Zero-rain stations are safe because log1p(0) = 0 (finite).
  e <- exp(m + sigma_w2 / 2)
  mean_mm <- pmax(0, e - 1)
  sd_mm <- e * s

  # --- (2) Binomial on wet_days / days (logit link) ---
  stk_b <- build_stack(spde_b, st$wet, st$trials, rep(1, n_est))
  f_b <- y ~ 0 + b0 + f(spatial, model = spde_b)
  fit_b <- INLA::inla(
    f_b, family = "binomial", data = INLA::inla.stack.data(stk_b),
    Ntrials = INLA::inla.stack.data(stk_b)$Ntrials,
    control.predictor = list(A = INLA::inla.stack.A(stk_b), compute = TRUE),
    verbose = FALSE)
  ib <- INLA::inla.stack.index(stk_b, "pred")$data
  # NOTE: for NA-response prediction rows INLA can return summary.fitted.values on the
  # LINEAR-predictor scale (no inverse link), which gave negative 'probabilities' on real data.
  # So take the linear predictor (logit scale) and map it to a probability ourselves:
  # E[p] ~ plogis(eta / sqrt(1 + pi * s^2 / 8)) (probit approximation), sd(p) ~ p (1 - p) * s.
  eta_b <- fit_b$summary.linear.predictor$mean[ib]
  s_b <- fit_b$summary.linear.predictor$sd[ib]
  p_wet <- stats::plogis(eta_b / sqrt(1 + pi * s_b^2 / 8))
  p_wet_sd <- p_wet * (1 - p_wet) * s_b

  out <- data.frame(cell_id = grid$cell_id, mean_mm = mean_mm, sd_mm = sd_mm,
                    p_wet = p_wet, p_wet_sd = p_wet_sd)
  if (any(!is.finite(as.matrix(out[, -1])))) {
    stop("fit_rain_surface: INLA returned non-finite predictions; check the input data", call. = FALSE)
  }
  out
}
