"""RiverWatch BD — web GIS server.

Serves the map UI and a JSON API over completed RiverWatch runs (runs/<id>/).
It also offers an analyst review workflow: reviews are stored in data/reviews/<run>.json,
and a token-protected re-run applies them to the site inputs and re-executes the
pipeline, exactly as README section 3 describes ("Save your corrections to the input
layer and rerun").

Environment:
  RIVERWATCH_ADMIN_TOKEN   enables review edits and re-runs (sent as X-Admin-Token)
  RIVERWATCH_ROOT          project root (defaults to the repository root)
"""
from __future__ import annotations

import io
import json
import math
import os
import shutil
import subprocess
import sys
import threading
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from shapely.geometry import mapping

ROOT = Path(os.environ.get("RIVERWATCH_ROOT", Path(__file__).resolve().parents[1]))
STATIC = ROOT / "web/static"
REVIEWS = ROOT / "data/reviews"
REGISTRY = ROOT / "runs/runs.json"
ADMIN_TOKEN = os.environ.get("RIVERWATCH_ADMIN_TOKEN", "").strip()
CRITICAL_SNAP_M = float(os.environ.get("RIVERWATCH_CRITICAL_SNAP_M", 500))
DOWNLOADABLE = {"review_queue.csv", "riverwatch.gpkg", "samples_gee.csv",
                "paired_observations.csv", "manifest.json"}
STOP_TEXT = {
    "distance_limit": "Route followed for the full corridor length",
    "network_end": "Route reached the end of the encoded network (sea/outlet)",
    "network_clipped": "Network extract clipped — expand the HydroRIVERS extraction",
    "junction_gap_or_unresolved": "Junction gap or unresolved flow — check topology",
    "unresolved_flow": "Flow direction unresolved on the receiving reach",
    "cycle": "Cycle in network topology",
    "unlinked": "No river reach within the snap distance",
}


def clean(v):
    """JSON-safe scalar."""
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if not math.isfinite(float(v)) else float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if pd.isna(v) if not isinstance(v, (list, dict, str)) else False:
        return None
    return v


def as_bool(v):
    return str(v).strip().lower() in {"true", "1", "yes", "1.0"}


def fc(features):
    return {"type": "FeatureCollection", "features": features}


