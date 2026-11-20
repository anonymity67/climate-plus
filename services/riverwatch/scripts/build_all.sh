#!/usr/bin/env bash
# Rebuild every RiverWatch BD output from public data (README "Prepare a real pilot").
# Takes ~15 min on 2 vCPU (OSM extraction ~3 min, Sentinel-2 pairs ~7 min).
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONWARNINGS=ignore
S2_START=${S2_START:-2025-11-01}
S2_END=${S2_END:-2026-05-01}      # exclusive

python scripts/fetch_data.py                 # HydroRIVERS, WorldPop, OSM (Geofabrik), geoBoundaries
python scripts/clip_hydrorivers.py           # whole reaches around Bangladesh
python scripts/extract_osm.py                # waste sources, receptors, rivers, water bodies
python scripts/prepare_inputs.py             # sites.geojson, pois.geojson, web layers
python scripts/prepare_population.py         # WorldPop: in-country NoData (water) -> 0

POP=.cache/population_bgd_2020_ppp.tif
python -m riverwatch --sites data/inputs/sites.geojson --rivers data/inputs/rivers.gpkg \
  --population $POP --pois data/inputs/pois.geojson --config configs/national.json --out runs/national

python scripts/select_pilot.py
python -m riverwatch --sites data/inputs/pilot_dhaka_sites.geojson --rivers data/inputs/rivers.gpkg \
  --population $POP --pois data/inputs/pois.geojson --config configs/dhaka_pilot.json --out runs/dhaka_pilot_prep
python -m riverwatch.s2_stac --samples runs/dhaka_pilot_prep/samples_gee.csv \
  --start "$S2_START" --end "$S2_END" --out data/observations/dhaka_dry_2025_26.csv
python -m riverwatch --sites data/inputs/pilot_dhaka_sites.geojson --rivers data/inputs/rivers.gpkg \
  --population $POP --pois data/inputs/pois.geojson --config configs/dhaka_pilot.json \
  --observations data/observations/dhaka_dry_2025_26.csv --out runs/dhaka_pilot
rm -rf runs/dhaka_pilot_prep
echo "Done. Start the web app: uvicorn webapp.main:app --host 0.0.0.0 --port 8000"
