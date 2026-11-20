#!/usr/bin/env python3
"""Export a deterministic, bounded road graph from the supplied GeoPackage.

Standard library only. Run: python scripts/build-road-graph.py
Coordinates are WGS84; distances use a 6371008.8m spherical Earth. Never invents
connections at un-noded geometric crossings or bridges across nearby endpoints.
"""
from pathlib import Path
from collections import defaultdict, Counter
import argparse
import hashlib
import importlib.util
import json
import math
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "research/gis/v1/climate_gis.gpkg"
PROFILE_ROADS = {"tertiary", "residential", "service", "unclassified", "living_street", "livingstreet"}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def metres(a, b):
    x1, y1, x2, y2 = map(math.radians, (*a, *b))
    h = math.sin((y2-y1)/2)**2 + math.cos(y1)*math.cos(y2)*math.sin((x2-x1)/2)**2
    return 2*6371008.8*math.asin(min(1, math.sqrt(h)))


def grade(row):
    # Missing bridge layer defaults to bridge level 1, missing ground layer to 0.
    bridge = str(row.get("bridge") or "").lower() not in ("", "no", "0", "false")
    layer = str(row.get("layer") or ("1" if bridge else "0"))
    return (layer, bridge)


def build_topology(rows):
    """Shared-vertex topology, with shape vertices retained inside each edge.

    Same-grade occurrences join. Different grades join at two original road
    endpoints, or at a bridge endpoint and a shared ground vertex (ramp
    assumption). Bridge interiors stay separate from ground roads.
    """
    rows = sorted(rows, key=lambda r: (r["fid"], str(r.get("id"))))
    locations = defaultdict(list)
    coordinates = []
    parents = {}
    duplicate_vertices = 0
    for road_index, row in enumerate(rows):
        geometry = row.get("_geometry")
        if not geometry or geometry["type"] != "LineString":
            raise ValueError("Every source road must be a LineString")
        points = []
        for point in geometry["coordinates"]:
            if len(point) != 2 or not all(math.isfinite(v) for v in point) or abs(point[0]) > 180 or abs(point[1]) > 90:
                raise ValueError("Invalid WGS84 road coordinate")
            point = tuple(round(float(v), 8) + 0.0 for v in point)
            if points and point == points[-1]:
                duplicate_vertices += 1
                continue
            points.append(point)
        if len(points) < 2:
            raise ValueError("Unusable road geometry")
        coordinates.append(points)
        for vertex_index, point in enumerate(points):
            key = (road_index, vertex_index)
            parents[key] = key
            locations[point].append((key, vertex_index in (0, len(points)-1), grade(row)))

    def find(key):
        while parents[key] != key:
            parents[key] = parents[parents[key]]
            key = parents[key]
        return key

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parents[max(a, b)] = min(a, b)

    grade_separated_shared_coordinates = 0
    endpoint_grade_transitions = 0
    for occurrences in locations.values():
        separated = False
        for index, (a, a_end, a_grade) in enumerate(occurrences):
            for b, b_end, b_grade in occurrences[index+1:]:
                bridge_ramp = (a_end and a_grade[1] and b_grade == ("0", False)) or (b_end and b_grade[1] and a_grade == ("0", False))
                if a_grade == b_grade or (a_end and b_end) or bridge_ramp:
                    union(a, b)
                    if a_grade != b_grade:
                        endpoint_grade_transitions += 1
                else:
                    separated = True
        grade_separated_shared_coordinates += int(separated)

    groups = defaultdict(list)
    for key in parents:
        groups[find(key)].append(key)
    node_ids = {}
    nodes = {}

    def node(key):
        representative = find(key)
        if representative not in node_ids:
            point = coordinates[key[0]][key[1]]
            members = [(rows[r]["fid"], v) for r, v in groups[representative]]
            identifier = "n-" + digest([point, members])[:16]
            node_ids[representative] = identifier
            nodes[identifier] = {"id": identifier, "coordinates": list(point)}
        return node_ids[representative]

    edges = []
    for road_index, row in enumerate(rows):
        points = coordinates[road_index]
        cuts = [i for i in range(len(points)) if i in (0, len(points)-1) or len(groups[find((road_index, i))]) > 1]
        for start, end in zip(cuts, cuts[1:]):
            shape = [list(p) for p in points[start:end+1]]
            length = sum(metres(a, b) for a, b in zip(shape, shape[1:]))
            if length <= 0:
                continue
            from_id, to_id = node((road_index, start)), node((road_index, end))
            direction = str(row.get("oneway") or "").lower()
            if direction == "-1":
                from_id, to_id, shape = to_id, from_id, shape[::-1]
            edges.append({
                "id": f"e-{row['fid']}-{start}-{end}", "from": from_id, "to": to_id,
                "coordinates": shape, "lengthM": round(length, 6),
                "highway": row.get("highway"), "name": row.get("name_en") or row.get("name") or row.get("name_latin") or None,
                "sourceId": row.get("id"), "sourceFid": row["fid"],
                "bridge": row.get("bridge"), "layer": row.get("layer"),
                "oneway": row.get("oneway"), "bidirectional": direction not in ("yes", "1", "true", "-1"),
            })
    edges.sort(key=lambda e: e["id"])
    graph = {"schema": "climate-plus/road-graph-v1", "nodes": sorted(nodes.values(), key=lambda n: n["id"]), "edges": edges}

    road_adjacency = defaultdict(set)
    road_edges = [edge for edge in edges if edge["highway"] in PROFILE_ROADS]
    for edge in road_edges:
        road_adjacency[edge["from"]].add(edge["to"])
        road_adjacency[edge["to"]].add(edge["from"])
    remaining = set(road_adjacency)
    components = []
    while remaining:
        seed = min(remaining)
        component = {seed}
        stack = [seed]
        remaining.remove(seed)
        while stack:
            for target in road_adjacency[stack.pop()]:
                if target in remaining:
                    remaining.remove(target)
                    component.add(target)
                    stack.append(target)
        contained = [edge for edge in road_edges if edge["from"] in component]
        components.append({"nodeCount": len(component), "edgeCount": len(contained), "lengthM": round(sum(e["lengthM"] for e in contained), 3)})
    components.sort(key=lambda c: (-c["nodeCount"], -c["edgeCount"]))
    all_points = [point for road in coordinates for point in road]
    graph["metadata"] = {
        "graphVersion": "dacope-shared-vertex-v1", "graphSha256": digest(graph),
        "graphHashDefinition": "SHA-256 of UTF-8 canonical JSON of {schema,nodes,edges}; sorted object keys, compact separators, literal Unicode; excludes metadata",
        "roadCount": len(rows), "roadProfileFeatureCount": sum(r.get("highway") in PROFILE_ROADS for r in rows),
        "nodeCount": len(nodes), "edgeCount": len(edges), "roadProfileEdgeCount": len(road_edges),
        "geometryVertexCount": len(all_points), "removedDuplicateConsecutiveVertices": duplicate_vertices,
        "highwayFeatureCounts": dict(sorted(Counter(r.get("highway") for r in rows).items())),
        "roadComponentCount": len(components), "roadComponents": components,
        "bounds": [min(p[0] for p in all_points), min(p[1] for p in all_points), max(p[0] for p in all_points), max(p[1] for p in all_points)],
        "crs": "EPSG:4326", "distanceModel": "Haversine, mean Earth radius 6371008.8m; no elevation adjustment",
        "maxSnapDistanceM": 250, "snapWarningDistanceM": 50,
        "gradeSeparatedSharedCoordinateCount": grade_separated_shared_coordinates,
        "endpointGradeTransitionCount": endpoint_grade_transitions,
        "onewayMissingFeatureCount": sum(r.get("oneway") is None for r in rows),
        "topology": "Equal coordinates rounded to 8 decimal degrees join at shared source vertices with equal (layer,bridge) grade. Different grades join at two original LineString endpoints, or a bridge endpoint and a shared ground (layer 0) vertex (assumed ramp). Bridge interiors, un-noded geometric crossings and nearby endpoints do not acquire connections.",
        "limitations": [
            "OpenStreetMap completeness, age, vehicle permissions, bridges, road condition and current traffic are unverified.",
            "All supplied one-way values are missing: bidirectional inference is a modelling assumption, not legal travel permission.",
            "Only tertiary, residential, unclassified, service and livingstreet/living_street types support the road profile. Footway, path and pedestrian types are excluded.",
            "Un-noded crossings and endpoints near but not equal remain disconnected. A bridge endpoint shared with a ground vertex is assumed to be a ramp junction, including the source bridge tagged layer -1. Missing or inconsistent bridge/layer values can conceal real grade separation.",
            "Geometric endpoint-to-road snapping is at most 250m; gaps above 50m are prominently warned. Connectors are unverified and excluded from routed distance and ETA; canals may prevent access.",
            "Distances are approximate surface lengths; speed and road-type caps are assumptions. No flood-safe, drinking-water-safe or validated traffic ETA claim follows.",
        ],
    }
    return graph


