"""Prepare the WorldPop people-per-pixel raster for corridor counts.

WorldPop 2020 (unconstrained, 100 m) stores water bodies and other uninhabited cells
inside Bangladesh as NoData. River corridors always overlap such cells, so the
pipeline's strict coverage check (README section 5, 'Partial raster coverage is
flagged') would mark almost every zone as partial. Inside the geoBoundaries national
boundary those NoData cells mean "no modelled residents", so this step sets them to 0.
Cells outside the boundary keep NoData, so zones that cross into India or Myanmar are
still flagged as partial. The grid, CRS and values are otherwise unchanged (no
resampling of count data).
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import geometry_mask

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".cache/raw/bgd_ppp_2020.tif"
DST = ROOT / ".cache/population_bgd_2020_ppp.tif"


def main():
    bd = gpd.read_file(ROOT / ".cache/raw/geoBoundaries-BGD-ADM0.geojson").to_crs(4326)
    with rasterio.open(SRC) as ds:
        prof = ds.profile
        a = ds.read(1, masked=True)
        inside = geometry_mask(bd.geometry, out_shape=a.shape, transform=ds.transform, invert=True)
        nodata = ds.nodata
    data = a.data.astype("float32")
    fill = np.ma.getmaskarray(a) & inside
    data[fill] = 0.0
    data[np.ma.getmaskarray(a) & ~inside] = nodata
    prof.update(compress="deflate", predictor=3, tiled=True, blockxsize=512, blockysize=512,
                dtype="float32", BIGTIFF="IF_SAFER")
    with rasterio.open(DST, "w", **prof) as out:
        out.write(data, 1)
        out.update_tags(SOURCE="WorldPop bgd_ppp_2020.tif (CC BY 4.0)",
                        NOTE="NoData inside Bangladesh boundary set to 0 (water/uninhabited)")
    print(f"filled {int(fill.sum())} in-country NoData cells -> {DST}")


if __name__ == "__main__":
    main()
