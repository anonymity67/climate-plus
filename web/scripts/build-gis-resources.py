"""Build audited Kaggle context and water-access summaries from retained snapshots.

Standard library only. Network access is not used. Output is deterministic.
This script never creates a drinking-water clearance or a health-risk footprint.
"""

from pathlib import Path
import argparse
import csv
import hashlib
import json
import math
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
KAGGLE = "research/gis/kaggle-v2/Pollution_Intensity_Coordinates_Updated.csv"
WPDX = "research/gis/wpdx-2026-10-24/wpdx-plus-bangladesh.csv"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def encode(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        + "\n",
        encoding="utf-8",
    )


def route_geometry_audit():
    geo = json.loads((ROOT / "public/data/gis-network.geojson").read_text())
    reports, lengths = [], []
    for feature in geo["features"]:
        if feature["properties"]["kind"] != "route":
            continue
        geometry = feature["geometry"]
        lines = (
            [geometry["coordinates"]]
            if geometry["type"] == "LineString"
            else geometry["coordinates"]
        )
        length = 0.0
        for line in lines:
            for a, b in zip(line, line[1:]):
                lon1, lat1 = map(math.radians, a)
                lon2, lat2 = map(math.radians, b)
                chord = (
                    math.sin((lat2 - lat1) / 2) ** 2
                    + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
                )
                length += (
                    6371008.8 * 2 * math.asin(math.sqrt(max(0.0, min(1.0, chord))))
                )
        reported = feature["properties"]["distanceM"]
        if not reported or abs(length - reported) / reported > 0.01:
            raise ValueError(
                "Route geometry differs by more than 1% from supplied QGIS distance: "
                + feature["properties"]["id"]
            )
        reports.append(reported)
        lengths.append(round(length, 2))
    return {
        "method": "Sum WGS84 spherical geodesic segment lengths of exported route vertices, compared with supplied QGIS road-network costs.",
        "reportedMetres": reports,
        "geodesicApproxMetres": lengths,
        "maxRelativeDiscrepancy": max(abs(a - b) / a for a, b in zip(reports, lengths)),
        "qualification": "Geometry/cost consistency only, not field drivability, flood access or travel speed.",
    }


