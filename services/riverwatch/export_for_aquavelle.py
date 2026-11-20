"""Export RiverWatch BD results into one compact file the Aquavelle web app reads.

Run from the RiverWatch folder:  python export_for_aquavelle.py ../../web/public/data/riverwatch-sources.json
It uses RiverWatch's own API code (webapp/main.py), so numbers match its map exactly.
"""
import json, sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi.testclient import TestClient  # noqa: E402
import pandas as pd  # noqa: E402
import webapp.main as rw  # noqa: E402

out = Path(sys.argv[1] if len(sys.argv) > 1 else "riverwatch-sources.json")
c = TestClient(rw.app)
s = c.get("/api/runs/national/summary").json()
feats = c.get("/api/runs/national/sites").json()["features"]
q = pd.read_csv(Path(__file__).resolve().parent / "runs/national/review_queue.csv").set_index("site_id")
tier = {}
for f in c.get("/api/runs/national/export/sites.geojson").json().get("features", []):
    p = f["properties"]; tier[p.get("site_id")] = p.get("hazard_label") or ""

def num(v, nd=0):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), nd)

rows = []
for f in feats:
    p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
    r = q.loc[p["id"]] if p["id"] in q.index else None
    rows.append([round(lon, 5), round(lat, 5), p["n"], p["c"], tier.get(p["id"], ""), p["ds"], p["rn"],
                 num(p["pop"]), 1 if p["cr"] else 0, 1 if p["rid"] else 0, num(p["sd"]),
                 int(r["school"] or 0) if r is not None and r["school"] == r["school"] else 0,
                 int(r["hospital"] or 0) if r is not None and r["hospital"] == r["hospital"] else 0,
                 int((r["drinking_water"] or 0) + (r["water_well"] or 0)) if r is not None and r["drinking_water"] == r["drinking_water"] else 0,
                 p["act"], p["it"]])
cor = c.get("/api/runs/national/critical-corridors").json()
lines = []
for f in cor.get("features", []):
    g = f["geometry"]
    parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
    for ln in parts:
        lines.append([[round(x, 4), round(y, 4)] for x, y in ln])
data = {
    "meta": {"run": s["run"]["title"], "period": s["run"]["period"], "created": s["run"]["created_utc"][:10],
             "counts": s["counts"], "by_category": s["by_category"], "critical_by_division": s["critical_by_division"],
             "critical_rule": "Red-tier potential hazard within 500 m of a river reach with a modelled downstream route",
             "source": "RiverWatch BD: OpenStreetMap (ODbL), HydroRIVERS v1.0, WorldPop 2020 (CC BY 4.0), geoBoundaries"},
    "fields": ["lon", "lat", "name", "category", "tier", "district", "river", "people_500m", "critical", "linked",
               "distance_to_river_m", "schools", "hospitals", "drinking_points", "action", "type"],
    "sites": rows,
    "rivers": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()} for r in s["rivers"][:40]],
    "critical_corridors": lines,
}
out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size/1e6:.2f} MB): {len(rows)} sources, {sum(r[8] for r in rows)} critical, {len(lines)} corridor lines")
