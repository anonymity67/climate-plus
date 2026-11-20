# Download real rainfall (CHIRPS) and population (WorldPop) for the Dhaka study area.
# Run ONCE on a computer with normal internet, from the project root:
#     source("scripts/fetch_real_inputs.R")
# Writes: data/real/chirps_dhaka_monthly.csv, chirps_dhaka_daily_2020.csv  and  data/real/worldpop_bgd_2020_1km.tif
# Then run_real.R picks both up automatically.
# If a download fails, the message says where to get the file by hand.

dir.create("data/real", showWarnings = FALSE, recursive = TRUE)
options(timeout = 600)

# ---- study-area box from the water-quality file (+ 0.2 deg margin) ----
q <- utils::read.csv("data/real/dhaka_water_quality.csv", check.names = FALSE)
lat <- range(q$Latitude, na.rm = TRUE) + c(-0.2, 0.2)
lon <- range(q$Longitude, na.rm = TRUE) + c(-0.2, 0.2)
snap <- function(v) round(v / 0.05) * 0.05 + 0.025          # CHIRPS cell centres sit at x.x25 / x.x75
lat <- c(snap(lat[1]), snap(lat[2])); lon <- c(snap(lon[1]), snap(lon[2]))
message(sprintf("Study box: lat %.3f to %.3f, lon %.3f to %.3f", lat[1], lat[2], lon[1], lon[2]))

# ---- CHIRPS v2.0 via NOAA ERDDAP ----
# The ERDDAP DAILY series is sparse before 2020 (only a few dates per year), so:
#   monthly totals 2017-2021 come from the MONTHLY dataset (60 months), and
#   wet-day fractions come from the DAILY dataset for 2020 (one complete year).
erddap <- function(id, t0, t1, out) {
  if (file.exists(out)) return(invisible(TRUE))
  q_str <- sprintf("precip[(%sT00:00:00Z):1:(%sT00:00:00Z)][(%.3f):1:(%.3f)][(%.3f):1:(%.3f)]", t0, t1, lat[1], lat[2], lon[1], lon[2])
  q_str <- gsub("\\[", "%5B", gsub("\\]", "%5D", gsub("\\(", "%28", gsub("\\)", "%29", q_str))))
  url <- paste0("https://coastwatch.pfeg.noaa.gov/erddap/griddap/", id, ".csv?", q_str)
  for (try in 1:4) {                                    # ERDDAP sometimes answers 503: wait and retry
    ok <- tryCatch({ utils::download.file(url, out, mode = "wb", quiet = TRUE); TRUE },
                   error = function(e) { message(id, " attempt ", try, " failed: ", conditionMessage(e)); FALSE },
                   warning = function(w) { message(id, " attempt ", try, " failed: ", conditionMessage(w)); FALSE })
    if (ok) { message(id, ": ", length(readLines(out)) - 2, " rows"); return(invisible(TRUE)) }
    if (file.exists(out)) file.remove(out)
    Sys.sleep(10 * try)
  }
  stop("Download of ", id, " failed after 4 tries. Run the script again in a few minutes.", call. = FALSE)
}
erddap("chirps20GlobalMonthlyP05", "2017-01-01", "2021-12-01", "data/real/chirps_dhaka_monthly.csv")
erddap("chirps20GlobalDailyP05",   "2020-01-01", "2020-12-31", "data/real/chirps_dhaka_daily_2020.csv")
message("CHIRPS ready in data/real/")

# ---- WorldPop Bangladesh 2020, 1 km, UN-adjusted ----
wp_out <- "data/real/worldpop_bgd_2020_1km.tif"
if (!file.exists(wp_out)) {
  url <- "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/2020/BGD/bgd_ppp_2020_1km_Aggregated_UNadj.tif"
  ok <- tryCatch({ utils::download.file(url, wp_out, mode = "wb"); TRUE },
                 error = function(e) { message("WorldPop failed: ", conditionMessage(e)); FALSE })
  if (!ok) { if (file.exists(wp_out)) file.remove(wp_out)
    stop("WorldPop download failed. Fallback: open https://hub.worldpop.org , search 'Bangladesh', pick ",
         "'Population counts, 2020, 1km, UN adjusted', download the .tif and save it as ", wp_out, call. = FALSE) }
}
message("WorldPop ready: ", wp_out)
message("Next: source('run_real.R')")
