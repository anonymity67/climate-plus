import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import LineString, Point

from .geo import frame


def make_inputs(folder):
    folder.mkdir(parents=True, exist_ok=True)
    crs = "EPSG:32646"
    x, y = 240000, 2635000

    def line(a, b):
        return LineString([(x + a, y), (x + b, y)])

    paths = [folder / name for name in
             ["sites.geojson", "rivers.gpkg", "population.tif", "pois.geojson"]]
    frame([
        {"HYRIV_ID": 101, "NEXT_DOWN": 102, "geometry": line(0, 2000)},
        {"HYRIV_ID": 102, "NEXT_DOWN": 103, "geometry": line(4500, 2000)},
        {"HYRIV_ID": 103, "NEXT_DOWN": 0, "geometry": line(4500, 7000)},
    ], crs).to_file(paths[1], layer="rivers", index=False)

    sites = [
        ("DEMO-01", 1000, 15, 0.85, "site", True),
        ("DEMO-02", 2200, 12, 0.55, "site", True),
        ("DEMO-03", 6500, 2500, None, "site", False),
        ("DEMO-REF", 5500, 10, None, "reference", False),
    ]
    frame([
        {"site_id": sid, "name": f"Synthetic {sid}", "industry_type": "demo",
         "role": role, "severity": sev, "severity_source": "Synthetic exercise" if reviewed else "",
         "outfall_confirmed": reviewed, "outfall_source": "Synthetic exercise" if reviewed else "",
         "flow_reviewed": reviewed, "geometry": Point(x + dx, y + dy)}
        for sid, dx, dy, sev, role, reviewed in sites
    ], crs).to_crs(4326).to_file(paths[0], index=False)

    frame([
        {"poi_type": kind, "geometry": Point(x + dx, y + dy)}
        for dx, dy, kind in [(1700, 140, "school"), (3800, -180, "water_well"),
                             (5200, 350, "hospital"), (6500, 280, "drinking_water")]
    ], crs).to_crs(4326).to_file(paths[3], index=False)

    data = np.random.default_rng(42).poisson(12, (90, 120)).astype("float32")
    with rasterio.open(
        paths[2], "w", driver="GTiff", width=120, height=90, count=1,
        dtype="float32", crs=crs, transform=from_origin(x-1800, y+4500, 100, 100),
        nodata=-9999,
    ) as ds:
        ds.write(data, 1)
    return paths


def make_observations(path, samples, radius):
    rows = []
    for i, date in enumerate(pd.date_range("2023-11-12", periods=12, freq="10D")):
        for p in samples.itertuples(index=False):
            difference = {"DEMO-01": 0.09, "DEMO-02": 0.034, "DEMO-REF": 0.004}.get(p.site_id, 0)
            adjustment = difference + (0.08 if p.site_id == "DEMO-01" and i == 10 else 0)
            value = -0.08 + 0.015 * np.sin(i) + (adjustment if p.side == "down" else 0)
            rows.append({"pair_id": p.pair_id, "side": p.side, "date": date.strftime("%Y-%m-%d"),
                         "scene_id": f"SYNTHETIC_{i:02d}", "ndti": value,
                         "water_px": 8, "radius_m": radius})
    pd.DataFrame(rows, columns=["pair_id", "side", "date", "scene_id", "ndti",
                                "water_px", "radius_m"]).to_csv(path, index=False)
    return path