class Run:
    """In-memory view of one completed run folder."""

    def __init__(self, spec: dict):
        self.spec = spec
        self.id = spec["id"]
        self.out = ROOT / spec["out"]
        self.lock = threading.RLock()
        self.job = {"state": "idle"}
        self.load()

    # ------------------------------------------------------------------ loading
    def load(self):
        t0 = time.time()
        out = self.out
        self.manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
        q = pd.read_csv(out / "review_queue.csv", dtype={"site_id": str}, keep_default_na=False)
        for c in ["rank", "reach_id", "snap_distance_m", "pop_near", "score_low", "score_high",
                  "review_score", "optical_score", "severity_score", "population_score",
                  "poi_score", "median_delta", "n_clear_dates", "component_coverage",
                  "school", "hospital", "drinking_water", "water_well", "discharge_m3d",
                  "valid_pop_cells", "zone_cells_in_raster"]:
            if c in q:
                q[c] = pd.to_numeric(q[c].replace("", np.nan), errors="coerce")
        attrs = gpd.read_file(ROOT / self.spec["sites"])
        attrs["lon"], attrs["lat"] = attrs.geometry.x, attrs.geometry.y
        attrs = pd.DataFrame(attrs.drop(columns="geometry"))
        extra = [c for c in attrs.columns if c not in q.columns or c == "site_id"]
        q = q.merge(attrs[extra], on="site_id", how="left")

        rivers = pyogrio.read_dataframe(ROOT / self.spec["rivers"], read_geometry=False,
                                        columns=["HYRIV_ID", "DIS_AV_CMS", "ORD_CLAS"])
        names_p = ROOT / "data/inputs/reach_names.csv"
        names = pd.read_csv(names_p) if names_p.is_file() else pd.DataFrame(columns=["HYRIV_ID", "river_name"])
        rv = rivers.merge(names[["HYRIV_ID", "river_name"]], on="HYRIV_ID", how="left")
        q = q.merge(rv.rename(columns={"HYRIV_ID": "reach_id", "DIS_AV_CMS": "reach_discharge_cms",
                                       "ORD_CLAS": "reach_order"}), on="reach_id", how="left")
        q["river_name"] = q["river_name"].fillna("")
        q["severity"] = pd.to_numeric(q.get("severity"), errors="coerce")
        q["is_reference"] = q.role.eq("reference")
        q["linked"] = q.snap_method.isin(["nearest", "nearest_ambiguous", "manual"])
        q["critical"] = (~q.is_reference & q.linked & q.snap_distance_m.le(CRITICAL_SNAP_M)
                         & q.severity.ge(0.99) & q.corridor_stop.ne("unlinked"))
        self.queue = q.set_index("site_id", drop=False)

        gpkg = out / "riverwatch.gpkg"
        layers = {r[0] for r in pyogrio.list_layers(gpkg)}

        def layer(name):
            return pyogrio.read_dataframe(gpkg, layer=name) if name in layers else None

        self.crs = self.manifest["config"]["crs"]
        self.corridors = layer("corridors")
        self.zones = layer("proximity_zones")
        self.links = layer("links")
        self.samples = layer("sampling_points")
        self.union = layer("portfolio_union")
        self.pois = layer("mapped_pois")
        if self.pois is not None:
            self.pois_sindex = self.pois.sindex
        pp = out / "paired_observations.csv"
        self.pairs = pd.read_csv(pp, dtype={"site_id": str, "pair_id": str}) if pp.is_file() else pd.DataFrame()
        self._cache = {}
        self.loaded_at = datetime.now(timezone.utc).isoformat()
        print(f"[riverwatch] loaded run {self.id}: {len(q)} sites in {time.time() - t0:.1f}s", flush=True)

    # ------------------------------------------------------------------ outputs
    def cached(self, key, fn):
        if key not in self._cache:
            self._cache[key] = fn()
        return self._cache[key]

    def site_props(self, r) -> dict:
        return {
            "id": r.site_id, "n": r["name"], "c": r.get("category") or ("reference" if r.is_reference else ""),
            "k": r.get("kind") or "", "t": r.get("hazard_tier") or "", "it": r.get("industry_type") or "",
            "dv": r.get("division") or "", "ds": r.get("district") or "",
            "rid": clean(r.reach_id), "rn": r.river_name, "sd": clean(round(r.snap_distance_m, 1)) if pd.notna(r.snap_distance_m) else None,
            "cs": r.corridor_stop, "pop": clean(round(r.pop_near)) if pd.notna(r.pop_near) else None,
            "lo": clean(r.score_low), "hi": clean(r.score_high), "rk": clean(r["rank"]),
            "act": r.action, "cr": bool(r.critical), "ref": bool(r.is_reference),
            "lr": as_bool(r.link_reviewed), "nd": clean(r.n_clear_dates), "md": clean(r.median_delta),
            "sev": clean(r.severity),
        }

    def sites_geojson(self):
        def build():
            feats = []
            for _, r in self.queue.iterrows():
                if pd.isna(r.lon):
                    continue
                feats.append({"type": "Feature", "properties": self.site_props(r),
                              "geometry": {"type": "Point", "coordinates": [round(r.lon, 6), round(r.lat, 6)]}})
            return json.dumps(fc(feats), separators=(",", ":"))
        return self.cached("sites", build)

    def critical_corridors(self):
        def build():
            if self.corridors is None or self.corridors.empty:
                return json.dumps(fc([]))
            crit = set(self.queue.index[self.queue.critical])
            c = self.corridors[self.corridors.site_id.isin(crit)].copy()
            c["geometry"] = c.simplify(15)
            c = c.to_crs(4326)
            feats = [{"type": "Feature", "geometry": mapping(g),
                      "properties": {"site_id": s, "ri": round(float(ri), 3), "km": round(float(a), 2)}}
                     for s, ri, a, g in zip(c.site_id, c.relative_index, c.start_km, c.geometry)]
            return json.dumps(fc(feats), separators=(",", ":"))
        return self.cached("critical", build)

    def union_geojson(self):
        def build():
            if self.union is None or self.union.empty:
                return json.dumps(fc([]))
            u = self.union.copy()
            u["geometry"] = u.simplify(40).buffer(0)
            u = u.to_crs(4326)
            return json.dumps(fc([{"type": "Feature", "geometry": mapping(u.geometry.iloc[0]),
                                   "properties": {"pop_near": clean(u.pop_near.iloc[0])}}]),
                              separators=(",", ":"))
        return self.cached("union", build)

    def stats(self):
        def build():
            q = self.queue
            s = q[~q.is_reference]
            by_cat = s.groupby("category").size().to_dict() if "category" in s else {}
            tiers = s.hazard_tier.fillna("").replace("", "none").value_counts().to_dict()
            tier_cat = (s.assign(t=s.hazard_tier.fillna("").replace("", "none"))
                        .groupby(["t", "category"]).size().unstack(fill_value=0))
            crit = s[s.critical]
            rivers = (s[s.linked & s.river_name.ne("")]
                      .groupby("river_name")
                      .agg(sources=("site_id", "size"), critical=("critical", "sum"),
                           red=("severity", lambda v: int((v >= 0.99).sum())),
                           pop_max=("pop_near", "max"),
                           lon=("lon", "mean"), lat=("lat", "mean"),
                           minlon=("lon", "min"), minlat=("lat", "min"),
                           maxlon=("lon", "max"), maxlat=("lat", "max"))
                      .sort_values(["critical", "sources"], ascending=False).reset_index())
            unlinked_reasons = s.loc[~s.linked, "snap_method"].value_counts().to_dict()
            stops = s.corridor_stop.value_counts().to_dict()
            m = self.manifest
            return {
                "run": {"id": self.id, "title": self.spec.get("title"), "description": self.spec.get("description", ""),
                        "period": self.spec.get("period", ""), "mode": m.get("mode"),
                        "created_utc": m.get("created_utc"), "loaded_at": self.loaded_at},
                "config": m.get("config"),
                "counts": {
                    "sites": int(len(s)), "references": int(q.is_reference.sum()),
                    "linked": int(s.linked.sum()), "critical": int(len(crit)),
                    "ranked": int(m.get("ranked_count", 0)),
                    "link_reviewed": int(s.link_reviewed.map(as_bool).sum()),
                    "with_optical": int((s.n_clear_dates > 0).sum()),
                    "optical_scored": int(s.optical_score.notna().sum()),
                },
                "by_category": {k: int(v) for k, v in by_cat.items()},
                "by_tier": {k: int(v) for k, v in tiers.items()},
                "tier_category": {t: {c: int(v) for c, v in row.items()} for t, row in tier_cat.iterrows()},
                "critical_by_division": {k or "Unknown": int(v) for k, v in crit.division.fillna("").value_counts().items()},
                "critical_by_category": {k: int(v) for k, v in crit.category.value_counts().items()},
                "rivers": [{k: clean(v) for k, v in r.items()} for r in rivers.head(60).to_dict("records")],
                "union_population": m.get("union_population"),
                "union_zone_count": m.get("union_zone_count"),
                "union_mapped_amenities": m.get("union_mapped_amenities"),
                "observation_qa": m.get("observation_qa"),
                "unlinked_reasons": {k: int(v) for k, v in unlinked_reasons.items()},
                "corridor_stops": {k: int(v) for k, v in stops.items()},
                "critical_rule": f"Red-tier potential hazard (severity ≥ 0.99) AND snapped ≤ {CRITICAL_SNAP_M:.0f} m to a HydroRIVERS reach with a modelled downstream route",
            }
        return self.cached("stats", build)

    def detail(self, sid: str, reviews: dict):
        if sid not in self.queue.index:
            raise HTTPException(404, f"Unknown site {sid}")
        r = self.queue.loc[sid]
        props = {k: clean(v) for k, v in r.items()}
        props["corridor_stop_text"] = STOP_TEXT.get(r.corridor_stop, r.corridor_stop)
        geo = {}

        def sel(g, simplify=0):
            if g is None or g.empty:
                return None
            x = g[g.site_id.eq(sid)]
            if x.empty:
                return None
            x = x.copy()
            if simplify:
                x["geometry"] = x.simplify(simplify)
            x = x.to_crs(4326)
            cols = [c for c in x.columns if c != "geometry"]
            return fc([{"type": "Feature", "geometry": mapping(gm),
                        "properties": {c: clean(v) for c, v in zip(cols, vals)}}
                       for gm, *vals in zip(x.geometry, *[x[c] for c in cols])])

        geo["corridor"] = sel(self.corridors, 2)
        geo["zone"] = sel(self.zones, 10)
        geo["link"] = sel(self.links)
        geo["samples"] = sel(self.samples)
        pois = []
        if self.pois is not None and self.zones is not None:
            z = self.zones[self.zones.site_id.eq(sid)]
            if not z.empty:
                ix = self.pois_sindex.query(z.geometry.iloc[0], predicate="intersects")
                p = self.pois.iloc[ix[:400]].to_crs(4326)
                pois = [{"t": t, "lon": round(g.x, 6), "lat": round(g.y, 6)} for t, g in zip(p.poi_type, p.geometry)]
        pairs = []
        if not self.pairs.empty:
            p = self.pairs[self.pairs.site_id.eq(sid)].sort_values("date")
            pairs = [{k: clean(v) for k, v in row.items()} for row in p.to_dict("records")]
        corridor_km = None
        if self.corridors is not None and not self.corridors.empty:
            c = self.corridors[self.corridors.site_id.eq(sid)]
            corridor_km = round(float(c.end_km.max()), 2) if not c.empty else 0.0
        props["corridor_km"] = corridor_km
        return {"properties": props, "geo": geo, "pois": pois, "pairs": pairs,
                "review": reviews.get(sid), "weights": self.manifest["config"]["weights"],
                "min_pairs": self.manifest["config"]["min_pairs"]}


