# Real data mapping and how to run on real data

> **Read this first.** The column names of the real files below were **not
> verified**. They were not downloaded or opened when this was written. The
> source descriptions come from the dataset titles and general knowledge of
> these products. Open every file yourself, read its real column headers, and
> fill in the `mapping` list from what you see. The adapter stops with a
> message naming any column it cannot find, so a wrong guess will not pass
> silently.

## Candidate sources

| Source | Use | Licence / access |
|---|---|---|
| Mendeley Data, "Water Quality and Hydroclimatic Dataset for Rivers and Streams of Dhaka, Bangladesh", https://data.mendeley.com/datasets/xftpv7jvx3/1 | `quality_obs` (and possibly rainfall, if hydroclimatic variables are included) | CC BY 4.0 (cite the authors) |
| CHIRPS daily rainfall (satellite-gauge product, about 5 km grid) | `rain_obs` | Free download |
| WorldPop population grids | `settlements.population` | Free download |
| BGS / DPHE groundwater survey (arsenic and other tube-well results) | alternative or extra `quality_obs`, and the "safe source" locations for `access_distance_km` | Check the licence of the copy you use |

## Column mapping

"Derive" means the real files do not contain this column directly; you compute it.

### `rain_obs`

| Shared column | Likely real source | Derive? |
|---|---|---|
| `station_id` | Station name, or a CHIRPS cell label you create (for example `"cell_row_col"`) | Label only |
| `x`, `y` | Station or cell-centre longitude and latitude | Yes: project to km (see below) |
| `month` | Month number 1-12 from the date | Yes, from the date |
| `rain_mm` | Monthly total of daily rainfall (CHIRPS or station daily) | Yes: sum of daily values per station per month |
| `wet_days` | Count of days above 1 mm in that month | Yes: count from daily values |
| `days` | Days in that month with a valid reading | Yes: count of non-missing daily values |

### `quality_obs`

| Shared column | Likely real source | Derive? |
|---|---|---|
| `site_id` | Sampling station name or ID | No (check spelling is consistent) |
| `x`, `y` | Station longitude and latitude | Yes: project to km |
| `tests` | Number of samples at the site | Yes: use `derive_pass_fail()` |
| `passes` | Number of samples meeting a threshold | Yes: use `derive_pass_fail()` |

The Mendeley dataset is likely to hold measurements (for example pH,
dissolved oxygen, COD, nitrate, turbidity, phosphate, a water-quality index),
not pass/fail results. You must choose the threshold and say why. Example:
dissolved oxygen of at least 5 mg/L counts as a pass (a commonly used
guide value for supporting aquatic life; check the standard you cite).
Different variables need different directions: dissolved oxygen passes when
it is above the threshold, but nitrate, COD, turbidity and phosphate pass when
they are below it. To combine several variables into one pass/fail, compute a
per-sample flag yourself first (for example all chosen variables within their
limits) and then pass that flag column to `derive_pass_fail()` with
`threshold = 1, direction = "above"`.

### `settlements`

| Shared column | Likely real source | Derive? |
|---|---|---|
| `area_id` | Ward, union, or grid-cell name | Label only |
| `x`, `y` | Area centroid longitude and latitude | Yes: project to km |
| `population` | WorldPop grid | Yes: sum the grid cells inside each area (zonal sum) |
| `access_distance_km` | Distance from the area centroid to its nearest safe source (for example a tube well from the groundwater survey that passes your safety rule) | Yes: nearest-neighbour distance, in km |

## Coordinate systems

The pipeline works in km on a flat plane, and `config.yml` region box
(`xmin`, `xmax`, `ymin`, `ymax`) must be in the same km units. Raw files are
usually longitude/latitude in degrees, which must be projected first.

1. Pick a projected CRS for your area. For Dhaka, UTM zone 46N (`EPSG:32646`)
   is a reasonable choice; confirm it for your study area.
2. Project every file with the same CRS, then divide metres by 1000:

```r
library(sf)
pts <- st_as_sf(df, coords = c("lon", "lat"), crs = 4326)
xy  <- st_coordinates(st_transform(pts, 32646)) / 1000
df$x <- xy[, 1]; df$y <- xy[, 2]
```

3. Shift the origin if you like (subtract the minimum), but do it with the
   same numbers for all three files. Set the `config.yml` region box a little
   larger than the extent of all your points.

## Step by step: how to run on real data (VS Code)

1. **Open the project.** In VS Code choose File > Open Folder and pick the
   `rainhub` folder. Open a terminal (Terminal > New Terminal); it should
   start in that folder. R and the R-INLA package must be installed on this
   computer (see the plan for the install line).
2. **Put the raw files in `data/`** (for example `data/raw/`). Keep the
   original downloads unchanged.
3. **Look at the real column names.** In the terminal run
   `Rscript -e 'str(read.csv("data/raw/yourfile.csv"))'` for each file, or
   open the CSV in VS Code. Write down the column names. This is the step
   that replaces the unverified guesses above.
4. **Prepare three tidy CSVs** in `data/` named `real_rain.csv`,
   `real_quality.csv`, `real_settlements.csv`. Do the derivations from the
   tables above (monthly sums, projection to km, population sums, distance to
   safe source). For quality, use `derive_pass_fail()`, for example:

```r
source("R/08_real_adapter.R")
raw <- read.csv("data/raw/water_quality.csv")
q <- derive_pass_fail(raw, value_col = "DO", threshold = 5, direction = "above",
                      site_col = "Station", x_col = "x_km", y_col = "y_km")
write.csv(q, "data/real_quality.csv", row.names = FALSE)
```

   Replace `"DO"`, `"Station"`, `"x_km"`, `"y_km"` with the real names you saw
   in step 3.
5. **Edit `config.yml`:** set the region box to cover your projected points
   (km), and check the thresholds and hub assumptions. Keep a copy of the
   original synthetic config.
6. **Load with the adapter.** In an R script (for example `run_real.R`) run:

```r
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
cfg  <- load_config("config.yml")
mapping <- list(station_id = "Station", rain_mm = "monthly_mm")  # only the names that differ
real <- load_real_data("data/real_rain.csv", "data/real_quality.csv",
                       "data/real_settlements.csv", mapping)
```

   Read the messages: they report any dropped rows, and an error names the
   missing column. Fix the file or the mapping and run again. Columns you do
   not list in `mapping` must already have the shared name. `x` and `y` use
   one mapping entry for all three files, so give all three files the same
   coordinate column names (or use `x` and `y` directly).
7. **Run the stages** on `real$rain_obs`, `real$quality_obs`,
   `real$settlements` in the same order as `run_all.R` (rainfall surface,
   cleanliness surface, hub selection, allocation, outputs). If the final
   pipeline script supports a switch for real data, use it; otherwise copy
   `run_all.R` to `run_real.R` and replace the line that generates synthetic
   data with the `load_real_data()` call above. Save outputs with the prefix
   `real_` and set `synthetic = FALSE` for the report.
8. **Compare** `outputs/real_*` with `outputs/synthetic_*`. Check that the
   maps look plausible, how many sites there are (fewer than 10 triggers the
   documented fallback), and how many areas are "unknown" or "unserved".
   Do not state a hub is safe unless the output says "clean".

## Limits to state in your write-up

- Thresholds for pass/fail are your choice; say which standard you used.
- River water quality is not drinking water; the "clean" label here means
  meeting your chosen threshold for the chosen variables only.
- CHIRPS is a satellite-gauge estimate, not a gauge reading.
- Column names and file layouts above are unverified assumptions.
