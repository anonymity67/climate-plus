#!/usr/bin/env python3
"""Build the Climate++ GIS hand-off files from the Dacope GeoPackage.

Reads  research/gis/v1/climate_gis.gpkg  (QGIS project output, standard library only)
Writes public/data/gis-network.geojson   (nodes, catchments, hazard polygons, reserve routes)
       public/data/gis-network.json      (ids, capacities, access results, derived blocked days)

The output is deterministic: sorted keys, fixed rounding, no timestamps, so two runs on the
same GeoPackage give byte-identical files. The network is fictional (status "synthetic");
only the road geometry underneath it is real (OpenStreetMap).

    python3 scripts/build-gis-network.py                # build
    python3 scripts/build-gis-network.py --register     # build and update both manifests
"""

from pathlib import Path
import argparse
import hashlib
import json
import sqlite3
import struct

ROOT = Path(__file__).resolve().parent.parent
GPKG_PATH = "research/gis/v1/climate_gis.gpkg"
OUT_GEOJSON = "public/data/gis-network.geojson"
OUT_JSON = "public/data/gis-network.json"

# ---- scenario assumptions (stated in the output; change here, then rebuild) ----
SPEED_KMH = 25.0  # one assumed speed for every road, no vehicle model
DELAYED_FACTOR = 1.2  # trip at least 20% longer than the clear-day trip
BLOCKED_FACTOR = 1.75  # trip at least 75% longer than the clear-day trip, or no route
ORIGIN = "supplier"  # every route starts here
TARGET = "reserve"  # the route that decides a delivery day
# Storm condition per planning day (index 0 = day 1). Day index 1 is the engine's blocked day.
STORM_SCHEDULE = ["clear", "severe", "moderate", "clear", "clear", "clear", "clear"]
CONDITION_TO_SCENARIO = {
    "clear": "baseline",
    "moderate": "storm_moderate",
    "severe": "storm_severe",
}
STORM_SEVERITY = {1: "moderate", 3: "severe"}
# Which storm polygon was removed from the roads for each condition (clear removes none).
CONDITION_HAZARD = {"clear": None, "moderate": "storm-1", "severe": "storm-3"}
NODE_IDS = ["crew", "pond", "pump", "reserve", "school", "supplier"]
CATCHMENT_IDS = ["east_catchment", "west_catchment"]
RESERVE_CAPACITY_L = 10000
DACOPE_BBOX = (89.40, 22.40, 89.70, 22.70)  # lon_min, lat_min, lon_max, lat_max
STATUS = "synthetic"
ATTRIBUTION = (
    "Road geometry derived from OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0 "
    "(HOT export). Network points, catchments and hazard polygons are fictional."
)


# ---- minimal GeoPackage geometry reader (GP header + WKB) ----
def _wkb(buf, pos=0):
    little = buf[pos] == 1
    e = "<" if little else ">"
    (code,) = struct.unpack_from(e + "I", buf, pos + 1)
    pos += 5
    base, dim = code % 1000, code // 1000
    n = 2 + (1 if dim in (1, 3) else 0) + (1 if dim in (2, 3) else 0)

    def point(p):
        vals = struct.unpack_from(e + "d" * n, buf, p)
        return [vals[0], vals[1]], p + 8 * n

    def points(p):
        (count,) = struct.unpack_from(e + "I", buf, p)
        p += 4
        out = []
        for _ in range(count):
            xy, p = point(p)
            out.append(xy)
        return out, p

    if base == 1:
        xy, pos = point(pos)
        return {"type": "Point", "coordinates": xy}, pos
    if base == 2:
        pts, pos = points(pos)
        return {"type": "LineString", "coordinates": pts}, pos
    if base == 3:
        (rings,) = struct.unpack_from(e + "I", buf, pos)
        pos += 4
        out = []
        for _ in range(rings):
            ring, pos = points(pos)
            out.append(ring)
        return {"type": "Polygon", "coordinates": out}, pos
    if base in (4, 5, 6):
        (count,) = struct.unpack_from(e + "I", buf, pos)
        pos += 4
        parts = []
        for _ in range(count):
            g, pos = _wkb(buf, pos)
            parts.append(g["coordinates"])
        name = {4: "MultiPoint", 5: "MultiLineString", 6: "MultiPolygon"}[base]
        return {"type": name, "coordinates": parts}, pos
    raise ValueError(f"Unsupported WKB geometry type {code}")


def read_geometry(blob):
    if blob is None:
        return None
    if blob[:2] != b"GP":
        raise ValueError("Not a GeoPackage geometry blob")
    flags = blob[3]
    if flags & 0x10:  # empty geometry
        return None
    envelope = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    return _wkb(blob[8 + envelope :])[0]


