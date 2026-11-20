"""Build gis/aquavelle.gpkg: every map layer the Aquavelle web app shows, as GIS layers for QGIS.

Run from the Aquavelle folder:  python gis/build_gpkg.py
Inputs are the same files the web app reads, so QGIS and the app always show the same data:
  web/public/data/rainhub-model.json        (Bayesian model, R)
  web/public/data/riverwatch-sources.json   (RiverWatch BD screening, Python)
  web/public/data/streams/dhaka.json        (OpenStreetMap channels)
  services/riverwatch/web/static/data/      (divisions, HydroRIVERS display network)
"""
import json
from pathlib import Path
import numpy as np
import geopandas as gpd
from shapely.geometry import Point, LineString, box

root = Path(__file__).resolve().parents[1]
out = root / "gis" / "aquavelle.gpkg"
if out.exists():
    out.unlink()
W = "EPSG:4326"
UTM = "EPSG:32646"  # metres, for squares and buffers in Dhaka


def save(g, name):
    g.to_file(out, layer=name, driver="GPKG")
    print(f"{name}: {len(g)}")


m = json.loads((root / "web/public/data/rainhub-model.json").read_text(encoding="utf-8"))
rw = json.loads((root / "web/public/data/riverwatch-sources.json").read_text(encoding="utf-8"))
st = root / "services/riverwatch/web/static/data"

# ---- National: where pollution comes from (RiverWatch) ----
save(gpd.read_file(st / "divisions.geojson")[["name", "geometry"]].rename(columns={"name": "division"}), "bd_divisions")
riv = gpd.read_file(st / "rivers_display.geojson")
riv = riv.rename(columns={"DIS_AV_CMS": "flow_m3s", "ORD_CLAS": "order_class"})[["river_name", "flow_m3s", "order_class", "geometry"]]
save(riv, "bd_rivers")
f = rw["fields"]
rows = [dict(zip(f, r)) for r in rw["sites"]]
src = gpd.GeoDataFrame(rows, geometry=[Point(r["lon"], r["lat"]) for r in rows], crs=W).drop(columns=["lon", "lat"])
src["critical"] = src["critical"].astype(int)
src["hazard"] = src["tier"].replace("", "Not classified")
save(src, "pollution_sources")
save(gpd.GeoDataFrame({"kind": ["10 km downstream corridor of a critical source"] * len(rw["critical_corridors"])},
                      geometry=[LineString(l) for l in rw["critical_corridors"] if len(l) > 1][: len(rw["critical_corridors"])], crs=W),
     "critical_corridors")

# ---- Dhaka: how polluted, who is exposed (Bayesian model) ----
ways = json.loads((root / "web/public/data/streams/dhaka.json").read_text(encoding="utf-8"))["ways"]
save(gpd.GeoDataFrame([{"name": w.get("name") or "", "kind": w.get("kind", "")} for w in ways],
                      geometry=[LineString(w["geometry"]["coordinates"]) for w in ways], crs=W), "dhaka_channels")
save(gpd.GeoDataFrame([{"samples": s["n"], "measured_severity": s["s"]} for s in m["sites"]],
                      geometry=[Point(s["lon"], s["lat"]) for s in m["sites"]], crs=W), "river_sites_measured")


def squares(items, w_m, h_m=None):
    pts = gpd.GeoSeries([Point(i["lon"], i["lat"]) for i in items], crs=W).to_crs(UTM)
    hw, hh = w_m / 2, (h_m or w_m) / 2
    return gpd.GeoSeries([box(p.x - hw, p.y - hh, p.x + hw, p.y + hh) for p in pts], crs=UTM).to_crs(W)


def spacing(v):
    d = np.diff(np.unique(np.round(v, 0)))
    return float(np.median(d[d > 100]))


cells = m["cells"]
xy = gpd.GeoSeries([Point(c["lon"], c["lat"]) for c in cells], crs=W).to_crs(UTM)
cell_w, cell_h = spacing(xy.x.values), spacing(xy.y.values)  # model grid cell, metres
save(gpd.GeoDataFrame({"severity": [c["s"] for c in cells], "chance_severe": [c["e"] for c in cells]},
                      geometry=squares(cells, cell_w, cell_h), crs=W), "river_severity_surface")
if "rain_mm_year" in cells[0]:
    save(gpd.GeoDataFrame({"rain_mm_year": [c["rain_mm_year"] for c in cells]},
                          geometry=squares(cells, cell_w, cell_h), crs=W), "rain_surface")

b = m["blocks"]
blocks = gpd.GeoDataFrame({
    "block_id": [x["id"] for x in b], "people": [x["pop"] for x in b], "chance_severe": [x["e"] for x in b],
    "hub_cover": [x["c"] for x in b], "hub_id": [x["hub"] for x in b], "in_cleanup_zone": [int(bool(x["cleaned"])) for x in b],
}, geometry=squares(b, 2000), crs=W)
blocks["exposed_people"] = (blocks["people"] * blocks["chance_severe"]).round()
blocks["safe_share_with_hubs"] = ((1 - blocks["chance_severe"]) + blocks["chance_severe"] * blocks["hub_cover"]).round(4)
save(blocks, "population_blocks")

h = m["hubs"]
hubs = gpd.GeoDataFrame([{k: v for k, v in x.items() if k not in ("lon", "lat")} for x in h],
                        geometry=[Point(x["lon"], x["lat"]) for x in h], crs=W).rename(columns={"id": "hub_id", "reliability": "dry_season_reliability"})
save(hubs, "rain_hubs")
hp = {x["id"]: (x["lon"], x["lat"]) for x in h}
served = [x for x in b if x["c"] > 0 and x["hub"] in hp]
save(gpd.GeoDataFrame({"hub_id": [x["hub"] for x in served], "block_id": [x["id"] for x in served], "people_in_block": [x["pop"] for x in served]},
                      geometry=[LineString([hp[x["hub"]], (x["lon"], x["lat"])]) for x in served], crs=W), "hub_service_links")
z = m["cleanup_zones"]
zpts = gpd.GeoDataFrame({"rank": range(1, len(z) + 1), "mean_severity": [x["severity"] for x in z],
                         "people_within_5km": [x["people"] for x in z]},
                        geometry=[Point(x["lon"], x["lat"]) for x in z], crs=W)
save(zpts, "cleanup_priority_cells")
area = zpts.to_crs(UTM).buffer(m["meta"]["exposure_km"] * 1000).union_all()
save(gpd.GeoDataFrame({"zones": [len(z)], "people_inside": [int(blocks.loc[blocks["in_cleanup_zone"] == 1, "people"].sum())]},
                      geometry=[area], crs=UTM).to_crs(W), "cleanup_area")
print(f"model cell {cell_w:.0f} x {cell_h:.0f} m -> {out}")