def build(gpkg):
    spec = importlib.util.spec_from_file_location("gis_geometry", ROOT / "scripts/build-gis-network.py")
    gis = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gis)
    connection = sqlite3.connect(f"file:{gpkg.as_posix()}?mode=ro", uri=True)
    try:
        info = connection.execute("select column_name,srs_id,geometry_type_name from gpkg_geometry_columns where table_name=?", ("roads_dacope",)).fetchone()
        if not info or info[1:] != (4326, "LINESTRING"):
            raise ValueError("Expected roads_dacope WGS84 LineStrings")
        cursor = connection.execute('select * from "roads_dacope" order by fid')
        columns = [column[0] for column in cursor.description]
        rows = []
        for record in cursor:
            row = dict(zip(columns, record))
            # Use the existing WKB decoder but retain original precision (not its 6dp display export).
            row["_geometry"] = gis.read_geometry(row.pop(info[0]))
            rows.append(row)
    finally:
        connection.close()
    graph = build_topology(rows)
    graph["metadata"].update({
        "sourceFile": SOURCE, "sourceLayer": "roads_dacope", "sourceSha256": hashlib.sha256(gpkg.read_bytes()).hexdigest(),
        "roadsSha256": digest(rows), "attribution": "Road geometry: © OpenStreetMap contributors, ODbL 1.0 (HOT extract embedded in supplied GeoPackage). Representational water assets and hazards are separate project layers.",
    })
    return graph


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--gpkg", type=Path, default=ROOT / SOURCE)
    parser.add_argument("--out", type=Path, default=ROOT)
    args = parser.parse_args()
    graph = build(args.gpkg)
    content = canonical(graph) + b"\n"
    for relative in ("public/data/dacope-road-graph.json", "backend/data/dacope-road-graph.json"):
        target = args.out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    print(json.dumps({"bytes": len(content), "fileSha256": hashlib.sha256(content).hexdigest(), **{k: graph["metadata"][k] for k in ("roadCount", "nodeCount", "edgeCount", "roadComponentCount", "graphSha256", "sourceSha256")}}))


if __name__ == "__main__":
    main()
