from collections import defaultdict
import hashlib
import json
import math

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import LineString, Point, box, mapping
from shapely.ops import linemerge, substring
from rasterio.errors import WindowError
from rasterio.features import geometry_window, geometry_mask
from rasterio.windows import Window

POI_TYPES = ("school", "hospital", "drinking_water", "water_well")
SAMPLE_COLUMNS = ["pair_id", "site_id", "side", "longitude", "latitude"]


def frame(rows, crs):
    return gpd.GeoDataFrame(rows or {"geometry": []}, geometry="geometry", crs=crs)


def text(value):
    return "" if pd.isna(value) else str(value).strip()


def yes(value):
    return text(value).lower() in {"true", "yes", "1", "1.0"}


def reach_number(value):
    if not text(value):
        return None
    number = float(value)
    if not math.isfinite(number) or number < 0 or not number.is_integer():
        raise ValueError(f"Invalid river reach ID: {value!r}")
    return int(number) or None


def read_sites(path, crs):
    sites = gpd.read_file(path)
    if sites.empty or sites.crs is None or "site_id" not in sites:
        raise ValueError("Sites must contain site_id, points, and a defined CRS.")
    if not sites.geom_type.eq("Point").all() or sites.geometry.is_empty.any():
        raise ValueError("Every site must have one non-empty Point geometry.")
    sites = sites.to_crs(crs)
    sites["site_id"] = sites["site_id"].map(text)
    if sites.site_id.eq("").any() or sites.site_id.duplicated().any():
        raise ValueError("site_id must be nonblank and unique.")

    fields = {
        "name": "", "industry_type": "", "role": "site",
        "outfall_confirmed": False, "outfall_source": "",
        "flow_reviewed": False, "receiving_reach_id": "",
        "severity": None, "severity_source": "", "discharge_m3d": None,
    }
    for field, default in fields.items():
        if field not in sites:
            sites[field] = default
    sites["role"] = sites.role.map(lambda v: text(v).lower() or "site")
    if not sites.role.isin(["site", "reference"]).all():
        raise ValueError("role must be site or reference.")
    for field in ["name", "industry_type", "outfall_source",
                  "receiving_reach_id", "severity_source"]:
        sites[field] = sites[field].map(text)
    for field in ["outfall_confirmed", "flow_reviewed"]:
        sites[field] = sites[field].map(yes)
    for field in ["severity", "discharge_m3d"]:
        sites[field] = pd.to_numeric(sites[field], errors="coerce")
        sites[field] = sites[field].where(np.isfinite(sites[field]))
    if sites.geometry.name != "geometry":
        sites = sites.rename_geometry("geometry")
    return sites[["site_id", *fields, "geometry"]]