def round_coords(value):
    if isinstance(value, list):
        return [round_coords(v) for v in value]
    return round(value, 6) + 0.0  # + 0.0 turns -0.0 into 0.0


def clean_geometry(geom):
    if geom is None:
        return None
    return {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}


def read_layer(conn, table):
    geom_col = conn.execute(
        "select column_name from gpkg_geometry_columns where table_name = ?", (table,)
    ).fetchone()[0]
    cur = conn.execute(f'select * from "{table}" order by fid')
    names = [d[0] for d in cur.description]
    rows = []
    for values in cur:
        row = dict(zip(names, values))
        row["_geometry"] = clean_geometry(read_geometry(row.pop(geom_col)))
        rows.append(row)
    return rows


def iso_date(text):
    if not text:
        return None
    text = str(text).strip()
    if len(text) == 10 and text[2] == "/" and text[5] == "/":  # dd/mm/yyyy from QGIS
        return f"{text[6:]}-{text[3:5]}-{text[:2]}"
    return text


def classify(reachable, factor):
    if not reachable or factor >= BLOCKED_FACTOR:
        return "extreme_delay"
    if factor >= DELAYED_FACTOR:
        return "delayed"
    return "open"


def iter_points(coords):
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for part in coords:
            yield from iter_points(part)


def require(condition, message):
    if not condition:
        raise SystemExit("GIS check failed: " + message)


