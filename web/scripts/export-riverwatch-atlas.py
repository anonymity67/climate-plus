"""Build the offline Bangladesh atlas from the two completed RiverWatch runs.

Requires shapely and pyproj. Run from any directory. The original datasets and
inspection service are read-only. Only the two declared, non-demo runs export.
"""
from collections import defaultdict
from csv import DictReader
from functools import partial
from hashlib import sha256
import json
from pathlib import Path
import sqlite3

from pyproj import Transformer
from shapely import from_wkb, make_valid, transform
from shapely.geometry import mapping, shape

WEB = Path(__file__).resolve().parents[1]
RIVERWATCH = WEB.parent / "services" / "riverwatch"
OUT = WEB / "public" / "data" / "riverwatch"
RUNS = {"national": "sites.geojson", "dhaka_pilot": "pilot_dhaka_sites.geojson"}
LINKED = {"manual", "nearest", "nearest_ambiguous"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(DictReader(source))


def write(name, content):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")


def number(text):
    return float(text) if text not in ("", None) else None


def flag(text):
    return text == "True"


def coordinate_precision(value, digits):
    if isinstance(value, (tuple, list)):
        return [coordinate_precision(part, digits) for part in value]
    return round(value, digits)


def map_geometry(geom, digits):
    data = mapping(geom)
    return {"type": data["type"], "coordinates": coordinate_precision(data["coordinates"], digits)}


def geo_package_shape(value):
    if value[:2] != b"GP":
        raise ValueError("Expected a GeoPackage geometry")
    envelope = (value[3] >> 1) & 7
    return from_wkb(value[8 + (0, 32, 48, 48, 64)[envelope]:])


def base_map():
    files = RIVERWATCH / "web" / "static" / "data"
    features = []
    detail_layers = []
    for layer, tolerance in {"divisions": 0.002, "districts": 0.0024, "rivers_display": 0.0018, "osm_rivers": 0.0025, "water_bodies": 0.002}.items():
        for feature in read_json(files / f"{layer}.geojson")["features"]:
            props = feature["properties"]
            if layer == "rivers_display" and props["DIS_AV_CMS"] < 100:
                continue
            geometry = make_valid(shape(feature["geometry"])).simplify(tolerance, preserve_topology=True)
            if (geometry.is_empty or geometry.geom_type == "GeometryCollection"):
                continue
            target = detail_layers if layer in {"osm_rivers", "water_bodies"} else features
            target.append({
                "type": "Feature",
                "properties": {"layer": layer, "name": props.get("name", props.get("river_name", ""))},
                "geometry": map_geometry(geometry, 4),
            })
    write("bangladesh.json", {"type": "FeatureCollection", "features": features})
    write("waterways-detail.json", {"type": "FeatureCollection", "features": detail_layers})


def records_for(run, filename):
    root = RIVERWATCH / "runs" / run
    manifest = read_json(root / "manifest.json")
    features = read_json(RIVERWATCH / "data" / "inputs" / filename)["features"]
    props = {f["properties"]["site_id"]: f for f in features}
    river_names = {r["HYRIV_ID"]: r["river_name"] for r in read_rows(RIVERWATCH / "data/inputs/reach_names.csv")}
    inverse = Transformer.from_crs(manifest["config"]["crs"], 4326, always_xy=True).transform
    transform_to_wgs = partial(transform, transformation=inverse, interleaved=False)
    details = {site_id: {"trace": [], "sampling": [], "pairs": []} for site_id in props}
    with sqlite3.connect((root / "riverwatch.gpkg").as_uri() + "?mode=ro", uri=True) as db:
        for site, reach, start, end, raw in db.execute("SELECT site_id, reach_id, start_km, end_km, geom FROM corridors ORDER BY site_id, start_km, fid"):
            details[site]["trace"].append({
                "reach": reach, "fromKm": round(start, 3), "toKm": round(end, 3),
                "geometry": map_geometry(transform_to_wgs(geo_package_shape(raw).simplify(15)), 5)
            })
        for table, key, tolerance in (("links", "link", 0), ("proximity_zones", "zone", 28)):
            for site, raw in db.execute(f"SELECT site_id, geom FROM {table} ORDER BY site_id, fid"):
                geometry = geo_package_shape(raw)
                if tolerance:
                    geometry = geometry.simplify(tolerance, preserve_topology=True)
                details[site][key] = map_geometry(transform_to_wgs(geometry), 5)
        if run == "dhaka_pilot":
            for site, side, raw in db.execute("SELECT site_id, side, geom FROM sampling_points ORDER BY site_id, side"):
                details[site]["sampling"].append({"side": side, "point": map_geometry(transform_to_wgs(geo_package_shape(raw)), 6)["coordinates"]})
    for row in read_rows(root / "paired_observations.csv"):
        details[row["site_id"]]["pairs"].append({
            "date": row["date"], "scene": row["scene_id"], "up": number(row["up"]), "down": number(row["down"]),
            "delta": number(row["delta"]), "upPixels": int(row["water_up"]), "downPixels": int(row["water_down"]),
            "flagged": flag(row["unusual"]),
        })

    sites = []
    shards = defaultdict(dict)
    for row in read_rows(root / "review_queue.csv"):
        site_id = row["site_id"]
        feature = props[site_id]
        source = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"]
        linked = row["snap_method"] in LINKED
        gap = number(row["snap_distance_m"])
        reach = str(int(float(row["reach_id"]))) if row["reach_id"] else None
        reference = row["role"] == "reference"
        detail = details[site_id]
        priority = not reference and linked and gap <= 500 and (source.get("severity") or 0) >= 0.99 and row["corridor_stop"] != "unlinked"
        group = sha256(site_id.encode()).hexdigest()[:2] if run == "national" else "pilot"
        sites.append({
            "id": site_id, "name": source["name"], "point": [round(lon, 6), round(lat, 6)], "group": group, "category": source["category"],
            "district": source["district"], "division": source["division"], "river": river_names.get(reach, ""),
            "linked": linked, "priority": priority, "reference": reference, "traced": bool(detail["trace"]),
            "pairs": int(row["n_clear_dates"]),
        })
        detail.update({
            "reach": reach, "gapM": gap, "method": row["snap_method"], "stop": row["corridor_stop"],
            "kind": row["industry_type"], "osmUrl": source["osm_url"],
            "linkReviewed": flag(row["link_reviewed"]), "documentedOutlet": source["outfall_confirmed"],
            "inferredClass": source["hazard_label"],
            "population": number(row["pop_near"]), "populationComplete": flag(row["pop_coverage_complete"]),
            "facilities": {key: int(float(row[key])) if row[key] else None for key in ("school", "hospital", "drinking_water", "water_well")},
            "median": number(row["median_delta"]), "rank": number(row["rank"]),
            "action": row["action"], "pairs": sorted(detail["pairs"], key=lambda pair: pair["date"]),
        })
        if len(detail["pairs"]) != int(row["n_clear_dates"]):
            raise ValueError(f"Pair count differs for {run}/{site_id}")
        shards[group][site_id] = detail

    for group, values in sorted(shards.items()):
        write(f"{run}/{group}.json", values)
    write(f"{run}.json", {
        "sites": sites, "created": manifest["created_utc"][:10], "minPairs": manifest["config"]["min_pairs"],
        "zoneM": manifest["config"]["buffer_m"], "maxKm": manifest["config"]["corridor_km"],
        "qa": manifest["observation_qa"], "ranked": manifest["ranked_count"],
        "union": manifest["union_population"],
        "unionFacilities": manifest["union_mapped_amenities"],
        "summary": {"mapped": manifest["site_count"], "linked": manifest["linked_count_including_references"],
                    "references": len(sites) - manifest["site_count"], "priority": sum(site["priority"] for site in sites)},
    })
    print(run, len(sites), len(shards), "shards", sum(len(v["trace"]) for v in details.values()), "trace segments")


if __name__ == "__main__":
    base_map()
    for run, filename in RUNS.items():
        records_for(run, filename)
