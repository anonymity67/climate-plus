"""Build RiverWatch inputs and web reference layers from real open data.

Inputs (downloaded by scripts/fetch_data.py, extracted by scripts/extract_osm.py):
  .cache/osm_raw.gpkg            OpenStreetMap (Geofabrik extract), ODbL
  .cache/raw/geoBoundaries-*     geoBoundaries gbOpen BGD ADM0/1/2, CC BY 4.0
  data/inputs/rivers.gpkg        HydroRIVERS v1.0 whole reaches (scripts/clip_hydrorivers.py)

Outputs:
  data/inputs/sites.geojson      waste sources in the README site schema (+ display fields)
  data/inputs/pois.geojson       schools, hospitals, drinking water, water wells (poi_type)
  data/inputs/reach_names.csv    HYRIV_ID -> nearest named OSM river (display only)
  web/static/data/*.geojson      reference layers for the web map
"""
from pathlib import Path
import json
import re

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / ".cache/raw"
OSM = ROOT / ".cache/osm_raw.gpkg"
INP = ROOT / "data/inputs"
WEB = ROOT / "web/static/data"
METRIC = "EPSG:3106"  # Gulshan 303 / Bangladesh Transverse Mercator (metres)
SEV_SOURCE = ("ECR-1997 Sch.1 / ECR-2023 category inferred from OSM tags — "
              "data/severity_rubric.md v1")
TIER_SEV = {"T1": 1.0, "T2": 0.66, "T3": 0.33, "T4": 0.10}
TIER_LABEL = {"T1": "Red", "T2": "Orange-B", "T3": "Orange-A", "T4": "Green", "": "Unclassified"}

# Ordered keyword rules: (tier, label, regex over name/product/industrial/craft text)
RULES = [
    ("T1", "Ship breaking / recycling", r"ship\s*-?break|ship\s*recycl"),
    ("T1", "Tannery / leather", r"tanner|leather|\bhide|tanning"),
    ("T1", "Textile dyeing / washing / printing", r"\bdye|dyeing|dying|washing|wash\s*plant|denim|printing\s*(?:&|and)\s*dy|dy(?:e)?ing\s*(?:&|and)\s*print|screen\s*print|composite|knit\s*dye|fabric\s*process"),
    ("T1", "Chemical", r"chemical|acid|caustic|chlor"),
    ("T1", "Fertiliser", r"fertili[sz]er|\burea\b|\bTSP\b|ammonia"),
    ("T1", "Pesticide", r"pesticide|insecticide|agro\s*chem"),
    ("T1", "Pharmaceutical", r"pharma|drug|laborator(?:y|ies)\s*ltd|medicine\s*fact"),
    ("T1", "Pulp & paper", r"paper|pulp|board\s*mill|newsprint"),
    ("T1", "Sugar / distillery", r"sugar\s*mill|distill"),
    ("T1", "Oil refinery / petroleum", r"refiner|petroleum|lubricant|bitumen"),
    ("T1", "Cement", r"cement|clinker"),
    ("T1", "Steel / metal / foundry", r"steel|\biron\b|re-?rolling|rolling\s*mill|foundry|metal|galvani|alumin"),
    ("T1", "Battery", r"batter(?:y|ies)|accumulator"),
    ("T1", "Rubber / tyre", r"rubber|tyre|tire\b"),
    ("T1", "Paint / coating", r"\bpaint|coating|varnish|ink\s*fact"),
    ("T1", "Electroplating", r"electroplat|plating"),
    ("T2", "Food / beverage / agro-processing", r"food|fish|seafood|shrimp|dairy|milk|beverage|drink|feed|poultry|rice\s*mill|auto\s*rice|flour|edible\s*oil|oil\s*mill|bakery|biscuit|confection|salt"),
    ("T3", "Furniture / wood", r"saw\s*mill|furniture|timber"),
    ("T2", "Textile / spinning / jute", r"textile|spinning|jute|yarn|weaving|fabrics?\b"),
    ("T2", "Soap / detergent / cosmetics", r"soap|detergent|cosmetic"),
    ("T2", "Plastic / PVC", r"plastic|pvc|polymer|poly\s*bag|melamine"),
    ("T2", "Glass / ceramic", r"glass|ceramic|tiles?\b|sanitary"),
    ("T2", "Brick kiln", r"brick"),
    ("T2", "Shipyard / dockyard", r"shipyard|dockyard|dock\s*yard|ship\s*build"),
    ("T2", "Ice / cold storage", r"ice\s*(?:plant|factory|mill)|cold\s*stor"),
    ("T3", "Garments / apparel (dry)", r"garment|apparel|knit|sweater|fashion|\brmg\b|cloth|wear\b|wears\b|denim\s*(?:fashion)|tex\b"),
    ("T3", "Packaging / printing press", r"packag|carton|printing\s*press|press\b|label|accessor"),
    ("T3", "Furniture / wood", r"furniture|wood|timber|saw\s*mill"),
    ("T3", "Electronics / assembly", r"electronic|electric|assembl|cable|motor"),
    ("T4", "Warehouse / storage", r"warehouse|storage|depot|godown"),
]
INDUSTRIAL_TAG_RULES = {  # OSM industrial=* values
    "brickworks": ("T2", "Brick kiln"), "shipyard": ("T2", "Shipyard / dockyard"),
    "ship_breaking": ("T1", "Ship breaking / recycling"), "tannery": ("T1", "Tannery / leather"),
    "chemical": ("T1", "Chemical"), "refinery": ("T1", "Oil refinery / petroleum"),
    "steelmaking": ("T1", "Steel / metal / foundry"), "cement": ("T1", "Cement"),
    "fertilizer": ("T1", "Fertiliser"), "textile": ("T2", "Textile / spinning / jute"),
    "food_industry": ("T2", "Food / beverage / agro-processing"), "sawmill": ("T3", "Furniture / wood"),
    "warehouse": ("T4", "Warehouse / storage"), "depot": ("T4", "Warehouse / storage"),
    "slaughterhouse": ("T1", "Slaughterhouse"), "paper": ("T1", "Pulp & paper"),
}
COMPILED = [(t, l, re.compile(rx, re.I)) for t, l, rx in RULES]
KIND_PREFIX = {"industrial": "IND", "industrial_area": "IZ", "landfill": "LF",
               "waste_transfer": "WT", "wastewater_plant": "WW"}