def build(gpkg_file):
    sha = hashlib.sha256(gpkg_file.read_bytes()).hexdigest()
    conn = sqlite3.connect(f"file:{gpkg_file.as_posix()}?mode=ro", uri=True)
    nodes = read_layer(conn, "network_nodes")
    catchments = read_layer(conn, "catchments")
    hazards = read_layer(conn, "hazard_zones")
    access_rows = read_layer(conn, "access_matrix")
    conn.close()

    require(sorted(n["id"] for n in nodes) == NODE_IDS, "network_nodes ids must be " + str(NODE_IDS))
    require(
        sorted(c["id"] for c in catchments) == CATCHMENT_IDS,
        "catchments ids must be " + str(CATCHMENT_IDS),
    )
    reserve = next(n for n in nodes if n["id"] == TARGET)
    require(reserve["capacity_l"] == RESERVE_CAPACITY_L, "reserve capacity_l must be 10000")
    for layer in (nodes, catchments):
        require(all(r["provenance"] == STATUS for r in layer), 'provenance must be "synthetic"')
    require(
        sorted((h["scenario"], h["severity"]) for h in hazards)
        == [("salinity", 1), ("storm", 1), ("storm", 3)],
        "hazard_zones must hold storm 1, storm 3 and salinity 1",
    )

    # access results: all routes start at the supplier; a missing row means unreachable
    targets = [n["id"] for n in nodes if n["id"] != ORIGIN]
    scenarios = list(CONDITION_TO_SCENARIO.values())
    found = {}
    route_lines = {}
    for r in access_rows:
        if r["id"] == ORIGIN or r["cost"] is None:
            continue
        found[(r["scenario"], r["id"])] = float(r["cost"])
        if r["id"] == TARGET and r["_geometry"]:
            route_lines[r["scenario"]] = r["_geometry"]
    require(set(s for s, _ in found) <= set(scenarios), "unexpected scenario in access_matrix")
    base = {t: found.get(("baseline", t)) for t in targets}
    require(all(v for v in base.values()), "baseline must reach every node")
    access = {}
    for s in scenarios:
        access[s] = {}
        for t in targets:
            cost = found.get((s, t))
            if cost is None:
                access[s][t] = {
                    "reachable": False,
                    "distanceM": None,
                    "minutes": None,
                    "detourFactor": None,
                    "status": "extreme_delay",
                }
                continue
            factor = round(cost / base[t], 3)
            access[s][t] = {
                "reachable": True,
                "distanceM": round(cost, 1),
                "minutes": round(cost / 1000 / SPEED_KMH * 60, 1),
                "detourFactor": factor,
                "status": classify(True, factor),
            }

    storm_days = []
    for index, condition in enumerate(STORM_SCHEDULE):
        key = CONDITION_TO_SCENARIO[condition]
        result = access[key][TARGET]
        storm_days.append(
            {
                "dayIndex": index,
                "condition": condition,
                "scenario": key,
                "minutesToReserve": result["minutes"],
                "status": result["status"],
            }
        )
    blocked_days = [d["dayIndex"] for d in storm_days if d["status"] == "extreme_delay"]
    salinity_restricted = sorted(
        n["id"] for n in nodes if n["type"] in ("pond", "pump") and n["exposed_salinity"] == 1
    )
    storm_restricted = sorted(
        n["id"] for n in nodes if n["type"] in ("pond", "pump") and n["exposed_storm"] == 1
    )

    def node_out(n):
        lon, lat = n["_geometry"]["coordinates"]
        return {
            "id": n["id"],
            "type": n["type"],
            "name": n["name"],
            "lon": lon,
            "lat": lat,
            "capacityL": n["capacity_l"],
            "inflowLDay": n["inflow_l_day"],
            "priority": n["priority"],
            "exposedStorm": n["exposed_storm"],
            "exposedSalinity": n["exposed_salinity"],
            "status": STATUS,
        }

    def catchment_out(c):
        return {
            "id": c["id"],
            "name": c["name"],
            "demandLDay": c["demand_l_day"],
            "households": c["households"],
            "exposedStorm": c["exposed_storm"],
            "exposedSalinity": c["exposed_salinity"],
            "status": STATUS,
        }

    def hazard_out(h):
        label = STORM_SEVERITY[h["severity"]] if h["scenario"] == "storm" else "held source"
        return {
            "id": f"{h['scenario']}-{h['severity']}",
            "scenario": h["scenario"],
            "severity": h["severity"],
            "label": label,
            "issuer": h["issuer"],
            "issuedAt": iso_date(h["issued_at"]),
            "validUntil": iso_date(h["valid_until"]),
            "status": STATUS,
        }

    out_nodes = sorted((node_out(n) for n in nodes), key=lambda x: x["id"])
    out_catch = sorted((catchment_out(c) for c in catchments), key=lambda x: x["id"])
    out_haz = sorted((hazard_out(h) for h in hazards), key=lambda x: x["id"])

    summary = {
        "schema": "climate-plus/gis-network-v1",
        "meaning": (
            "Fictional water-continuity network placed on real Dacope roads. Distances come from "
            "the OpenStreetMap road geometry; minutes, thresholds and the storm schedule are "
            "stated scenario assumptions, not measurements or forecasts."
        ),
        "attribution": ATTRIBUTION,
        "source": {
            "file": GPKG_PATH,
            "sha256": sha,
            "layers": [
                "access_matrix",
                "catchments",
                "hazard_zones",
                "network_nodes",
            ],
        },
        "assumptions": {
            "speedKmh": SPEED_KMH,
            "delayedFactor": DELAYED_FACTOR,
            "blockedFactor": BLOCKED_FACTOR,
            "origin": ORIGIN,
            "target": TARGET,
            "rule": (
                "A day is an extreme delay when the reserve cannot be reached or the trip is at least "
                f"{BLOCKED_FACTOR} times the clear-day distance; delayed from {DELAYED_FACTOR} times."
            ),
            "stormSchedule": STORM_SCHEDULE,
            "conditionScenario": CONDITION_TO_SCENARIO,
            "conditionHazard": CONDITION_HAZARD,
            "stormSeverity": {str(k): v for k, v in STORM_SEVERITY.items()},
            "crs": "EPSG:4326 (distances measured on the road network, metres)",
        },
        "nodes": out_nodes,
        "catchments": out_catch,
        "hazards": out_haz,
        "access": access,
        "stormDays": storm_days,
        "derived": {
            "storm": {
                "blockedDays": blocked_days,
                "restrictedSourcesFromGeography": storm_restricted,
            },
            "salinity": {"blockedDays": [], "restrictedSourcesFromGeography": salinity_restricted},
            "dry": {"blockedDays": [], "restrictedSourcesFromGeography": []},
        },
        "notes": [
            "The storm polygons cut roads but the supplier still reaches the reserve by a longer "
            "route, so blocking comes from the detour-factor rule, not from disconnection.",
            "No storm polygon covers the pump, so restrictedSourcesFromGeography for the storm is "
            "empty; the engine's pump outage in the storm scenario remains a scenario assumption.",
            "Nothing is blockaded. The planner only understands usable or unusable days, so an extreme-delay day is treated as no delivery (a scenario assumption); a delayed day is informative.",
        ],
    }

    features = []
    for n, raw in sorted(zip(out_nodes, sorted(nodes, key=lambda x: x["id"])), key=lambda x: x[0]["id"]):
        props = dict(n, kind="node")
        for k in ("lon", "lat"):
            props.pop(k)
        features.append({"type": "Feature", "geometry": raw["_geometry"], "properties": props})
    for c, raw in zip(out_catch, sorted(catchments, key=lambda x: x["id"])):
        props = dict(c, kind="catchment")
        features.append({"type": "Feature", "geometry": raw["_geometry"], "properties": props})
    haz_geo = {f"{h['scenario']}-{h['severity']}": h["_geometry"] for h in hazards}
    for h in out_haz:
        features.append(
            {"type": "Feature", "geometry": haz_geo[h["id"]], "properties": dict(h, kind="hazard")}
        )
    for s in scenarios:
        result = access[s][TARGET]
        props = {
            "kind": "route",
            "id": f"{s}-{ORIGIN}-{TARGET}",
            "scenario": s,
            "from": ORIGIN,
            "to": TARGET,
            "distanceM": result["distanceM"],
            "minutes": result["minutes"],
            "detourFactor": result["detourFactor"],
            "status": STATUS,
        }
        features.append({"type": "Feature", "geometry": route_lines.get(s), "properties": props})
    geojson = {
        "type": "FeatureCollection",
        "name": "climate-plus-gis-network",
        "properties": {"source": GPKG_PATH, "sha256": sha, "attribution": ATTRIBUTION},
        "features": features,
    }

    for f in features:
        g = f["geometry"]
        require(g is not None, "every feature needs a geometry: " + f["properties"]["id"])
        for lon, lat in iter_points(g["coordinates"]):
            require(
                DACOPE_BBOX[0] <= lon <= DACOPE_BBOX[2] and DACOPE_BBOX[1] <= lat <= DACOPE_BBOX[3],
                f"{f['properties']['id']} lies outside the Dacope window",
            )
    return geojson, summary


