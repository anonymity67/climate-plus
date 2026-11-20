"""Clip HydroRIVERS v1.0 (Asia) to Bangladesh, keeping WHOLE reaches (no geometry clipping).

Per the RiverWatch README: preserve HYRIV_ID and NEXT_DOWN, extract whole reaches with a
downstream margin, and do not dissolve or simplify the network before QA.
"""
import sys
from pathlib import Path
import pyogrio

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".cache/raw/HydroRIVERS_v10_as_shp/HydroRIVERS_v10_as.shp"
OUT = ROOT / "data/inputs/rivers.gpkg"
# Bangladesh extent (88.0-92.7E, 20.6-26.6N) plus ~25-40 km margin incl. the Bay of Bengal mouths.
BBOX = (87.75, 20.3, 93.0, 26.85)

g = pyogrio.read_dataframe(SRC, bbox=BBOX)
keep = ["HYRIV_ID", "NEXT_DOWN", "MAIN_RIV", "LENGTH_KM", "DIST_DN_KM", "UPLAND_SKM",
        "DIS_AV_CMS", "ORD_STRA", "ORD_CLAS", "ORD_FLOW", "geometry"]
g = g[keep]
OUT.unlink(missing_ok=True)
g.to_file(OUT, layer="rivers", driver="GPKG", index=False)
print(f"{len(g)} whole HydroRIVERS reaches -> {OUT} ({OUT.stat().st_size/1e6:.1f} MB)")
