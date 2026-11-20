"""Select the Greater Dhaka–Narayanganj river pilot from a national preparation run.

README section 2 says to start with 10–30 sites on comparatively wide river
corridors, plus one or two reference locations on the same rivers. The selection
rules are deterministic, so they can be audited:

  * inside the Greater Dhaka / Narayanganj / Gazipur / Munshiganj box
  * ECR Red (T1) or Orange-B (T2) potential-hazard tier, brick kilns excluded
  * unambiguous nearest snap <= 1000 m to a HydroRIVERS reach with mean discharge
    >= 50 m3/s (a "comparatively wide" channel for 10 m Sentinel-2 pixels)
  * unbroken 10 km modelled route and a valid up/down sampling pair
  * duplicate footprints of the same named facility removed; T1 kept first
Reference points: open-water points on reaches with mean discharge >= 200 m3/s,
>= 6 km from every mapped waste source and outside every modelled downstream
corridor. They are comparison locations, not "clean" sites.
"""
import json
from pathlib import Path
import re

import geopandas as gpd
import pandas as pd
import pyogrio
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
NAT = ROOT / "runs/national"
OUT = ROOT / "data/inputs/pilot_dhaka_sites.geojson"
BOX = (89.95, 23.35, 90.95, 24.15)
MAX_SITES = 30
METRIC = "EPSG:32646"


def norm(name):
    return re.sub(r"[^a-z]", "", re.sub(r"\(.*?\)|ltd|limited|factory|mills?", "", name.lower()))[:18]


def main():
    sites = gpd.read_file(ROOT / "data/inputs/sites.geojson")
    q = pd.read_csv(NAT / "review_queue.csv", dtype={"site_id": str})
    rivers = pyogrio.read_dataframe(ROOT / "data/inputs/rivers.gpkg")
    smp = pd.read_csv(NAT / "samples_gee.csv", dtype={"site_id": str})
    d = sites.merge(q[["site_id", "reach_id", "snap_distance_m", "snap_method", "corridor_stop"]],
                    on="site_id")
    d = d.merge(rivers[["HYRIV_ID", "DIS_AV_CMS"]], left_on="reach_id", right_on="HYRIV_ID", how="left")
    x, y = d.geometry.x, d.geometry.y
    c = d[x.between(BOX[0], BOX[2]) & y.between(BOX[1], BOX[3])
          & d.hazard_tier.isin(["T1", "T2"]) & d.industry_type.ne("Brick kiln")
          & d.snap_method.eq("nearest") & d.snap_distance_m.le(1000)
          & d.DIS_AV_CMS.ge(50) & d.corridor_stop.eq("distance_limit")
          & d.site_id.isin(smp.site_id)]
    c = c[~c.kind.eq("waste_transfer")].copy()
    c["key"] = c.name.map(norm)
    c = c.sort_values(["hazard_tier", "snap_distance_m"])
    c = c[(c.key == "unnamedworks") | ~c.key.duplicated()]
    m = c.to_crs(METRIC)
    keep = []
    for i in m.index:  # same facility mapped twice under different spellings
        if not any(m.geometry[i].distance(m.geometry[j]) < 250
                   and m.industry_type[i] == m.industry_type[j] for j in keep):
            keep.append(i)
    c = c.loc[keep]
    pick = c.head(MAX_SITES).drop(columns=["key", "HYRIV_ID", "DIS_AV_CMS", "reach_id",
                                           "snap_distance_m", "snap_method", "corridor_stop"])
    print(f"{len(c)} eligible, {len(pick)} selected:",
          pick.groupby(["hazard_tier", "industry_type"]).size().to_dict())

    # Reference points on wide reaches far from mapped sources and outside corridors.
    corridors = pyogrio.read_dataframe(NAT / "riverwatch.gpkg", layer="corridors").to_crs(METRIC)
    blocked = unary_union(list(corridors.buffer(1500).geometry))
    src = sites.to_crs(METRIC)
    wide = rivers[rivers.DIS_AV_CMS.ge(200)].to_crs(METRIC)
    bx = gpd.GeoSeries.from_xy([BOX[0], BOX[2]], [BOX[1], BOX[3]], crs=4326).to_crs(METRIC)
    wide = wide.cx[bx.x.min():bx.x.max(), bx.y.min():bx.y.max()]
    cand = []
    for r in wide.itertuples():
        for f in (0.25, 0.5, 0.75):
            p = r.geometry.interpolate(f, normalized=True)
            if blocked.contains(p):
                continue
            dist = float(src.distance(p).min())
            if dist >= 6000:
                cand.append((dist, r.HYRIV_ID, round(r.DIS_AV_CMS), p))
    cand.sort(key=lambda t: -t[0])
    refs, used = [], []
    for dist, rid, dis, p in cand:
        if any(p.distance(u) < 20000 for u in used):
            continue
        used.append(p)
        refs.append({"site_id": f"REF-{len(refs) + 1:02d}", "name": f"Reference reach {rid} ({dis} m³/s)",
                     "industry_type": "Reference comparison", "role": "reference",
                     "category": "reference", "kind": "reference", "hazard_tier": "",
                     "hazard_label": "Reference", "severity": None, "severity_source": "",
                     "outfall_confirmed": False, "outfall_source": "", "flow_reviewed": False,
                     "receiving_reach_id": str(rid), "discharge_m3d": None, "area_ha": 0.0,
                     "operator": "", "product": "", "division": "", "district": "",
                     "osm_url": "", "geometry": p})
        if len(refs) == 2:
            break
    ref = gpd.GeoDataFrame(refs, geometry="geometry", crs=METRIC).to_crs(4326) if refs else None
    out = pd.concat([pick, ref], ignore_index=True) if ref is not None else pick
    out = gpd.GeoDataFrame(out, geometry="geometry", crs=4326)
    OUT.unlink(missing_ok=True)
    out.to_file(OUT, driver="GeoJSON", index=False)
    print(f"{len(refs)} reference points; wrote {len(out)} rows -> {OUT}")
    print(out[["site_id", "name", "industry_type", "district"]].to_string())


if __name__ == "__main__":
    main()
