"""Register a deliberately reviewed GIS release; never run to hide an unexpected mismatch."""

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def entry(name):
    content = (ROOT / name).read_bytes()
    return {
        "path": name,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def main():
    kaggle_path = "research/gis/kaggle-v2/Pollution_Intensity_Coordinates_Updated.csv"
    wpdx_path = "research/gis/wpdx-2026-10-24/wpdx-plus-bangladesh.csv"
    acquired = read("research/gis/kaggle-v2/acquisition.json")
    expected = next(
        item
        for item in acquired["requests"]
        if item["file"] == "Pollution_Intensity_Coordinates_Updated.csv"
    )
    if entry(kaggle_path)["sha256"] != expected["sha256"]:
        raise ValueError("Kaggle raw file differs from acquisition record")
    water_audit = read("research/gis/wpdx-2026-10-24/RESULT.json")
    if entry(wpdx_path)["sha256"] != water_audit["raw_sha256"]:
        raise ValueError("WPdx raw file differs from acquisition record")
    sources = read("DATASETS.json")
    for item in sources:
        current = entry(item["path"])
        if item["sha256"] != current["sha256"]:
            raise ValueError("Previously registered source changed: " + item["id"])
    additions = [
        {
            "id": "kaggle-bangladesh-pollution-v2",
            "title": "Bangladesh-River-Pollution-GIS coordinate classifications",
            "doi": None,
            "version": "2",
            "authors": "A.B.M. Mostakim Niloy",
            "url": "https://www.kaggle.com/datasets/niloysust21/bangladesh-river-pollution-gis/data",
            "license": "MIT declared by publisher metadata; constituent data terms not independently established",
            "acquired": "2026-10-24",
            "path": kaggle_path,
            "size": "9,958 WGS84 coordinate/class rows; 1 unclassified row",
            "period": "Publisher updated 2025-09-07; no sampling dates supplied",
            "used": "Separate research-context GIS layer and investigation-distance queries",
            "transform": "Preserve all valid coordinates and published values/classes; retain the #N/A class as Unclassified. No imputed pollutants, sampling dates or health-risk labels. Large true-colour imagery not downloaded.",
            "limits": "No stated pollutant units, laboratory validation or classification method; Low/Very Low do not establish clean water. No live pollution or human-health exposure inference.",
            **{
                key: value for key, value in entry(kaggle_path).items() if key != "path"
            },
        },
        {
            "id": "wpdx-bangladesh-snapshot-20261024",
            "title": "WPdx+ Bangladesh historical water-point inventory",
            "doi": None,
            "version": "API snapshot 2026-10-24",
            "authors": "WPdx / Global Water Challenge; original providers UNHCR, REACH Initiative and WaterAid",
            "url": "https://www.waterpointdata.org/access-data/",
            "requestUrl": water_audit["exact_request_url"],
            "license": "CC BY 4.0 per WPdx Provider Agreement: https://www.waterpointdata.org/share-data/",
            "acquired": "2026-10-24",
            "path": wpdx_path,
            "size": "20,084 unique point IDs and coordinate pairs",
            "period": "Point assessments 2014-01-01 to 2019-11-21",
            "used": "Historical candidate locator with radius-limited straight-line distances, source dates and confirmation-required labels",
            "transform": "Allowlist of coordinates, IDs, dates, organisational providers, source/technology and administrative labels. No personal contacts, notes or photos. Source-presence and cleaned-condition fields are not equated.",
            "limits": "No current quality clearance or availability. 90.8% of points are in Cox’s Bazar; no Dacope-labelled records. Absence means inventory coverage is missing, not that water supplies do not exist.",
            **{key: value for key, value in entry(wpdx_path).items() if key != "path"},
        },
    ]
    sources = [
        item for item in sources if item["id"] not in {item["id"] for item in additions}
    ] + additions
    (ROOT / "DATASETS.json").write_text(
        json.dumps(sources, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (ROOT / "public/data/source-register.json").write_text(
        json.dumps(
            {"date": "2026-10-24", "sources": sources},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    manifest = read("DATA-MANIFEST.json")
    files = {item["path"]: item for item in manifest["files"]}
    for folder in ["research/gis", "public/data", "public/fonts"]:
        for path in (ROOT / folder).rglob("*"):
            if path.is_file() and "__pycache__" not in path.parts:
                name = path.relative_to(ROOT).as_posix()
                files[name] = entry(name)
    manifest.update(
        {
            "schema": "climate-plus/frozen-data-manifest-v1",
            "version": "0.3.0",
            "createdAt": "2026-10-24",
            "files": [files[name] for name in sorted(files)],
        }
    )
    (ROOT / "DATA-MANIFEST.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Registered {len(sources)} sources and {len(files)} data/reference assets for release 0.3.0"
    )


if __name__ == "__main__":
    main()