# ====================================================================== registry
def load_registry():
    specs = json.loads(REGISTRY.read_text(encoding="utf-8"))
    runs = {}
    for spec in specs:
        if (ROOT / spec["out"] / "manifest.json").is_file():
            runs[spec["id"]] = Run(spec)
        else:
            print(f"[riverwatch] skip run {spec['id']}: no manifest in {spec['out']}", flush=True)
    return specs, runs


SPECS, RUNS = load_registry()
app = FastAPI(title="RiverWatch BD", version="1.0.0",
              description="GIS screening of industrial, landfill and wastewater sources near Bangladesh rivers.")
app.add_middleware(GZipMiddleware, minimum_size=1024)


def get_run(rid: str) -> Run:
    if rid not in RUNS:
        raise HTTPException(404, f"Unknown run {rid}")
    return RUNS[rid]


def reviews_path(rid):
    return REVIEWS / f"{rid}.json"


def read_reviews(rid) -> dict:
    p = reviews_path(rid)
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}


def require_admin(token: str | None):
    if not ADMIN_TOKEN:
        raise HTTPException(403, "Review editing is disabled on this server (RIVERWATCH_ADMIN_TOKEN not set).")
    if (token or "").strip() != ADMIN_TOKEN:
        raise HTTPException(401, "Invalid or missing admin token.")


