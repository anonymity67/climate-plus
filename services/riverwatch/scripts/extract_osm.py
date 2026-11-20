"""Extract waste sources, receptors and water features for Bangladesh from a Geofabrik
OpenStreetMap extract (bangladesh-latest.osm.pbf).

Overpass equivalents of what is extracted (README section 2):
  waste sources : man_made=works, landuse=industrial, industrial=*, craft=tannery|dyer,
                  landuse=landfill, amenity=waste_transfer_station, man_made=wastewater_plant
  receptors     : amenity=school|hospital|drinking_water, man_made=water_well
  water features: waterway=river (named), natural=water polygons (named, lakes/haors/rivers)

Output: .cache/osm_features.parquet-like GeoPackage (data/inputs/osm_raw.gpkg) with layers
'sources', 'pois', 'rivers_osm', 'water'. (c) OpenStreetMap contributors, ODbL 1.0.
"""
from pathlib import Path
import sys

import geopandas as gpd
import osmium
import shapely.wkb as wkblib

ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / ".cache/raw/bangladesh-latest.osm.pbf"
OUT = ROOT / ".cache/osm_raw.gpkg"
WKB = osmium.geom.WKBFactory()
KEEP_TAGS = ("name", "name:en", "operator", "product", "industrial", "craft", "man_made",
             "landuse", "amenity", "water", "waterway", "natural", "wetland", "addr:city",
             "addr:district", "website", "description")


def source_kind(t):
    if t.get("landuse") == "landfill":
        return "landfill"
    if t.get("amenity") == "waste_transfer_station":
        return "waste_transfer"
    if t.get("man_made") == "wastewater_plant":
        return "wastewater_plant"
    if t.get("man_made") == "works" or t.get("industrial") or t.get("craft") in ("tannery", "dyer"):
        return "industrial"
    if t.get("landuse") == "industrial":
        return "industrial_area"
    return None


def poi_kind(t):
    a = t.get("amenity")
    if a in ("school", "hospital", "drinking_water"):
        return a
    if t.get("man_made") == "water_well":
        return "water_well"
    return None


def water_kind(t):
    if t.get("natural") == "water" and t.get("name"):
        return "water"
    if t.get("natural") == "wetland" and t.get("name"):
        return "water"
    return None


class Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = {"sources": [], "pois": [], "rivers_osm": [], "water": []}

    def _add(self, layer, kind, otype, oid, tags, geom):
        row = {"kind": kind, "osm_type": otype, "osm_id": oid,
               **{k.replace(":", "_"): tags.get(k, "") for k in KEEP_TAGS}, "geometry": geom}
        self.rows[layer].append(row)

    def node(self, n):
        t = n.tags
        if not t:
            return
        k = source_kind(t)
        p = poi_kind(t)
        if not (k or p):
            return
        try:
            g = wkblib.loads(WKB.create_point(n), hex=True)
        except Exception:
            return
        if k:
            self._add("sources", k, "node", n.id, t, g)
        if p:
            self._add("pois", p, "node", n.id, t, g)

    def way(self, w):
        t = w.tags
        if t.get("waterway") == "river" and t.get("name"):
            try:
                g = wkblib.loads(WKB.create_linestring(w), hex=True)
                self._add("rivers_osm", "river", "way", w.id, t, g)
            except Exception:
                pass

    def area(self, a):
        t = a.tags
        k, p, wk = source_kind(t), poi_kind(t), water_kind(t)
        if not (k or p or wk):
            return
        try:
            g = wkblib.loads(WKB.create_multipolygon(a), hex=True)
        except Exception:
            return
        otype = "way" if a.from_way() else "relation"
        oid = a.orig_id()
        if k:
            self._add("sources", k, otype, oid, t, g)
        if p:
            self._add("pois", p, otype, oid, t, g.representative_point())
        if wk:
            self._add("water", wk, otype, oid, t, g)


class RelCollector(osmium.SimpleHandler):
    """Pass 1: named waterway relations (many big BD rivers carry names only here)."""
    def __init__(self):
        super().__init__()
        self.members, self.names = {}, {}

    def relation(self, r):
        t = r.tags
        if t.get("type") == "waterway" and t.get("waterway") in ("river", "canal") and t.get("name"):
            nm = t.get("name:en") or t.get("name")
            self.names[r.id] = nm
            for m in r.members:
                if m.type == "w" and m.role in ("", "main_stream", "side_stream"):
                    self.members.setdefault(m.ref, r.id)


class RelWays(osmium.SimpleHandler):
    """Pass 2: geometries of member ways of the named waterway relations."""
    def __init__(self, members, names):
        super().__init__()
        self.members, self.names, self.rows = members, names, []

    def way(self, w):
        rid = self.members.get(w.id)
        if rid is None:
            return
        try:
            g = wkblib.loads(WKB.create_linestring(w), hex=True)
        except Exception:
            return
        self.rows.append({"kind": "river", "osm_type": "relation", "osm_id": rid,
                          "name": self.names[rid], "name_en": self.names[rid], "geometry": g})


def waterway_relations():
    rc = RelCollector()
    rc.apply_file(str(PBF))
    rw = RelWays(rc.members, rc.names)
    idx = ROOT / ".cache/nodes2.idx"
    rw.apply_file(str(PBF), locations=True, idx=f"sparse_file_array,{idx}")
    idx.unlink(missing_ok=True)
    g = gpd.GeoDataFrame(rw.rows, geometry="geometry", crs=4326)
    g.to_file(OUT, layer="river_relations", driver="GPKG", index=False)
    print("river_relations", len(g), "member ways of", len(rc.names), "named waterway relations")


def main():
    if "--relations-only" in sys.argv:
        return waterway_relations()
    if not PBF.is_file():
        sys.exit(f"Missing {PBF}; run scripts/fetch_data.py first.")
    h = Handler()
    idx = ROOT / ".cache/nodes.idx"
    h.apply_file(str(PBF), locations=True, idx=f"sparse_file_array,{idx}")
    idx.unlink(missing_ok=True)
    OUT.unlink(missing_ok=True)
    for layer, rows in h.rows.items():
        g = gpd.GeoDataFrame(rows, geometry="geometry", crs=4326)
        g.to_file(OUT, layer=layer, driver="GPKG", index=False)
        print(layer, len(g), g["kind"].value_counts().to_dict() if len(g) else {})
    waterway_relations()


if __name__ == "__main__":
    main()
