# Shared helpers: configuration and the prediction grid.

load_config <- function(path = "config.yml") {
  if (!file.exists(path)) stop("Config file not found: ", path)
  yaml::read_yaml(path)
}

# Grid of cell centres covering the region box in config.
make_grid <- function(cfg) {
  r <- cfg$region
  dx <- (r$xmax - r$xmin) / cfg$grid$cells_x
  dy <- (r$ymax - r$ymin) / cfg$grid$cells_y
  xs <- r$xmin + dx * (seq_len(cfg$grid$cells_x) - 0.5)
  ys <- r$ymin + dy * (seq_len(cfg$grid$cells_y) - 0.5)
  g <- expand.grid(x = xs, y = ys)
  data.frame(cell_id = seq_len(nrow(g)), x = g$x, y = g$y)
}

# Stop with a clear message when R-INLA is missing (it is not on CRAN).
# Also attaches INLA, because inla() formulas use f(...) which INLA resolves most
# reliably when the package is attached.
.require_inla <- function(fn = "this function") {
  if (!requireNamespace("INLA", quietly = TRUE)) {
    stop(fn, " needs the R-INLA package, which is not installed. ",
         "Install it with: install.packages(\"INLA\", ",
         "repos = c(getOption(\"repos\"), INLA = \"https://inla.r-inla-download.org/R/stable\"), dep = TRUE)",
         call. = FALSE)
  }
  if (!"package:INLA" %in% search()) {
    suppressPackageStartupMessages(attachNamespace("INLA"))
  }
  invisible(TRUE)
}

# Length scale of the region (longest side), used to scale mesh and priors so
# nothing depends on a particular region or unit.
.region_span <- function(cfg) {
  r <- cfg$region
  max(r$xmax - r$xmin, r$ymax - r$ymin)
}

# SPDE mesh over the whole region box, refined around the observation points.
# `points` is a data.frame or matrix with columns x and y (repeats are fine).
# max.edge: fine (span/15) inside, coarse (span/4) in the outer extension;
# cutoff merges points closer than span/60.
make_mesh <- function(cfg, points) {
  .require_inla("make_mesh")
  r <- cfg$region
  span <- .region_span(cfg)
  corners <- rbind(c(r$xmin, r$ymin), c(r$xmax, r$ymin),
                   c(r$xmax, r$ymax), c(r$xmin, r$ymax))
  loc <- unique(as.matrix(points[, c("x", "y")]))
  mesh_fn <- if (requireNamespace("fmesher", quietly = TRUE)) fmesher::fm_mesh_2d_inla else INLA::inla.mesh.2d
  mesh_fn(
    loc = loc, loc.domain = corners,
    max.edge = c(span / 15, span / 4),
    cutoff = span / 60,
    offset = c(span / 20, span / 4)
  )
}
