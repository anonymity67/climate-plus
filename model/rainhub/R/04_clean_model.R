# Cleanliness surface: binomial SPDE model on water-quality tests, with a
# Beta-Binomial nearest-site fallback when there are too few sites.

# Status rule. Never call water clean or polluted when evidence is thin:
#  clean    : lower >= clean_p
#  polluted : upper <  clean_p
#  unknown  : otherwise, and always when the interval is wider than max_interval.
.clean_status <- function(lower, upper, cfg) {
  thr <- cfg$thresholds$clean_p
  status <- ifelse(lower >= thr, "clean", ifelse(upper < thr, "polluted", "unknown"))
  status[(upper - lower) > cfg$thresholds$max_interval] <- "unknown"
  status
}

# Fallback (no INLA needed): each grid cell takes the Beta-Binomial posterior of
# its nearest site. Pure base R + beta_binomial_update().
fit_clean_fallback <- function(quality_obs, grid, cfg) {
  if (nrow(quality_obs) == 0) stop("quality_obs has no usable rows", call. = FALSE)
  nearest <- vapply(seq_len(nrow(grid)), function(i) {
    which.min((quality_obs$x - grid$x[i])^2 + (quality_obs$y - grid$y[i])^2)
  }, integer(1))
  bb <- beta_binomial_update(quality_obs$passes[nearest], quality_obs$tests[nearest])
  out <- data.frame(cell_id = grid$cell_id, p_clean = bb$mean,
                    lower = bb$lower, upper = bb$upper)
  out$status <- .clean_status(out$lower, out$upper, cfg)
  attr(out, "method") <- "fallback"
  out
}

fit_clean_surface <- function(quality_obs, grid, cfg) {
  need <- c("site_id", "x", "y", "tests", "passes")
  miss <- setdiff(need, names(quality_obs))
  if (length(miss)) stop("quality_obs is missing column(s): ", paste(miss, collapse = ", "), call. = FALSE)
  ok <- stats::complete.cases(quality_obs[, need])
  if (!all(ok)) {
    message("fit_clean_surface: dropping ", sum(!ok), " quality_obs row(s) with missing values")
    quality_obs <- quality_obs[ok, , drop = FALSE]
  }
  if (any(quality_obs$passes > quality_obs$tests | quality_obs$passes < 0)) {
    stop("quality_obs$passes must be between 0 and tests", call. = FALSE)
  }

  if (nrow(quality_obs) < 10) {
    message("fit_clean_surface: only ", nrow(quality_obs), " site(s) (< 10); using the ",
            "Beta-Binomial nearest-site fallback instead of the spatial model (method = \"fallback\")")
    return(fit_clean_fallback(quality_obs, grid, cfg))
  }

  .require_inla("fit_clean_surface")
  mesh <- make_mesh(cfg, quality_obs)
  span <- .region_span(cfg)
  # PC priors: P(range < span/5) = 0.5; P(sigma > 3) = 0.01 on the logit scale
  # (pollution hotspots can move the logit by several units).
  spde <- INLA::inla.spde2.pcmatern(mesh, alpha = 2,
                                    prior.range = c(span / 5, 0.5), prior.sigma = c(3, 0.01))
  idx <- INLA::inla.spde.make.index("spatial", n.spde = spde$n.spde)
  A_est  <- INLA::inla.spde.make.A(mesh, loc = as.matrix(quality_obs[, c("x", "y")]))
  A_pred <- INLA::inla.spde.make.A(mesh, loc = as.matrix(grid[, c("x", "y")]))
  n_est <- nrow(quality_obs); n_pred <- nrow(grid)

  stk <- INLA::inla.stack(
    INLA::inla.stack(tag = "est",
      data = list(y = quality_obs$passes, Ntrials = quality_obs$tests),
      A = list(A_est, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_est)))),
    INLA::inla.stack(tag = "pred",
      data = list(y = rep(NA_real_, n_pred), Ntrials = rep(1, n_pred)),
      A = list(A_pred, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_pred)))))

  fml <- y ~ 0 + b0 + f(spatial, model = spde)
  fit <- INLA::inla(
    fml, family = "binomial", data = INLA::inla.stack.data(stk),
    Ntrials = INLA::inla.stack.data(stk)$Ntrials,
    control.predictor = list(A = INLA::inla.stack.A(stk), compute = TRUE),
    verbose = FALSE)

  ip <- INLA::inla.stack.index(stk, "pred")$data
  sl <- fit$summary.linear.predictor[ip, ]
  # All on the LOGIT scale, then mapped to probabilities here. (INLA's summary.fitted.values
  # for NA-response prediction rows can come back WITHOUT the inverse link, which produced
  # negative / above-one 'probabilities' on real data, so it is not used.)
  # Interval = plogis of the 2.5% / 97.5% logit quantiles. p_clean = plogis(eta / sqrt(1 + pi s^2 / 8))
  # (probit approximation of the posterior mean probability), clamped inside the interval.
  lo <- stats::plogis(sl[["0.025quant"]])
  hi <- stats::plogis(sl[["0.975quant"]])
  p <- stats::plogis(sl$mean / sqrt(1 + pi * sl$sd^2 / 8))
  p <- pmin(pmax(p, lo), hi)
  out <- data.frame(cell_id = grid$cell_id, p_clean = p, lower = lo, upper = hi)
  if (any(!is.finite(as.matrix(out[, -1])))) {
    stop("fit_clean_surface: INLA returned non-finite predictions; check the input data", call. = FALSE)
  }
  out$status <- .clean_status(out$lower, out$upper, cfg)
  attr(out, "method") <- "spde"
  out
}