def raw_json(text: str):
    return Response(text, media_type="application/json")


@app.get("/api/health")
def health():
    return {"ok": True, "runs": list(RUNS), "review_enabled": bool(ADMIN_TOKEN)}


@app.get("/api/runs")
def runs():
    out = []
    for spec in SPECS:
        r = RUNS.get(spec["id"])
        if not r:
            continue
        s = r.stats()
        out.append({"id": r.id, "title": spec.get("title"), "description": spec.get("description", ""),
                    "period": spec.get("period", ""), "sites": s["counts"]["sites"],
                    "critical": s["counts"]["critical"], "mode": r.manifest.get("mode"),
                    "created_utc": r.manifest.get("created_utc"), "default": spec.get("default", False)})
    return {"runs": out, "review_enabled": bool(ADMIN_TOKEN), "critical_snap_m": CRITICAL_SNAP_M}


@app.get("/api/runs/{rid}/summary")
def summary(rid: str):
    r = get_run(rid)
    s = dict(r.stats())
    s["reviews"] = len(read_reviews(rid))
    s["job"] = r.job
    return s


@app.get("/api/runs/{rid}/sites")
def sites(rid: str):
    return raw_json(get_run(rid).sites_geojson())


@app.get("/api/runs/{rid}/critical-corridors")
def critical_corridors(rid: str):
    return raw_json(get_run(rid).critical_corridors())


@app.get("/api/runs/{rid}/union")
def union(rid: str):
    return raw_json(get_run(rid).union_geojson())


@app.get("/api/runs/{rid}/sites/{sid}")
def site_detail(rid: str, sid: str):
    return get_run(rid).detail(sid, read_reviews(rid))


