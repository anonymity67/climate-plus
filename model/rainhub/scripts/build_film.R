# Rebuild the animated film from the last real run, without re-running the models.
# Run from the project root, after run_real.R has been run at least once:
#     source("scripts/build_film.R")
# Writes outputs/real_film.html. Open it in a browser. To change the look or the wording,
# edit scripts/film_template.html; every number in the film comes from outputs/real_result.rds.
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
if (!file.exists("outputs/real_result.rds")) stop("outputs/real_result.rds not found: run source('run_real.R') first", call. = FALSE)
saved <- readRDS("outputs/real_result.rds")
build_film(saved$res, saved$d, "outputs/real_film.html")
message("Film written: outputs/real_film.html")