CATEGORY = {"industrial": "industrial", "industrial_area": "industrial",
            "landfill": "landfill", "waste_transfer": "landfill", "wastewater_plant": "wastewater"}


def classify(r):
    kind = r["kind"]
    if kind == "landfill":
        return "T1", "Landfill / dumping ground"
    if kind == "wastewater_plant":
        return "T1", "Wastewater / sewage treatment plant"
    if kind == "waste_transfer":
        return "T2", "Waste transfer station"
    ind = str(r.get("industrial") or "").lower()
    if ind in INDUSTRIAL_TAG_RULES:
        return INDUSTRIAL_TAG_RULES[ind]
    if str(r.get("craft") or "").lower() == "tannery":
        return "T1", "Tannery / leather"
    if str(r.get("craft") or "").lower() == "dyer":
        return "T1", "Textile dyeing / washing / printing"
    text = " ".join(str(r.get(k) or "") for k in ("name", "name_en", "product", "industrial",
                                                     "operator", "description"))
    for tier, label, rx in COMPILED:
        if rx.search(text):
            return tier, label
    return "", "Industrial (type not stated)" if kind == "industrial" else "Industrial zone"


def river_label(n):
    n = re.sub(r"\s+", " ", str(n or "")).strip()
    if not n:
        return ""
    n = re.sub(r"\briver\b", "River", n, flags=re.I)
    if n.lower().startswith("river "):
        n = n[6:] + " River"
    if not re.search(r"River|nadi|nodi|canal|khal|নদী|চ্যানেল|Channel|Gang", n, re.I):
        n += " River"
    return n


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    adm0 = gpd.read_file(RAW / "geoBoundaries-BGD-ADM0.geojson").to_crs(4326)
    adm1 = gpd.read_file(RAW / "geoBoundaries-BGD-ADM1.geojson").to_crs(4326)[["shapeName", "geometry"]]
    adm2 = gpd.read_file(RAW / "geoBoundaries-BGD-ADM2.geojson").to_crs(4326)[["shapeName", "geometry"]]
    bd = adm0.to_crs(METRIC).buffer(2000).to_crs(4326).union_all()  # 2 km tolerance at the border

    # ---------------- waste sources ----------------
    src = pyogrio.read_dataframe(OSM, layer="sources")
    src = src[src.geometry.notna() & ~src.geometry.is_empty]
    m = src.to_crs(METRIC)
    src["area_ha"] = np.where(m.geom_type.isin(["Polygon", "MultiPolygon"]), m.area / 1e4, 0.0)
    # Drop node duplicates that sit inside a mapped footprint of the same kind.
    polys = src[src.area_ha > 0]
    nodes = src[src.area_ha == 0]
    if len(nodes) and len(polys):
        hit = gpd.sjoin(nodes[["kind", "geometry"]], polys[["kind", "geometry"]],
                        predicate="within", how="inner")
        dup = hit.index[hit.kind_left == hit.kind_right].unique()
        nodes = nodes.drop(index=dup)
    src = pd.concat([polys, nodes])
    # Unnamed industrial zones < 2 ha are too small/ambiguous to screen as zones.
    src = src[~((src.kind == "industrial_area") & (src.area_ha < 2) & (src.name.fillna("") == ""))]
    footprints = src[src.area_ha > 0].copy()
    pts = src.copy()
    pts["geometry"] = pts.to_crs(METRIC).representative_point().to_crs(4326).values
    pts = pts[pts.within(bd)]

    tiers = pts.apply(classify, axis=1, result_type="expand")
    pts["hazard_tier"], pts["industry_type"] = tiers[0], tiers[1]
    pts["site_id"] = [f"{KIND_PREFIX[k]}-{t[0]}{i}" for k, t, i in zip(pts.kind, pts.osm_type, pts.osm_id)]
    pts = pts.drop_duplicates("site_id")
    pts["category"] = pts.kind.map(CATEGORY)
    label = {"industrial": "Unnamed works", "industrial_area": "Unnamed industrial zone",
             "landfill": "Unnamed landfill / dump", "waste_transfer": "Unnamed waste transfer station",
             "wastewater_plant": "Unnamed wastewater plant"}
    nm = pts.name_en.where(pts.name_en.fillna("") != "", pts.name)
    pts["name"] = nm.where(nm.fillna("") != "", pts.kind.map(label))
    pts["role"] = "site"
    pts["severity"] = pts.hazard_tier.map(TIER_SEV)
    pts["severity_source"] = np.where(pts.severity.notna(), SEV_SOURCE, "")
    pts["hazard_label"] = pts.hazard_tier.map(TIER_LABEL)
    pts["outfall_confirmed"] = False
    pts["outfall_source"] = ""
    pts["flow_reviewed"] = False
    pts["receiving_reach_id"] = ""
    pts["discharge_m3d"] = None
    pts["osm_url"] = [f"https://www.openstreetmap.org/{t}/{i}" for t, i in zip(pts.osm_type, pts.osm_id)]
    pts = gpd.sjoin(pts, adm1.rename(columns={"shapeName": "division"}), how="left", predicate="within").drop(columns="index_right")
    pts = gpd.sjoin(pts, adm2.rename(columns={"shapeName": "district"}), how="left", predicate="within").drop(columns="index_right")
    pts = pts.drop_duplicates("site_id")
    pts["division"] = pts.division.fillna("").str.replace(" Division", "", regex=False)
    pts["district"] = pts.district.fillna("")
    cols = ["site_id", "name", "industry_type", "role", "category", "kind", "hazard_tier",
            "hazard_label", "severity", "severity_source", "outfall_confirmed", "outfall_source",
            "flow_reviewed", "receiving_reach_id", "discharge_m3d", "area_ha", "operator",
            "product", "division", "district", "osm_url", "geometry"]
    sites = pts[cols].sort_values("site_id").reset_index(drop=True)
    sites["area_ha"] = sites.area_ha.round(2)
    out = INP / "sites.geojson"
    out.unlink(missing_ok=True)
    sites.to_file(out, driver="GeoJSON", index=False)
    print(f"sites: {len(sites)}", sites.category.value_counts().to_dict(),
          sites.hazard_tier.replace("", "none").value_counts().to_dict())

    # Footprints for the map (landfills, wastewater plants, industrial zones >= 5 ha).
    fp = footprints[(footprints.kind.isin(["landfill", "wastewater_plant", "waste_transfer"]))
                    | ((footprints.kind == "industrial_area") & (footprints.area_ha >= 5))
                    | ((footprints.kind == "industrial") & (footprints.area_ha >= 3))].copy()
    fp = fp[fp.intersects(bd)]
    fp["site_id"] = [f"{KIND_PREFIX[k]}-{t[0]}{i}" for k, t, i in zip(fp.kind, fp.osm_type, fp.osm_id)]
    fp["geometry"] = fp.to_crs(METRIC).simplify(8).to_crs(4326).values
    fp[["site_id", "kind", "name", "area_ha", "geometry"]].assign(area_ha=lambda d: d.area_ha.round(1)) \
        .to_file(WEB / "footprints.geojson", driver="GeoJSON", index=False)
    print("footprints", len(fp))

    # ---------------- receptors (POIs) ----------------
    pois = pyogrio.read_dataframe(OSM, layer="pois")
    pois = pois[pois.within(bd)]
    pois["poi_type"] = pois.kind
    pois["osm_id"] = pois.osm_type + "/" + pois.osm_id.astype(str)
    out = INP / "pois.geojson"
    out.unlink(missing_ok=True)
    pois[["poi_type", "osm_id", "name", "geometry"]].to_file(out, driver="GeoJSON", index=False)
    print("pois", len(pois), pois.poi_type.value_counts().to_dict())

    # ---------------- rivers & water bodies ----------------
    ro = pyogrio.read_dataframe(OSM, layer="rivers_osm")
    if "river_relations" in {l[0] for l in pyogrio.list_layers(OSM)}:
        ro = pd.concat([ro, pyogrio.read_dataframe(OSM, layer="river_relations")], ignore_index=True)
    ro["rname"] = ro.name_en.where(ro.name_en.fillna("") != "", ro.name).map(river_label)
    ro = ro[ro.rname.fillna("") != ""].to_crs(METRIC)
    ro_d = ro.dissolve("rname", as_index=False)
    ro_d["length_km"] = ro_d.length / 1000
    major = ro_d[ro_d.length_km >= 15].copy()
    major["geometry"] = major.simplify(40)
    major[["rname", "length_km", "geometry"]].rename(columns={"rname": "name"}) \
        .assign(length_km=lambda d: d.length_km.round(1)).to_crs(4326) \
        .to_file(WEB / "osm_rivers.geojson", driver="GeoJSON", index=False)
    print("named OSM rivers >=15 km:", len(major))

    hr = pyogrio.read_dataframe(INP / "rivers.gpkg").to_crs(METRIC)
    mid = hr.copy()
    mid["geometry"] = hr.interpolate(0.5, normalized=True)
    near = gpd.sjoin_nearest(mid[["HYRIV_ID", "geometry"]], ro[["rname", "geometry"]],
                             how="left", max_distance=1200, distance_col="d")
    near = near.sort_values("d").drop_duplicates("HYRIV_ID")
    near[["HYRIV_ID", "rname", "d"]].rename(columns={"rname": "river_name", "d": "name_match_m"}) \
        .dropna(subset=["river_name"]).round({"name_match_m": 0}) \
        .to_csv(INP / "reach_names.csv", index=False)
    names = near.set_index("HYRIV_ID").rname
    disp = hr[(hr.DIS_AV_CMS >= 8) | (hr.ORD_CLAS <= 3)].copy()
    disp = disp[disp.intersects(gpd.GeoSeries([bd], crs=4326).to_crs(METRIC).iloc[0].buffer(20000))]
    disp["river_name"] = disp.HYRIV_ID.map(names).fillna("")
    disp["geometry"] = disp.simplify(60)
    disp[["HYRIV_ID", "NEXT_DOWN", "DIS_AV_CMS", "ORD_CLAS", "ORD_STRA", "river_name", "geometry"]] \
        .assign(DIS_AV_CMS=lambda d: d.DIS_AV_CMS.round(1)).to_crs(4326) \
        .to_file(WEB / "rivers_display.geojson", driver="GeoJSON", index=False, COORDINATE_PRECISION=5)
    print("display reaches", len(disp))

    wa = pyogrio.read_dataframe(OSM, layer="water").to_crs(METRIC)
    wa["area_km2"] = wa.area / 1e6
    wa = wa[wa.area_km2 >= 0.5].copy()
    wa["wname"] = wa.name_en.where(wa.name_en.fillna("") != "", wa.name)
    wa["geometry"] = wa.simplify(25)
    wa = wa.to_crs(4326)
    wa = wa[wa.intersects(bd)]
    wa[["wname", "water", "natural", "area_km2", "geometry"]].rename(columns={"wname": "name"}) \
        .assign(area_km2=lambda d: d.area_km2.round(2)) \
        .to_file(WEB / "water_bodies.geojson", driver="GeoJSON", index=False, COORDINATE_PRECISION=5)
    print("named water bodies >=0.5 km2:", len(wa))

    a1 = adm1.copy()
    a1["shapeName"] = a1.shapeName.str.replace(" Division", "", regex=False)
    a1.rename(columns={"shapeName": "name"}).to_file(WEB / "divisions.geojson", driver="GeoJSON", index=False)
    adm2.rename(columns={"shapeName": "name"}).assign(
        geometry=lambda d: d.to_crs(METRIC).simplify(150).to_crs(4326)
    ).to_file(WEB / "districts.geojson", driver="GeoJSON", index=False, COORDINATE_PRECISION=4)
    for f in sorted(WEB.glob("*.geojson")):
        print(f.name, f"{f.stat().st_size/1e6:.2f} MB")


if __name__ == "__main__":
    main()