def build(out):
    rows = []
    excluded = []
    raw = list(csv.DictReader((ROOT / KAGGLE).open(encoding="utf-8-sig", newline="")))
    seen = set()
    for number, record in enumerate(raw, 2):
        try:
            lat, lon = float(record["Latitude"]), float(record["Longitude"])
            value = float(record["Pollution_Intensity_Value"])
            if not all(math.isfinite(v) for v in [lat, lon, value]) or not (
                -90 <= lat <= 90 and -180 <= lon <= 180
            ):
                raise ValueError("Invalid numeric value or WGS84 coordinate")
            identifier = record["pointid"]
            if identifier in seen:
                raise ValueError("Duplicate point ID")
            seen.add(identifier)
            label = record["Pollution_Intensity_Class"]
            rows.append(
                [
                    "KAG-" + identifier,
                    lat,
                    lon,
                    value,
                    label
                    if label in ["Very High", "High", "Moderate", "Low", "Very Low"]
                    else "Unclassified",
                ]
            )
        except (ValueError, KeyError) as error:
            excluded.append({"sourceRow": number, "reason": str(error)})

    counts = dict(sorted(Counter(r[4] for r in rows).items()))
    metadata = json.loads(
        (ROOT / "research/gis/kaggle-v2/dataset-metadata.json").read_text()
    )
    context = {
        "schema": "climate-plus/publisher-pollution-context-v1",
        "provider": metadata["creatorName"],
        "url": "https://www.kaggle.com/datasets/niloysust21/bangladesh-river-pollution-gis/data",
        "version": metadata["currentVersionNumber"],
        "publisherUpdated": metadata["lastUpdated"],
        "acquired": "2026-10-24",
        "rawFile": KAGGLE,
        "rawSha256": digest(ROOT / KAGGLE),
        "fields": ["id", "latitude", "longitude", "publisherValue", "publisherClass"],
        "rows": rows,
        "audit": {
            "rawRows": len(raw),
            "acceptedRows": len(rows),
            "excludedRows": excluded,
            "classCounts": counts,
            "uniqueCoordinatePairs": len(set((r[1], r[2]) for r in rows)),
            "bounds": {
                "south": min(r[1] for r in rows),
                "north": max(r[1] for r in rows),
                "west": min(r[2] for r in rows),
                "east": max(r[2] for r in rows),
            },
            "samplingDatesSupplied": False,
            "pollutantUnitsSupplied": False,
            "laboratoryValidationSupplied": False,
            "classificationMethodSupplied": False,
        },
        "qualification": "Publisher-classified research context. Numerical score has no documented pollutant unit, sampling date or laboratory validation. Low classes do not establish clean or potable water. No live health alert or contamination boundary is derived.",
    }
    encode(out / "public/data/river-pollution-context.json", context)

    raw_water = list(
        csv.DictReader((ROOT / WPDX).open(encoding="utf-8-sig", newline=""))
    )
    fields = [
        "wpdx_id",
        "lat_deg",
        "lon_deg",
        "report_date",
        "status_id",
        "source",
        "dataset_title",
        "clean_adm1",
        "clean_adm2",
        "clean_adm3",
        "clean_adm4",
        "water_source_clean",
        "water_tech_clean",
    ]
    water_rows = []
    identifiers = set()
    for r in raw_water:
        lat, lon = float(r["lat_deg"]), float(r["lon_deg"])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("Unexpected invalid water-point coordinates")
        if r["wpdx_id"] in identifiers:
            raise ValueError("Duplicate WPdx identifier requires review")
        identifiers.add(r["wpdx_id"])
        values = {
            **r,
            "lat_deg": lat,
            "lon_deg": lon,
            "report_date": r["report_date"][:10],
        }
        water_rows.append([values.get(k, "") for k in fields])
    dates = [r[3] for r in water_rows]
    result = json.loads((ROOT / "research/gis/wpdx-2026-10-24/RESULT.json").read_text())
    inventory = {
        "schema_version": 1,
        "kind": "historical-confirmation-required-inventory",
        "provider": "Water Point Data Exchange (WPdx+) / UNHCR, REACH Initiative, WaterAid",
        "source_file": WPDX,
        "source_sha256": digest(ROOT / WPDX),
        "url": "https://www.waterpointdata.org/access-data/",
        "licence": "CC BY 4.0",
        "licence_url": "https://www.waterpointdata.org/share-data/",
        "record_count": len(water_rows),
        "assessment_dates": {"min": min(dates), "max": max(dates)},
        "current_availability": "unknown for every point",
        "drinking_water_safety": "unknown for every point",
        "presets": result["coverage_presets"],
        "coverage_warning": result["coverage_warning"],
        "audit": result["checks"],
        "fields": fields,
        "rows": water_rows,
    }
    encode(out / "public/data/water-access-candidates.json", inventory)
    audit = {
        "date": "2026-10-24",
        "kaggle": context["audit"],
        "waterAccess": {
            "records": len(water_rows),
            "dates": inventory["assessment_dates"],
            **result["checks"],
            "coverageWarning": result["coverage_warning"],
        },
        "routeGeometryValidation": route_geometry_audit(),
        "limits": [
            "No current certified drinking-water supply records",
            "No scientifically validated exposure plume",
            "No live hazard or route clearance",
            "No industrial-source identity inferred",
        ],
    }
    encode(out / "public/data/gis-source-audit.json", audit)
    print(
        json.dumps(
            {
                "kaggleRows": len(rows),
                "kaggleClassCounts": counts,
                "waterAccessRows": len(water_rows),
                "waterAssessmentDates": inventory["assessment_dates"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT)
    args = parser.parse_args()
    build(args.out)
