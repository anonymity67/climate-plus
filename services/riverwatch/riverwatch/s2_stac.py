"""Credential-free Sentinel-2 paired observations via the Earth Search STAC API.

This is a drop-in alternative to ``gee/sentinel2_pairs.js`` for users without Earth
Engine access. It reads Sentinel-2 L2A Cloud-Optimized GeoTIFFs published on AWS
Open Data (Element 84 Earth Search v1) and writes exactly the same CSV schema the
pipeline already accepts with ``--observations``:

    pair_id, side, date, scene_id, ndti, water_px, radius_m

The masking logic mirrors the Earth Engine script:
  * clear pixels: Scene Classification (SCL) in {4 vegetation, 5 bare, 6 water}
  * water pixels: NDWI = (B3 - B8) / (B3 + B8) > NDWI_MIN (default 0.05)
  * NDTI = (B4 - B3) / (B4 + B3) on clear water pixels only
  * median NDTI and pixel count of 10 m pixel centres inside a RADIUS_M circle
Reflectance is computed with the per-asset scale/offset published in STAC
(``raster:bands``), which harmonizes processing-baseline >= 04.00 scenes in the same
way as COPERNICUS/S2_SR_HARMONIZED.

Usage:
    python -m riverwatch.s2_stac --samples runs/pilot_prep/samples_gee.csv \
        --start 2023-11-01 --end 2024-05-01 --out data/riverwatch_obs.csv

An optical difference is a screening signal, not evidence of a discharge source.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
import os
from pathlib import Path
import re
import sys
import time

import numpy as np
import pandas as pd
import requests

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
os.environ.setdefault("VSI_CACHE", "TRUE")
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")

import rasterio  # noqa: E402  (env vars must be set first)
from rasterio.windows import Window  # noqa: E402
from pyproj import Transformer  # noqa: E402

STAC = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
COLUMNS = ["pair_id", "side", "date", "scene_id", "ndti", "water_px", "radius_m"]


def search(bbox, start, end, max_cloud):
    """Return STAC items intersecting bbox; END is exclusive like the GEE script."""
    body = {
        "collections": [COLLECTION], "bbox": bbox, "limit": 200,
        "datetime": f"{start}T00:00:00Z/{end}T00:00:00Z",
        "query": {"eo:cloud_cover": {"lt": max_cloud}},
    }
    items, url = [], STAC
    while url:
        r = requests.post(url, json=body, timeout=60)
        r.raise_for_status()
        page = r.json()
        items += [i for i in page["features"]
                  if not i["properties"]["datetime"].startswith(end)]
        nxt = [l for l in page.get("links", []) if l.get("rel") == "next"]
        if not nxt:
            break
        url, body = nxt[0]["href"], nxt[0].get("body", body)
    # Earth Search can hold re-processed duplicates (_0_L2A, _1_L2A ...): keep newest.
    best = {}
    for it in items:
        m = re.match(r"(.+)_(\d+)_L2A$", it["id"])
        key, ver = (m.group(1), int(m.group(2))) if m else (it["id"], 0)
        if key not in best or ver > best[key][0]:
            best[key] = (ver, it)
    return sorted((v[1] for v in best.values()), key=lambda i: i["properties"]["datetime"])


def _band(asset):
    rb = (asset.get("raster:bands") or [{}])[0]
    return asset["href"], float(rb.get("scale", 1.0)), float(rb.get("offset", 0.0))


def _read(ds, row, col, half):
    win = Window(col - half, row - half, 2 * half + 1, 2 * half + 1)
    return ds.read(1, window=win, boundless=True, fill_value=0)


def scene_rows(item, points, radius, ndwi_min):
    """points: DataFrame with pair_id, side, longitude, latitude."""
    props = item["properties"]
    epsg = props.get("proj:epsg") or int(str(props.get("proj:code", "")).split(":")[-1])
    to_utm = Transformer.from_crs(4326, epsg, always_xy=True)
    xs, ys = to_utm.transform(points.longitude.values, points.latitude.values)
    a = item["assets"]
    (g_href, g_s, g_o), (r_href, r_s, r_o), (n_href, n_s, n_o) = (
        _band(a["green"]), _band(a["red"]), _band(a["nir"]))
    scl_href = a["scl"]["href"]
    date = props["datetime"][:10]
    half = int(math.ceil(radius / 10.0)) + 1
    out = []
    with rasterio.open(g_href) as G, rasterio.open(r_href) as R, \
         rasterio.open(n_href) as N, rasterio.open(scl_href) as S:
        for p, x, y in zip(points.itertuples(index=False), xs, ys):
            row, col = G.index(x, y)
            if not (0 <= row < G.height and 0 <= col < G.width):
                continue
            g = _read(G, row, col, half).astype("float64")
            if not g.any():
                continue  # outside the swath (no data)
            r = _read(R, row, col, half).astype("float64")
            n = _read(N, row, col, half).astype("float64")
            # SCL is 20 m: sample it at each 10 m pixel centre (nearest neighbour).
            rr, cc = np.mgrid[row - half:row + half + 1, col - half:col + half + 1]
            gt, st = G.transform, S.transform
            cx = gt.c + (cc + 0.5) * gt.a
            cy = gt.f + (rr + 0.5) * gt.e
            srow = np.floor((cy - st.f) / st.e).astype(int).ravel()
            scol = np.floor((cx - st.c) / st.a).astype(int).ravel()
            r0, c0 = int(srow.min()), int(scol.min())
            sw = S.read(1, window=Window(c0, r0, int(scol.max()) - c0 + 1, int(srow.max()) - r0 + 1),
                        boundless=True, fill_value=0)
            scl = sw[srow - r0, scol - c0].reshape(rr.shape)
            valid = (g > 0) & (r > 0) & (n > 0)
            G_ = g * g_s + g_o
            R_ = r * r_s + r_o
            N_ = n * n_s + n_o
            with np.errstate(divide="ignore", invalid="ignore"):
                ndwi = (G_ - N_) / (G_ + N_)
                ndti = (R_ - G_) / (R_ + G_)
            inside = (cx - x) ** 2 + (cy - y) ** 2 <= radius ** 2
            clear = np.isin(scl, (4, 5, 6))
            use = valid & inside & clear & (ndwi > ndwi_min) & np.isfinite(ndti)
            if use.sum() == 0:
                continue
            out.append({"pair_id": p.pair_id, "side": p.side, "date": date,
                        "scene_id": item["id"], "ndti": float(np.median(ndti[use])),
                        "water_px": int(use.sum()), "radius_m": radius})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--samples", type=Path, required=True, help="samples_gee.csv from a prep run")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True, help="exclusive")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--radius", type=int, default=25, help="must equal sample_radius_m")
    ap.add_argument("--ndwi-min", type=float, default=0.05)
    ap.add_argument("--max-cloud", type=float, default=80)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--max-scenes", type=int, default=0, help="0 = all")
    args = ap.parse_args(argv)

    pts = pd.read_csv(args.samples, dtype={"pair_id": str, "site_id": str, "side": str})
    if pts.empty:
        sys.exit("No sample points in the samples file.")
    pad = 0.01
    bbox = [pts.longitude.min() - pad, pts.latitude.min() - pad,
            pts.longitude.max() + pad, pts.latitude.max() + pad]
    items = search(bbox, args.start, args.end, args.max_cloud)
    if args.max_scenes:
        items = sorted(items, key=lambda i: i["properties"].get("eo:cloud_cover", 100))[:args.max_scenes]
    print(f"{len(items)} Sentinel-2 L2A scenes, {len(pts)} sample points", flush=True)

    rows, done, t0 = [], 0, time.time()
    with ThreadPoolExecutor(args.workers) as pool:
        futs = {}
        for it in items:
            minx, miny, maxx, maxy = it["bbox"]
            sub = pts[(pts.longitude.between(minx, maxx)) & (pts.latitude.between(miny, maxy))]
            if len(sub):
                futs[pool.submit(scene_rows, it, sub, args.radius, args.ndwi_min)] = it["id"]
        for f in as_completed(futs):
            done += 1
            try:
                rows += f.result()
            except Exception as exc:  # network hiccups should not kill the run
                print(f"  ! {futs[f]}: {exc}", flush=True)
            if done % 5 == 0 or done == len(futs):
                print(f"  {done}/{len(futs)} scenes, {len(rows)} sample rows, "
                      f"{time.time() - t0:.0f}s", flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).sort_values(["date", "pair_id", "side"]).to_csv(args.out, index=False)
    print(f"Wrote {len(rows)} rows -> {args.out}")


if __name__ == "__main__":
    main()
