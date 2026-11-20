import html
import json
from pathlib import Path

import folium
import geopandas as gpd
import pandas as pd
import pyogrio
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(page_title="RiverWatch BD", layout="wide")
st.title("RiverWatch BD")
root = Path(st.sidebar.text_input("Run folder", "runs/demo"))
manifest_path = root / "manifest.json"
if not manifest_path.is_file():
    st.info("Run `python -m riverwatch --demo --out runs/demo`, or point to a completed real run.")
    st.stop()
run = json.loads(manifest_path.read_text(encoding="utf-8"))
if run["mode"] == "synthetic":
    st.warning("SYNTHETIC DEMO — the locations, discharges, and measurements are not real.")
st.caption("Desk screening only. Optical contrasts do not establish a discharge source. "
           "Population figures describe proximity, not measured exposure.")

pop = run["union_population"]
counts = st.columns(3)
counts[0].metric("Mapped sites", run["site_count"])
counts[1].metric("Sites with complete review ranks", run["ranked_count"])
counts[2].metric("Estimated residents near modeled corridors",
                 f"{pop['pop_near']:,.0f}" if pop["pop_near"] is not None else "Unavailable")
st.caption(
    f"Population uses the union of {run['union_zone_count']} non-reference zones, "
    "including provisional zones. "
    + ("Population raster coverage is partial or unavailable. " if not pop["pop_coverage_complete"] else "")
    + run["config"]["population_label"]
)

queue = pd.read_csv(root / "review_queue.csv", dtype={"site_id": str}, keep_default_na=False)
queue["rank"] = pd.to_numeric(queue["rank"], errors="coerce").astype("Int64")
st.subheader("Review queue")
st.dataframe(queue[["rank", "site_id", "name", "role", "action", "n_clear_dates",
                    "pop_near", "score_low", "score_high"]], hide_index=True, use_container_width=True)
st.download_button("Export review queue", (root / "review_queue.csv").read_bytes(),
                   file_name="review_queue.csv", mime="text/csv")

sid = st.selectbox("Inspect a site", queue.site_id.tolist())
detail = queue.loc[queue.site_id.eq(sid)].iloc[0]
gpkg = root / "riverwatch.gpkg"
available = {row[0] for row in pyogrio.list_layers(gpkg)}


def read_layer(name, selected=False):
    if name not in available:
        return None
    g = gpd.read_file(gpkg, layer=name).to_crs(4326)
    return g.loc[g.site_id.eq(sid)] if selected else g


map_col, audit_col = st.columns([3, 2])
sites = read_layer("sites")
chosen = sites.loc[sites.site_id.eq(sid)].geometry.iloc[0]
m = folium.Map(location=[chosen.y, chosen.x], zoom_start=13, tiles="CartoDB positron")
pins = folium.FeatureGroup(name="Reported sites / reference points")
for row in sites.itertuples():
    folium.CircleMarker(
        [row.geometry.y, row.geometry.x], radius=7 if row.site_id == sid else 4,
        color="#9333a8" if row.site_id == sid else "#555555",
        fill=True, fill_opacity=0.85, tooltip=html.escape(str(row.site_id)),
    ).add_to(pins)
pins.add_to(m)

for layer, label, color, opacity in [
    ("proximity_zones", "Selected proximity zone", "#54a986", 0.18),
    ("corridors", "Selected downstream path", "#006980", 0.0),
]:
    g = read_layer(layer, selected=True)
    if g is not None and not g.empty:
        folium.GeoJson(
            json.loads(g[["geometry"]].to_json()), name=label,
            style_function=lambda _, c=color, o=opacity: {
                "color": c, "fillColor": c, "weight": 4, "fillOpacity": o
            },
        ).add_to(m)
        a, b, c, d = g.total_bounds
        m.fit_bounds([[min(b, chosen.y), min(a, chosen.x)],
                      [max(d, chosen.y), max(c, chosen.x)]], max_zoom=15)
for layer, label in [("links", "Candidate snap"), ("sampling_points", "Optical sample centers")]:
    g = read_layer(layer, selected=True)
    if g is not None and not g.empty:
        group = folium.FeatureGroup(name=label)
        for row in g.itertuples():
            folium.CircleMarker(
                [row.geometry.y, row.geometry.x], radius=5, color="#c35616",
                tooltip=label + (": " + row.side if layer == "sampling_points" else ""),
                fill=True, fill_opacity=0.9,
            ).add_to(group)
        group.add_to(m)
folium.LayerControl().add_to(m)

with map_col:
    components.html(m.get_root().render(), height=500)
with audit_col:
    st.subheader(sid)
    st.write(detail["action"])
    fields = [
        "snap_method", "snap_distance_m", "link_reviewed", "corridor_stop",
        "outfall_source", "severity_source", "median_delta", "last_unusual_date",
        "valid_pop_cells", "pop_coverage_complete", "school", "hospital",
        "drinking_water", "water_well", "optical_score", "severity_score",
        "population_score", "poi_score", "component_coverage",
    ]
    st.dataframe(pd.DataFrame(
        [(k, str(detail[k]) if str(detail[k]) else "—") for k in fields],
        columns=["Check", "Value"],
    ), hide_index=True, use_container_width=True)

st.subheader("Paired optical observations")
pairs = pd.read_csv(root / "paired_observations.csv", dtype={"site_id": str}, keep_default_na=False)
p = pairs.loc[pairs.site_id.eq(sid)].copy()
if p.empty:
    st.info("No valid same-scene pairs for this site in this run.")
else:
    p["date"] = pd.to_datetime(p.date)
    p = p.sort_values("date")
    st.line_chart(p.set_index("date")[["up", "down"]])
    st.dataframe(p[["date", "delta", "water_up", "water_down", "unusual"]],
                 hide_index=True, use_container_width=True)
st.caption("An unusual optical contrast is a prompt for independent review, not a verified event.")
