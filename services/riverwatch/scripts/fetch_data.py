"""Download the real open datasets used by RiverWatch BD into .cache/raw/.

All sources are public and need no credentials. Licences and citations are recorded
in data/sources.json (the source manifest the README asks teams to keep).
"""
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / ".cache/raw"
GB = "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/BGD/{a}/geoBoundaries-BGD-{a}_simplified.geojson"
FILES = {
    "HydroRIVERS_v10_as_shp.zip": "https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_as_shp.zip",
    "bgd_ppp_2020.tif": "https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/BGD/bgd_ppp_2020.tif",
    "bangladesh-latest.osm.pbf": "https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf",
    **{f"geoBoundaries-BGD-{a}.geojson": GB.format(a=a) for a in ("ADM0", "ADM1", "ADM2")},
}


def get(name, url, force=False):
    dest = RAW / name
    if dest.is_file() and dest.stat().st_size > 0 and not force:
        print(f"ok   {name}")
        return dest
    print(f"get  {name}  <- {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "RiverWatchBD/1.0"})
    with urllib.request.urlopen(req) as r, open(dest.with_suffix(".part"), "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    dest.with_suffix(".part").replace(dest)
    return dest


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    force = "--force" in sys.argv
    if "--serve-only" in sys.argv:
        # Minimal set for a deployed web server that can re-run the pipeline:
        # population raster + national boundary (other inputs ship in data/inputs/).
        for name in ("bgd_ppp_2020.tif", "geoBoundaries-BGD-ADM0.geojson"):
            get(name, FILES[name], force)
        return
    for name, url in FILES.items():
        get(name, url, force)
    z = RAW / "HydroRIVERS_v10_as_shp.zip"
    if not (RAW / "HydroRIVERS_v10_as_shp").is_dir():
        zipfile.ZipFile(z).extractall(RAW)
    print("Done. Next: python scripts/clip_hydrorivers.py && python scripts/extract_osm.py "
          "&& python scripts/prepare_inputs.py")


if __name__ == "__main__":
    main()