class FlowNetwork:
    def __init__(self, path, cfg):
        source = gpd.read_file(path)
        self.crs = cfg["crs"]
        self.tol = cfg["junction_m"]
        if source.empty or source.crs is None or not {"HYRIV_ID", "NEXT_DOWN"} <= set(source):
            raise ValueError("Rivers need lines, a CRS, HYRIV_ID and NEXT_DOWN.")
        source = source.to_crs(self.crs)
        self.raw, self.next = {}, {}
        for rid, nxt, geom in zip(source["HYRIV_ID"], source["NEXT_DOWN"], source.geometry):
            rid, nxt = reach_number(rid), reach_number(nxt)
            if geom is not None and geom.geom_type == "MultiLineString":
                geom = linemerge(geom)
            if (rid is None or rid in self.raw or geom is None
                or geom.geom_type != "LineString" or geom.is_empty or geom.length <= 0):
                raise ValueError(f"Reach {rid}: supply one connected non-empty line per unique ID.")
            self.raw[rid], self.next[rid] = geom, nxt
        self.parents = defaultdict(list)
        for rid, nxt in self.next.items():
            if nxt in self.raw and nxt != rid:
                self.parents[nxt].append(rid)

        self.lines, self.direction = {}, {}
        for rid, line in self.raw.items():
            nxt = self.next[rid]
            down_end = self.near_end(line, self.raw[nxt]) if nxt in self.raw and nxt != rid else None
            if down_end is not None:
                flip, method = down_end == 0, "downstream_junction"
            else:
                votes = {self.near_end(line, self.raw[p]) for p in self.parents[rid]}
                votes.discard(None)
                flip, method = (
                    (next(iter(votes)) == 1, "upstream_junction")
                    if len(votes) == 1 else (False, "unresolved")
                )
            self.lines[rid] = LineString(list(line.coords)[::-1]) if flip else line
            self.direction[rid] = method
        self.layer = frame([
            {"reach_id": rid, "next_id": self.next[rid],
             "orientation": self.direction[rid], "geometry": line}
            for rid, line in self.lines.items()
        ], self.crs)
        self.index = self.layer.sindex

    def near_end(self, line, other):
        ends = [Point(other.coords[0]), Point(other.coords[-1])]
        d = [min(Point(coord).distance(e) for e in ends)
             for coord in (line.coords[0], line.coords[-1])]
        if min(d) > self.tol or abs(d[0] - d[1]) < 1.0:
            return None
        return 0 if d[0] < d[1] else 1

    def connected(self, a, b):
        return (
            a != b and b in self.lines and self.next[a] == b
            and self.direction[a] != "unresolved"
            and self.direction[b] != "unresolved"
            and Point(self.lines[a].coords[-1]).distance(
                Point(self.lines[b].coords[0])
            ) <= self.tol
        )

    def snap(self, point, manual, cfg):
        limit = cfg["snap_m"]
        if text(manual):
            rid = reach_number(manual)
            if rid not in self.lines:
                return None, None, "override_not_found", False
            d = self.lines[rid].distance(point)
            return (rid, d, "manual", False) if d <= limit else (
                None, d, "override_too_far", False
            )
        x, y = point.x, point.y
        ids = self.index.query(box(x-limit, y-limit, x+limit, y+limit))
        candidates = sorted(
            (float(self.layer.geometry.iloc[i].distance(point)), int(self.layer.reach_id.iloc[i]))
            for i in ids
        )
        candidates = [(d, r) for d, r in candidates if d <= limit]
        if not candidates:
            return None, None, "no_nearby_reach", False
        d, rid = candidates[0]
        ambiguous = len(candidates) > 1 and candidates[1][0] - d <= cfg["ambiguity_m"]
        return rid, d, "nearest_ambiguous" if ambiguous else "nearest", ambiguous

    def probe(self, rid, position, signed_metres):
        downstream = signed_metres >= 0
        left, seen = abs(signed_metres), set()
        while rid not in seen and self.direction[rid] != "unresolved":
            seen.add(rid)
            line = self.lines[rid]
            room = line.length - position if downstream else position
            if left <= room:
                return line.interpolate(position + (left if downstream else -left))
            left -= room
            if downstream:
                nxt = self.next[rid]
                if not self.connected(rid, nxt) or len(self.parents[nxt]) != 1:
                    break
                rid, position = nxt, 0
            else:
                parents = self.parents[rid]
                if len(parents) != 1 or not self.connected(parents[0], rid):
                    break
                rid = parents[0]
                position = self.lines[rid].length
        return None

    def corridor(self, site, rid, position, cfg):
        used, seen, parts = 0.0, set(), []
        limit = 1000 * cfg["corridor_km"]
        while True:
            if rid in seen:
                return parts, "cycle"
            if self.direction[rid] == "unresolved":
                return parts, "unresolved_flow"
            seen.add(rid)
            line = self.lines[rid]
            take = min(max(0.0, line.length - position), limit - used)
            if take > 1e-6:
                parts.append({
                    "site_id": site, "reach_id": rid,
                    "start_km": used / 1000, "end_km": (used + take) / 1000,
                    "relative_index": math.exp(-used / (1000 * cfg["decay_km"])),
                    "geometry": substring(line, position, position + take),
                })
                used += take
            if used >= limit - 1e-6:
                return parts, "distance_limit"
            nxt = self.next[rid]
            if nxt is None:
                return parts, "network_end"
            if nxt in seen:
                return parts, "cycle"
            if nxt not in self.lines:
                return parts, "network_clipped"
            if not self.connected(rid, nxt):
                return parts, "junction_gap_or_unresolved"
            rid, position = nxt, 0.0