def write_outputs(geojson, summary, out_dir):
    geo_text = json.dumps(geojson, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    sum_text = json.dumps(summary, sort_keys=True, indent=2, allow_nan=False) + "\n"
    paths = {}
    for rel, text in ((OUT_GEOJSON, geo_text), (OUT_JSON, sum_text)):
        path = out_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        paths[rel] = path
    return paths


def register(root, outputs):
    manifest_path = root / "DATA-MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = {GPKG_PATH: root / GPKG_PATH, **outputs}
    entries = {}
    for rel, path in files.items():
        data = path.read_bytes()
        entries[rel] = {"path": rel, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    kept = [f for f in manifest["files"] if f["path"] not in entries]
    manifest["files"] = sorted(kept + list(entries.values()), key=lambda f: f["path"].lower())
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )

    datasets_path = root / "DATASETS.json"
    datasets = json.loads(datasets_path.read_text(encoding="utf-8"))
    gpkg = entries[GPKG_PATH]
    entry = {
        "id": "gis-dacope-network-v1",
        "title": "Climate++ fictional water-continuity network on Dacope roads (GeoPackage)",
        "doi": None,
        "version": "1",
        "authors": "Ahnaf Antar (Climate++ GIS)",
        "url": None,
        "license": (
            "Synthetic layers: project terms to be set by the team. Embedded road geometry is "
            "OpenStreetMap, (c) OpenStreetMap contributors, ODbL 1.0 (HOT export). Dacope "
            "boundary from the HDX Bangladesh administrative boundaries; confirm its licence "
            "on the HDX dataset page."
        ),
        "acquired": "2026-10-23",
        "path": GPKG_PATH,
        "size": "13 layers; 6 network nodes, 2 catchments, 3 hazard polygons, 18 access rows",
        "period": "Scenario layers; no observation period",
        "used": "Situation map layers; derived blocked delivery days; exposure flags",
        "transform": (
            "Nodes and polygons digitised in QGIS on OSM roads (snapped); shortest paths on the "
            "road network, with storm polygons removed from the roads by geometric difference; "
            "scripts/build-gis-network.py converts the layers to JSON and applies the stated "
            "speed and thresholds."
        ),
        "limits": (
            "Fictional network and hazard polygons; not a forecast and not an operating system. "
            "Speed is one assumed value for all roads; thresholds are scenario assumptions. OSM "
            "completeness is unverified; nothing is validated on the ground."
        ),
        "sha256": gpkg["sha256"],
        "bytes": gpkg["bytes"],
    }
    datasets = [d for d in datasets if d["id"] != entry["id"]] + [entry]
    datasets_path.write_text(
        json.dumps(datasets, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--gpkg", type=Path, default=ROOT / GPKG_PATH)
    parser.add_argument("--out", type=Path, default=ROOT, help="folder that receives public/data")
    parser.add_argument("--register", action="store_true", help="update DATA-MANIFEST and DATASETS")
    args = parser.parse_args()
    geojson, summary = build(args.gpkg)
    paths = write_outputs(geojson, summary, args.out)
    if args.register:
        register(ROOT, paths)
    storm = summary["derived"]["storm"]["blockedDays"]
    print(f"wrote {OUT_GEOJSON} and {OUT_JSON}; storm blockedDays = {storm}")


if __name__ == "__main__":
    main()
