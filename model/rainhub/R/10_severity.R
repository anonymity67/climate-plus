# Pollution severity index and its spatial surface.
#
# Per parameter k (temperature, pH, DO, COD, nitrate, turbidity, phosphate):
#   s_k = clamp((x_k - ref_k) / (bad_k - ref_k), 0, 1)
#   DO  : 'low is bad', ref 5, bad 0, so s = clamp((5 - DO) / 5, 0, 1)
#   pH  : deviation = distance outside [6, 9] (ref 0, bad 3 units outside)
#   S = sum_k w_k * s_k over the available (non-NA) parameters, weights renormalised to sum 1.
# S is in [0, 1]: 0 clean, 1 worst. S is NA only when every parameter is NA.
# Refs, bads, weights and their sources/assumptions live in config.yml under `severity:`.

.sev_clamp01 <- function(z) pmin(pmax(z, 0), 1)

severity_params <- function(cfg) {
  p <- cfg$severity$params
  if (is.null(p) || !length(p)) stop("config has no severity$params block", call. = FALSE)
  rows <- lapply(names(p), function(nm) {
    q <- p[[nm]]
    is_range <- identical(q$direction, "outside_range")
    data.frame(param = nm, column = q$column,
               ref = if (is_range) 0 else q$ref, bad = q$bad,
               direction = q$direction, weight = q$weight, stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  if (abs(sum(out$weight) - 1) > 1e-6) {
    stop("severity weights must sum to 1 (got ", sum(out$weight), ")", call. = FALSE)
  }
  out
}

# Severity of one parameter, vectorised. `q` is one row of severity_params() plus, for pH, the
# range limits taken from cfg.
.param_severity <- function(x, q, cfg) {
  x <- suppressWarnings(as.numeric(x))
  z <- switch(q$direction,
    high_is_bad = (x - q$ref) / (q$bad - q$ref),
    low_is_bad  = (x - q$ref) / (q$bad - q$ref),   # ref 5, bad 0: (x-5)/(0-5) = (5-x)/5
    outside_range = {
      r <- cfg$severity$params[[q$param]]
      pmax(r$ref_low - x, x - r$ref_high, 0) / q$bad
    },
    stop("unknown severity direction '", q$direction, "'", call. = FALSE))
  .sev_clamp01(z)
}

.normalise_names <- function(df) {
  names(df) <- gsub("\\s+", " ", names(df), useBytes = TRUE)
  df
}

sample_severity <- function(df, cfg) {
  df <- .normalise_names(df)
  p <- severity_params(cfg)
  # Match on ASCII-only keys so the degree sign in "Temp (°C)" cannot break the lookup when
  # R runs in a non-UTF-8 locale (the same header may arrive as UTF-8 or as native bytes).
  ascii_key <- function(x) vapply(x, function(s) {
    b <- charToRaw(s); rawToChar(b[b >= as.raw(0x20) & b <= as.raw(0x7e)])
  }, character(1), USE.NAMES = FALSE)
  idx <- match(ascii_key(p$column), ascii_key(names(df)))
  if (anyNA(idx)) {
    stop("sample_severity: missing column(s) ", paste0("'", p$column[is.na(idx)], "'", collapse = ", "),
         ". Columns found: ", paste(names(df), collapse = ", "), call. = FALSE)
  }
  S <- vapply(seq_len(nrow(p)), function(i) .param_severity(df[[idx[i]]], p[i, ], cfg),
              numeric(nrow(df)))
  S <- matrix(S, nrow = nrow(df), ncol = nrow(p))
  w <- matrix(p$weight, nrow(df), nrow(p), byrow = TRUE)
  w[is.na(S)] <- 0
  tot <- rowSums(w)
  S0 <- S; S0[is.na(S0)] <- 0
  sev <- ifelse(tot > 0, rowSums(w * S0) / tot, NA_real_)
  for (i in seq_len(nrow(p))) df[[paste0("s_", p$param[i])]] <- S[, i]
  df$severity <- sev
  df
}

# Mean severity of each site's samples. Coordinates = mean of the samples' coordinates.
site_severity <- function(df, cfg, site_col, x_col, y_col) {
  d <- sample_severity(df, cfg)
  miss <- setdiff(c(site_col, x_col, y_col), names(d))
  if (length(miss)) stop("site_severity: missing column(s) ", paste(miss, collapse = ", "), call. = FALSE)
  keep <- !is.na(d$severity) & !is.na(d[[site_col]])
  d <- d[keep, , drop = FALSE]
  sites <- unique(d[[site_col]])
  out <- do.call(rbind, lapply(sites, function(s) {
    g <- d[d[[site_col]] == s, ]
    data.frame(site_id = s, x = mean(as.numeric(g[[x_col]])), y = mean(as.numeric(g[[y_col]])),
               n = nrow(g), s_mean = mean(g$severity), stringsAsFactors = FALSE)
  }))
  if (is.null(out)) {
    out <- data.frame(site_id = character(), x = numeric(), y = numeric(),
                      n = integer(), s_mean = numeric())
  }
  rownames(out) <- NULL
  out
}

# p_severe = P(S > tau). Normal approximation: S is treated as Normal(s_mean, s_sd) at each
# cell, so p_severe = pnorm((s_mean - tau) / s_sd). S is bounded in [0, 1], so this is rough
# near the edges.
.p_severe <- function(s_mean, s_sd, tau) stats::pnorm((s_mean - tau) / s_sd)

# Fallback (no INLA needed): each cell takes the mean of its nearest site. Uncertainty:
# s_sd = (spread of site means, or 0.25 if only one site) / sqrt(n samples at that site),
# floored at 0.02 so p_severe stays defined.
fit_severity_fallback <- function(sev_obs, grid, cfg) {
  if (nrow(sev_obs) == 0) stop("sev_obs has no usable rows", call. = FALSE)
  nearest <- vapply(seq_len(nrow(grid)), function(i) {
    which.min((sev_obs$x - grid$x[i])^2 + (sev_obs$y - grid$y[i])^2)
  }, integer(1))
  spread <- if (nrow(sev_obs) > 1) stats::sd(sev_obs$s_mean) else 0.25
  if (!is.finite(spread) || spread <= 0) spread <- 0.25
  s_mean <- sev_obs$s_mean[nearest]
  s_sd <- pmax(spread / sqrt(pmax(sev_obs$n[nearest], 1)), 0.02)
  out <- data.frame(cell_id = grid$cell_id, s_mean = s_mean, s_sd = s_sd,
                    p_severe = .p_severe(s_mean, s_sd, cfg$severity$tau))
  attr(out, "method") <- "fallback"
  out
}

# R-INLA SPDE: Gaussian model on site-mean severity, `scale = n` so a site with more samples
# has a more precise mean (observation precision multiplied by n).
fit_severity_surface <- function(sev_obs, grid, cfg) {
  need <- c("site_id", "x", "y", "n", "s_mean")
  miss <- setdiff(need, names(sev_obs))
  if (length(miss)) stop("sev_obs is missing column(s): ", paste(miss, collapse = ", "), call. = FALSE)
  ok <- stats::complete.cases(sev_obs[, need])
  if (!all(ok)) {
    message("fit_severity_surface: dropping ", sum(!ok), " sev_obs row(s) with missing values")
    sev_obs <- sev_obs[ok, , drop = FALSE]
  }
  if (any(sev_obs$s_mean < 0 | sev_obs$s_mean > 1 | sev_obs$n < 1)) {
    stop("sev_obs$s_mean must be in [0, 1] and n >= 1", call. = FALSE)
  }
  min_sites <- cfg$severity$min_sites_for_spde
  if (nrow(sev_obs) < min_sites) {
    message("fit_severity_surface: only ", nrow(sev_obs), " site(s) (< ", min_sites,
            "); using the nearest-site fallback instead of the spatial model (method = \"fallback\")")
    return(fit_severity_fallback(sev_obs, grid, cfg))
  }

  .require_inla("fit_severity_surface")
  mesh <- make_mesh(cfg, sev_obs)
  span <- .region_span(cfg)
  # PC priors: P(range < span/5) = 0.5; P(sigma > 0.5) = 0.01 (S lives in [0, 1]).
  spde <- INLA::inla.spde2.pcmatern(mesh, alpha = 2,
                                    prior.range = c(span / 5, 0.5), prior.sigma = c(0.5, 0.01))
  idx <- INLA::inla.spde.make.index("spatial", n.spde = spde$n.spde)
  A_est  <- INLA::inla.spde.make.A(mesh, loc = as.matrix(sev_obs[, c("x", "y")]))
  A_pred <- INLA::inla.spde.make.A(mesh, loc = as.matrix(grid[, c("x", "y")]))
  n_est <- nrow(sev_obs); n_pred <- nrow(grid)

  stk <- INLA::inla.stack(
    INLA::inla.stack(tag = "est",
      data = list(y = sev_obs$s_mean, scl = sev_obs$n),
      A = list(A_est, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_est)))),
    INLA::inla.stack(tag = "pred",
      data = list(y = rep(NA_real_, n_pred), scl = rep(1, n_pred)),
      A = list(A_pred, 1),
      effects = list(idx, data.frame(b0 = rep(1, n_pred)))))

  fml <- y ~ 0 + b0 + f(spatial, model = spde)
  fit <- INLA::inla(
    fml, family = "gaussian", data = INLA::inla.stack.data(stk),
    scale = INLA::inla.stack.data(stk)$scl,
    control.predictor = list(A = INLA::inla.stack.A(stk), compute = TRUE),
    verbose = FALSE)

  ip <- INLA::inla.stack.index(stk, "pred")$data
  sl <- fit$summary.linear.predictor[ip, ]
  s_mean <- sl$mean
  s_sd <- pmax(sl$sd, 1e-6)
  out <- data.frame(cell_id = grid$cell_id, s_mean = s_mean, s_sd = s_sd,
                    p_severe = .p_severe(s_mean, s_sd, cfg$severity$tau))
  if (any(!is.finite(as.matrix(out[, -1])))) {
    stop("fit_severity_surface: INLA returned non-finite predictions; check the input data", call. = FALSE)
  }
  attr(out, "method") <- "spde"
  out
}