def derive(sites, net, cfg):
    from shapely.ops import unary_union

    links, samples, segments, zones, info = [], [], [], [], {}
    for row in sites.itertuples(index=False):
        sid = row.site_id
        rid, distance, method, ambiguous = net.snap(row.geometry, row.receiving_reach_id, cfg)
        status = {
            "reach_id": rid, "snap_distance_m": distance, "snap_method": method,
            "link_reviewed": False, "corridor_stop": "unlinked", "sample_pair_ready": False,
        }
        info[sid] = status
        if rid is None:
            continue
        status["link_reviewed"] = bool(
            row.outfall_confirmed and row.outfall_source and row.flow_reviewed
            and not ambiguous and net.direction[rid] != "unresolved"
        )
        line = net.lines[rid]
        position = line.project(row.geometry)
        discharge = line.interpolate(position)
        parts, stop = net.corridor(sid, rid, position, cfg)
        status["corridor_stop"] = stop
        segments.extend(parts)
        if parts:
            zone = unary_union([p["geometry"] for p in parts]).buffer(cfg["buffer_m"])
            zones.append({"site_id": sid, "geometry": zone})

        up = net.probe(rid, position, -cfg["offset_m"])
        down = net.probe(rid, position, cfg["offset_m"])
        radius = cfg["sample_radius_m"]
        if (up is not None and down is not None and up.distance(down) > 2 * radius
            and min(up.distance(discharge), down.distance(discharge)) > radius):
            probes = gpd.GeoSeries([up, down], crs=net.crs).to_crs(4326)
            seed = [sid, radius, *[round(v, 7) for p in probes for v in (p.x, p.y)]]
            pair_id = "p_" + hashlib.sha256(json.dumps(seed).encode()).hexdigest()[:24]
            for side, point in [("up", up), ("down", down)]:
                samples.append({"site_id": sid, "pair_id": pair_id, "side": side,
                                "geometry": point})
            status["sample_pair_ready"] = True
        links.append({"site_id": sid, **status, "geometry": discharge})
    return (
        frame(links, net.crs), frame(samples, net.crs), frame(segments, net.crs),
        frame(zones, net.crs), info,
    )


def sample_table(probes):
    if probes.empty:
        return pd.DataFrame(columns=SAMPLE_COLUMNS)
    df = probes.to_crs(4326).copy()
    df["longitude"], df["latitude"] = df.geometry.x, df.geometry.y
    return pd.DataFrame(df[SAMPLE_COLUMNS])


def read_pois(path, crs):
    if path is None:
        return None
    g = gpd.read_file(path)
    if g.crs is None:
        raise ValueError("POIs require a defined CRS.")
    g = g.to_crs(crs)
    rows = []
    for _, r in g.iterrows():
        kind = text(r.get("poi_type"))
        if kind not in POI_TYPES:
            kind = text(r.get("amenity"))
        if kind not in POI_TYPES and text(r.get("man_made")) == "water_well":
            kind = "water_well"
        geom = r.geometry
        if geom is None or geom.is_empty or kind not in POI_TYPES:
            continue
        key = text(r.get("@id")) or text(r.get("osm_id")) or text(r.get("id"))
        p = geom.representative_point()
        rows.append({"poi_type": kind, "key": key or f"{kind}:{p.wkb_hex}", "geometry": p})
    result = frame(rows, crs)
    return result.drop_duplicates("key") if not result.empty else result


def poi_counts(pois, zone):
    if pois is None or zone is None:
        return {k: None for k in POI_TYPES}
    if pois.empty:
        return {k: 0 for k in POI_TYPES}
    ix = pois.sindex.query(zone, predicate="intersects")
    count = pois.iloc[ix].poi_type.value_counts()
    return {k: int(count.get(k, 0)) for k in POI_TYPES}


def population(ds, zone):
    """zone must be in the source raster CRS; do not resample count rasters."""
    n, valid, total = 0, 0, 0.0
    result = {"pop_near": None, "valid_pop_cells": 0,
              "zone_cells_in_raster": 0, "pop_coverage_complete": False}
    if ds is None or zone is None or zone.is_empty:
        return result
    shape = mapping(zone)
    try:
        win = geometry_window(ds, [shape])
    except WindowError:
        return result
    r0, c0 = int(win.row_off), int(win.col_off)
    r1, c1 = r0 + int(win.height), c0 + int(win.width)
    for r in range(r0, r1, 512):
        for c in range(c0, c1, 512):
            tile = Window(c, r, min(512, c1 - c), min(512, r1 - r))
            inside = geometry_mask(
                [shape], out_shape=(int(tile.height), int(tile.width)),
                transform=ds.window_transform(tile), invert=True, all_touched=False,
            )
            if not inside.any():
                continue
            a = ds.read(1, window=tile, masked=True)
            used = inside & ~np.ma.getmaskarray(a) & np.isfinite(a.data) & (a.data >= 0)
            n += int(inside.sum())
            valid += int(used.sum())
            total += float(a.data[used].sum(dtype=np.float64))
    return {
        "pop_near": total if valid else None, "valid_pop_cells": valid,
        "zone_cells_in_raster": n,
        "pop_coverage_complete": bool(valid and valid == n and box(*ds.bounds).covers(zone)),
    }