@app.get("/api/runs/{rid}/download/{name}")
def download(rid: str, name: str):
    r = get_run(rid)
    if name not in DOWNLOADABLE or not (r.out / name).is_file():
        raise HTTPException(404, "Not available")
    return FileResponse(r.out / name, filename=f"{rid}_{name}")


@app.get("/api/runs/{rid}/export/sites.geojson")
def export_sites(rid: str):
    r = get_run(rid)
    q = r.queue.drop(columns=[c for c in ("lon", "lat") if c not in r.queue]).reset_index(drop=True)
    g = gpd.GeoDataFrame(q, geometry=gpd.points_from_xy(q.lon, q.lat), crs=4326)
    return Response(g.to_json(drop_id=True), media_type="application/geo+json",
                    headers={"Content-Disposition": f'attachment; filename="{rid}_sites.geojson"'})


@app.get("/api/sources")
def sources():
    return json.loads((ROOT / "data/sources.json").read_text(encoding="utf-8"))


# ====================================================================== review workflow
class Review(BaseModel):
    outfall_confirmed: bool = False
    outfall_source: str = Field("", max_length=500)
    flow_reviewed: bool = False
    receiving_reach_id: str = Field("", max_length=20)
    outfall_lon: float | None = None
    outfall_lat: float | None = None
    severity: float | None = Field(None, ge=0, le=1)
    severity_source: str = Field("", max_length=500)
    notes: str = Field("", max_length=4000)
    reviewer: str = Field("", max_length=120)


@app.get("/api/runs/{rid}/reviews")
def list_reviews(rid: str):
    get_run(rid)
    return read_reviews(rid)


@app.post("/api/runs/{rid}/sites/{sid}/review")
def save_review(rid: str, sid: str, body: Review, x_admin_token: str | None = Header(None)):
    require_admin(x_admin_token)
    r = get_run(rid)
    if sid not in r.queue.index:
        raise HTTPException(404, "Unknown site")
    if body.outfall_confirmed and not body.outfall_source.strip():
        raise HTTPException(422, "A confirmed outfall needs an outfall_source citation (README: outfall_source).")
    if body.severity is not None and not body.severity_source.strip():
        raise HTTPException(422, "A severity value needs a severity_source citation.")
    if body.receiving_reach_id.strip() and not body.receiving_reach_id.strip().isdigit():
        raise HTTPException(422, "receiving_reach_id must be a HydroRIVERS HYRIV_ID (integer).")
    if (body.outfall_lon is None) != (body.outfall_lat is None):
        raise HTTPException(422, "Give both outfall_lon and outfall_lat, or neither.")
    if body.outfall_lon is not None and not (87.5 <= body.outfall_lon <= 93.5 and 20.0 <= body.outfall_lat <= 27.0):
        raise HTTPException(422, "Outfall coordinates must be in Bangladesh (WGS84).")
    REVIEWS.mkdir(parents=True, exist_ok=True)
    with r.lock:
        data = read_reviews(rid)
        prev = data.get(sid)
        entry = body.model_dump()
        entry["saved_utc"] = datetime.now(timezone.utc).isoformat()
        entry["history"] = ((prev or {}).get("history", []) + ([{k: v for k, v in prev.items() if k != "history"}] if prev else []))[-20:]
        data[sid] = entry
        tmp = reviews_path(rid).with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(reviews_path(rid))
    return {"ok": True, "review": entry, "pending_rerun": True}


@app.delete("/api/runs/{rid}/sites/{sid}/review")
def delete_review(rid: str, sid: str, x_admin_token: str | None = Header(None)):
    require_admin(x_admin_token)
    r = get_run(rid)
    with r.lock:
        data = read_reviews(rid)
        data.pop(sid, None)
        reviews_path(rid).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True}


