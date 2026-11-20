import argparse
from contextlib import nullcontext
from datetime import datetime, timezone
import json
import math
from pathlib import Path

import pandas as pd
import rasterio
from pyproj import CRS, Transformer
from shapely.ops import transform, unary_union

from . import demo, evidence
from .geo import FlowNetwork, frame, read_sites, read_pois, derive, sample_table, population, poi_counts

ROOT = Path(__file__).resolve().parent.parent


def settings(path):
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    if path:
        cfg.update(json.loads(path.read_text(encoding="utf-8")))
    crs = CRS.from_user_input(cfg["crs"])
    if not crs.is_projected or any(
        not math.isclose(a.unit_conversion_factor, 1) for a in crs.axis_info[:2]
    ):
        raise ValueError("Use a projected CRS with metre units.")
    positive = ["snap_m", "junction_m", "offset_m", "sample_radius_m", "corridor_km",
                "buffer_m", "decay_km", "min_water_pixels", "min_pairs",
                "delta_scale", "population_scale", "poi_scale"]
    if any(not math.isfinite(cfg[k]) or cfg[k] <= 0 for k in positive):
        raise ValueError("Distance, threshold and scale settings must be finite and positive.")
    if cfg["ambiguity_m"] < 0 or cfg["offset_m"] <= cfg["sample_radius_m"]:
        raise ValueError("Check ambiguity_m and ensure offset_m exceeds sample_radius_m.")
    w = cfg["weights"]
    if (set(w) != {"optical", "severity", "population", "poi"}
        or not math.isclose(sum(w.values()), 1)
        or min(w.values()) < 0):
        raise ValueError("Specify four nonnegative weights that sum to one.")
    return cfg


def queue_row(site, link, ev, pop, amenities, cfg):
    optical = ev.get("optical_score")
    sev = float(site.severity) if (
        pd.notna(site.severity) and 0 <= site.severity <= 1 and site.severity_source
    ) else None
    p = min(1.0, math.log1p(pop["pop_near"]) / math.log1p(cfg["population_scale"])) \
        if pop["pop_coverage_complete"] else None
    v = min(1.0, sum(amenities.values()) / cfg["poi_scale"]) \
        if all(a is not None for a in amenities.values()) else None
    components = {"optical": optical, "severity": sev, "population": p, "poi": v}
    w = cfg["weights"]
    coverage = sum(w[k] for k in w if components[k] is not None)
    lower = sum(w[k] * components[k] for k in w if components[k] is not None)
    routable = link["corridor_stop"] in {"distance_limit", "network_end"}
    score = None
    if site.role == "reference":
        action = "Reference comparison"
    elif not link["link_reviewed"]:
        action = "Verify outfall location and river direction"
    elif not routable:
        action = "Check network coverage or topology"
    elif not math.isclose(coverage, 1.0):
        action = "Fill missing screening inputs"
    else:
        score = round(lower, 6)
        action = "Prioritize independent review" if score >= 0.65 else "Standard desk review"
    return {
        "site_id": site.site_id, "name": site.name, "role": site.role,
        "industry_type": site.industry_type, "discharge_m3d": site.discharge_m3d,
        "outfall_source": site.outfall_source, "severity_source": site.severity_source,
        **link, "n_clear_dates": ev.get("n_clear_dates", 0),
        "median_delta": ev.get("median_delta"), "last_unusual_date": ev.get("last_unusual_date", ""),
        **pop, **amenities,
        "optical_score": optical, "severity_score": sev, "population_score": p, "poi_score": v,
        "component_coverage": round(coverage, 6),
        "score_low": round(lower, 6), "score_high": round(min(1, lower + 1 - coverage), 6),
        "review_score": score, "rank": None, "action": action,
    }


def run(args, cfg):
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    if args.demo:
        if CRS.from_user_input(cfg["crs"]) != CRS.from_epsg(32646):
            raise ValueError("The synthetic demo uses EPSG:32646.")
        args.sites, args.rivers, args.population, args.pois = demo.make_inputs(out / "demo_inputs")
        cfg["population_label"] = "Synthetic people-per-pixel raster (not real population data)."

    sites = read_sites(args.sites, cfg["crs"])
    net = FlowNetwork(args.rivers, cfg)
    links, probes, corridors, zones, link_info = derive(sites, net, cfg)
    samples = sample_table(probes)
    if args.demo:
        args.observations = [
            demo.make_observations(out / "synthetic_observations.csv", samples, cfg["sample_radius_m"])
        ]
    pairs, optical, obs_qa = evidence.analyze(args.observations, samples, cfg)
    pois = read_pois(args.pois, cfg["crs"])
    zone_by_site = dict(zip(zones["site_id"], zones.geometry)) if not zones.empty else {}
    included = [zone_by_site[r.site_id] for r in sites.itertuples(index=False)
                if r.role != "reference" and r.site_id in zone_by_site]
    union = unary_union(included) if included else None

    rows = []
    with (rasterio.open(args.population) if args.population else nullcontext(None)) as ds:
        if ds is not None and (not ds.crs or ds.transform.b != 0 or ds.transform.d != 0):
            raise ValueError("Supply a north-up population raster with a defined CRS.")
        reproject = Transformer.from_crs(cfg["crs"], ds.crs, always_xy=True).transform if ds else None

        def raster_zone(zone):
            return transform(reproject, zone) if reproject is not None and zone is not None else None

        for row in sites.itertuples(index=False):
            zone = zone_by_site.get(row.site_id)
            rows.append(queue_row(row, link_info[row.site_id], optical.get(row.site_id, {}),
                                  population(ds, raster_zone(zone)), poi_counts(pois, zone), cfg))
        union_stats = population(ds, raster_zone(union))

    ranked = sorted((r for r in rows if r["review_score"] is not None),
                    key=lambda r: (-r["review_score"], r["site_id"]))
    for i, row in enumerate(ranked, 1):
        row["rank"] = i
    queue = pd.DataFrame(rows)
    queue["rank"] = queue["rank"].astype("Int64")
    queue = queue.sort_values(["rank", "site_id"], na_position="last")

    gpkg = out / "riverwatch.gpkg"
    temporary = out / "_working.gpkg"
    temporary.unlink(missing_ok=True)
    featured = sites.merge(queue[["site_id", "rank", "review_score", "action", "pop_near",
                                  "n_clear_dates"]], on="site_id", validate="one_to_one")
    zone_output = zones.merge(
        queue[["site_id", "pop_near", "pop_coverage_complete"]], on="site_id"
    ) if not zones.empty else zones
    layers = {
        "sites": featured, "rivers": net.layer, "links": links, "sampling_points": probes,
        "corridors": corridors, "proximity_zones": zone_output,
        "portfolio_union": frame(
            [{"geometry": union, **union_stats}] if union is not None else [], cfg["crs"]
        ),
        "mapped_pois": pois,
    }
    for name, layer in layers.items():
        if layer is not None and not layer.empty:
            layer.to_file(temporary, layer=name, driver="GPKG", engine="pyogrio", index=False)
    temporary.replace(gpkg)

    queue.to_csv(out / "review_queue.csv", index=False)
    samples.to_csv(out / "samples_gee.csv", index=False)
    pairs.to_csv(out / "paired_observations.csv", index=False)
    manifest = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "mode": "synthetic" if args.demo else "screening",
        "config": cfg,
        "inputs": {k: str(getattr(args, k)) if getattr(args, k) else None
                   for k in ["sites", "rivers", "population", "pois"]},
        "observation_files": [str(p) for p in args.observations],
        "site_count": int((sites.role != "reference").sum()),
        "ranked_count": len(ranked),
        "linked_count_including_references": len(links),
        "union_zone_count": len(included),
        "union_population": union_stats,
        "union_mapped_amenities": poi_counts(pois, union),
        "observation_qa": obs_qa,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False), encoding="utf-8")
    print(f"RiverWatch BD [{manifest['mode']}]: {gpkg.resolve()}")
    print(f"{len(ranked)} complete ranks; {obs_qa['valid_paired_dates']} usable site-date pairs.")
    return manifest


def main():
    p = argparse.ArgumentParser(description="RiverWatch BD GIS screening pipeline")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--out", type=Path, required=True)
    for flag in ("sites", "rivers", "population", "pois", "config"):
        p.add_argument("--" + flag, type=Path)
    p.add_argument("--observations", nargs="+", type=Path, default=[])
    args = p.parse_args()
    if not args.demo and not (args.sites and args.rivers):
        p.error("A real run requires --sites and --rivers, or use --demo.")
    if args.demo and any([args.sites, args.rivers, args.population, args.pois, args.observations]):
        p.error("Do not combine real inputs with --demo.")
    run(args, settings(args.config))


if __name__ == "__main__":
    main()