def build_reviewed_sites(r: Run, workdir: Path) -> Path:
    base = gpd.read_file(ROOT / r.spec["sites"])
    reviews = read_reviews(r.id)
    for sid, rv in reviews.items():
        m = base.site_id.eq(sid)
        if not m.any():
            continue
        base.loc[m, "outfall_confirmed"] = bool(rv.get("outfall_confirmed"))
        base.loc[m, "outfall_source"] = rv.get("outfall_source", "")
        base.loc[m, "flow_reviewed"] = bool(rv.get("flow_reviewed"))
        base.loc[m, "receiving_reach_id"] = str(rv.get("receiving_reach_id") or "")
        if rv.get("severity") is not None:
            base.loc[m, "severity"] = float(rv["severity"])
            base.loc[m, "severity_source"] = rv.get("severity_source", "")
        if rv.get("outfall_lon") is not None:
            from shapely.geometry import Point
            base.loc[m, "geometry"] = Point(rv["outfall_lon"], rv["outfall_lat"])
    path = REVIEWS / f"{r.id}_sites_reviewed.geojson"
    REVIEWS.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    base.to_file(path, driver="GeoJSON", index=False)
    return path


def rel(p) -> str:
    p = Path(p)
    try:
        return str(p.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        return str(p)


def pipeline_cmd(spec, sites_path: Path, out: Path, observations):
    cmd = [sys.executable, "-m", "riverwatch", "--sites", rel(sites_path),
           "--rivers", spec["rivers"], "--config", spec["config"], "--out", rel(out)]
    pop = ROOT / spec["population"] if spec.get("population") else None
    if pop and pop.is_file():
        cmd += ["--population", spec["population"]]
    if spec.get("pois"):
        cmd += ["--pois", spec["pois"]]
    if observations:
        cmd += ["--observations", *[rel(o) for o in observations]]
    return cmd


def rerun_job(r: Run, refresh_s2: bool):
    spec = r.spec
    log = []
    env = {**os.environ, "PYTHONWARNINGS": "ignore"}

    def step(label, cmd):
        r.job.update(step=label)
        log.append("$ " + " ".join(cmd))
        p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=env)
        log.append((p.stdout or "")[-4000:] + (p.stderr or "")[-4000:])
        if p.returncode != 0:
            raise RuntimeError(f"{label} failed:\n{p.stderr[-3000:]}")

    try:
        work = ROOT / "runs" / f"_work_{r.id}"
        shutil.rmtree(work, ignore_errors=True)
        work.mkdir(parents=True)
        sites_path = build_reviewed_sites(r, work)
        refreshed = ROOT / "data/observations" / f"{r.id}_refreshed.csv"
        observations = ([refreshed] if refreshed.is_file()
                        else [ROOT / o for o in spec.get("observations", [])])
        if refresh_s2 and spec.get("s2_period"):
            step("Geometry preparation run", pipeline_cmd(spec, sites_path, work / "prep", []))
            obs = work / "s2_refresh.csv"
            start, end = spec["s2_period"]
            step("Sentinel-2 paired observations (Earth Search)",
                 [sys.executable, "-m", "riverwatch.s2_stac", "--samples", str(work / "prep/samples_gee.csv"),
                  "--start", start, "--end", end, "--out", str(obs)])
            observations = [obs]
        step("RiverWatch pipeline", pipeline_cmd(spec, sites_path, work / "out", observations))
        with r.lock:
            backup = r.out.with_name(r.out.name + "_previous")
            shutil.rmtree(backup, ignore_errors=True)
            if r.out.exists():
                r.out.rename(backup)
            (work / "out").rename(r.out)
            if refresh_s2 and spec.get("s2_period"):
                keep = ROOT / "data/observations" / f"{r.id}_refreshed.csv"
                shutil.copy(work / "s2_refresh.csv", keep)
            r.load()
        shutil.rmtree(work, ignore_errors=True)
        r.job = {"state": "done", "finished_utc": datetime.now(timezone.utc).isoformat(), "log": log[-6:]}
    except Exception as exc:
        r.job = {"state": "failed", "error": str(exc), "log": log[-6:],
                 "trace": traceback.format_exc()[-2000:]}


@app.post("/api/runs/{rid}/rerun")
def rerun(rid: str, request: Request, refresh_s2: bool = False, x_admin_token: str | None = Header(None)):
    require_admin(x_admin_token)
    r = get_run(rid)
    if r.job.get("state") == "running":
        raise HTTPException(409, "A re-run is already in progress.")
    r.job = {"state": "running", "started_utc": datetime.now(timezone.utc).isoformat(), "step": "queued"}
    threading.Thread(target=rerun_job, args=(r, refresh_s2), daemon=True).start()
    return {"ok": True, "job": r.job}


@app.get("/api/runs/{rid}/job")
def job(rid: str):
    return get_run(rid).job


# ====================================================================== static UI
@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
