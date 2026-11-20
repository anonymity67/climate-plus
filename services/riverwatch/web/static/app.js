/* RiverWatch BD: web GIS client (vanilla JS + Leaflet). */
(() => {
"use strict";

// ------------------------------------------------------------------ constants
const TIER = {
  T1: { label: "Red", color: "#dc2626", pill: "red" },
  T2: { label: "Orange-B", color: "#f97316", pill: "orange" },
  T3: { label: "Orange-A", color: "#f59e0b", pill: "amber" },
  T4: { label: "Green", color: "#16a34a", pill: "green" },
  none: { label: "Unclassified", color: "#94a3b8", pill: "grey" },
};
const CAT = {
  industrial: { label: "Industrial", color: null, shape: "", pill: "dark" },
  landfill: { label: "Landfill / dump", color: "#8b5a2b", shape: "sq", pill: "brown" },
  wastewater: { label: "Wastewater plant", color: "#7c3aed", shape: "dm", pill: "purple" },
  reference: { label: "Reference", color: "#0891b2", shape: "", pill: "blue" },
};
const POI = {
  school: { label: "Schools", color: "#2563eb" }, hospital: { label: "Hospitals", color: "#db2777" },
  drinking_water: { label: "Drinking water", color: "#0891b2" }, water_well: { label: "Water wells", color: "#65a30d" },
};
const STOP = {
  distance_limit: "Full corridor length followed", network_end: "Reached the network outlet",
  network_clipped: "Network clipped", junction_gap_or_unresolved: "Junction gap / unresolved",
  unresolved_flow: "Flow direction unresolved", cycle: "Topology cycle", unlinked: "Not linked",
};
const ACTION_HELP = {
  "Verify outfall location and river direction": ["verify", "The link to the river is still provisional. Confirm the documented outfall (not the factory centroid or gate), its citation, and the flow direction. Then mark the link as reviewed and re-run the analysis."],
  "Check network coverage or topology": ["verify", "The modelled downstream route stops early. Check the HydroRIVERS extract and junctions, then re-run."],
  "Fill missing screening inputs": ["verify", "One or more weighted inputs are missing (optical, severity, population or POI). The score is shown as a possible range."],
  "Prioritize independent review": ["prio", "All screening inputs are present and the combined score is ≥ 0.65. Review this case first. That does not mean the site pollutes."],
  "Standard desk review": ["std", "All screening inputs are present and the combined score is below 0.65."],
  "Reference comparison": ["ref", "Reference location on the same river system. It is not ranked and is not counted in the population headline."],
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 0) => (n === null || n === undefined || Number.isNaN(n)) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const compact = (n) => {
  if (n === null || n === undefined) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + " M";
  if (n >= 1e4) return (n / 1e3).toFixed(0) + " k";
  return fmt(n);
};
const tierKey = (t) => (t && TIER[t]) ? t : "none";
const colorOf = (p) => {
  if (p.ref) return CAT.reference.color;
  if (p.c === "landfill") return CAT.landfill.color;
  if (p.c === "wastewater") return CAT.wastewater.color;
  return TIER[tierKey(p.t)].color;
};
const shapeOf = (p) => p.ref ? "" : (CAT[p.c]?.shape || "");

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.detail || msg; } catch (_) { /* ignore */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}
function toast(msg, ms = 3500) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}
function status(msg) { const s = $("#mapStatus"); if (!msg) s.classList.add("hidden"); else { s.textContent = msg; s.classList.remove("hidden"); } }

// ------------------------------------------------------------------ state
const S = {
  runs: [], runId: null, summary: null, features: [], byId: new Map(), markers: new Map(),
  selected: null, detail: null, reviewEnabled: false, criticalSnap: 500,
  token: localStorage.getItem("rw_token") || "", reviewer: localStorage.getItem("rw_reviewer") || "",
  queueLimit: 150, picking: false, filtered: [],
};

// ------------------------------------------------------------------ map
const map = L.map("map", { preferCanvas: true, zoomControl: false, minZoom: 5, maxZoom: 19 }).setView([23.75, 90.3], 7);
L.control.zoom({ position: "topright" }).addTo(map);
L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const BASE = {
  "Light grey (Esri)": L.layerGroup([
    L.tileLayer(`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, maxNativeZoom: 16, attribution: "Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors" }),
    L.tileLayer(`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 16, pane: "shadowPane" }),
  ]),
  "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }),
  "Satellite (Esri)": L.layerGroup([
    L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
    L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, pane: "shadowPane" }),
  ]),
  "Dark grey (Esri)": L.tileLayer(`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, maxNativeZoom: 16, attribution: "Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors" }),
};
let currentBase = "Light grey (Esri)";
BASE[currentBase].addTo(map);

map.createPane("water"); map.getPane("water").style.zIndex = 380;
map.createPane("rivers"); map.getPane("rivers").style.zIndex = 390;
map.createPane("zones"); map.getPane("zones").style.zIndex = 395;
map.createPane("corr"); map.getPane("corr").style.zIndex = 410;
map.createPane("sel"); map.getPane("sel").style.zIndex = 620;
const canvasRivers = L.canvas({ pane: "rivers", padding: 0.3 });
const canvasCorr = L.canvas({ pane: "corr", padding: 0.3 });

const LAYERS = {}; // key -> {layer, label, on, group, swatch, load()}
function defLayer(key, opts) { LAYERS[key] = { on: false, layer: null, ...opts }; }

async function getStatic(name) { return api(`/static/data/${name}`); }

defLayer("divisions", { group: "Context", label: "Division boundaries", swatch: "border:2px dashed #334155", on: true,
  load: async () => L.geoJSON(await getStatic("divisions.geojson"), { interactive: false, style: { color: "#334155", weight: 1.4, dashArray: "5 4", fill: false, opacity: .7 } }) });
defLayer("districts", { group: "Context", label: "District boundaries", swatch: "border:1px solid #94a3b8",
  load: async () => L.geoJSON(await getStatic("districts.geojson"), { style: { color: "#94a3b8", weight: .8, fill: false }, onEachFeature: (f, l) => l.bindTooltip(esc(f.properties.name), { sticky: true, className: "rw-tip" }) }) });
defLayer("rivers", { group: "Water", label: "River network (HydroRIVERS, width ∝ discharge)", swatch: "background:#3b82f6", on: true,
  load: async () => L.geoJSON(await getStatic("rivers_display.geojson"), {
    renderer: canvasRivers,
    style: (f) => { const d = f.properties.DIS_AV_CMS || 0; return { color: "#3b82c4", weight: Math.max(0.5, Math.min(7, 0.2 + Math.log10(d + 1) * 1.45)), opacity: d < 20 ? 0.45 : 0.75 }; },
    onEachFeature: (f, l) => { const p = f.properties; l.bindTooltip(`<b>${esc(p.river_name || "Unnamed reach")}</b><br>HYRIV_ID ${p.HYRIV_ID} · mean discharge ${fmt(p.DIS_AV_CMS, 1)} m³/s`, { sticky: true, className: "rw-tip" }); },
  }) });
defLayer("osmrivers", { group: "Water", label: "Named rivers (OpenStreetMap)", swatch: "background:#60a5fa;height:3px",
  load: async () => L.geoJSON(await getStatic("osm_rivers.geojson"), { renderer: canvasRivers, style: { color: "#1d4ed8", weight: 1.2, opacity: .6, dashArray: "4 3" },
    onEachFeature: (f, l) => l.bindTooltip(esc(f.properties.name), { sticky: true, className: "rw-tip" }) }) });
defLayer("water", { group: "Water", label: "Prominent water bodies (≥ 0.5 km², OSM)", swatch: "background:#7dd3fc;border:1px solid #0284c7", on: true,
  load: async () => L.geoJSON(await getStatic("water_bodies.geojson"), { pane: "water", style: { color: "#0284c7", weight: 1, fillColor: "#7dd3fc", fillOpacity: .45 },
    onEachFeature: (f, l) => l.bindTooltip(`<b>${esc(f.properties.name)}</b><br>${fmt(f.properties.area_km2, 2)} km²`, { sticky: true, className: "rw-tip" }) }) });
defLayer("sources", { group: "Waste sources", label: "Mapped waste sources (clustered)", swatch: "background:#dc2626;border-radius:50%;width:12px", on: true, dynamic: true });
defLayer("critical", { group: "Waste sources", label: "Critical: downstream corridors (10 km)", swatch: "background:linear-gradient(90deg,#b91c1c,#fbbf24)", on: true, dynamic: true });
defLayer("footprints", { group: "Waste sources", label: "Footprints: landfills, wastewater plants, industrial zones (zoom ≥ 11)", swatch: "background:#d6b38a;border:1px solid #8b5a2b", on: true,
  load: async () => L.geoJSON(await getStatic("footprints.geojson"), { pane: "zones",
    style: (f) => { const k = f.properties.kind; const c = k === "landfill" || k === "waste_transfer" ? "#8b5a2b" : k === "wastewater_plant" ? "#7c3aed" : "#64748b"; return { color: c, weight: 1.2, fillColor: c, fillOpacity: k === "industrial_area" ? .08 : .3 }; },
    onEachFeature: (f, l) => { const p = f.properties; l.bindTooltip(`<b>${esc(p.name)}</b><br>${esc(p.kind.replace("_", " "))} · ${fmt(p.area_ha, 1)} ha`, { sticky: true, className: "rw-tip" }); l.on("click", () => S.byId.has(p.site_id) && selectSite(p.site_id)); } }) });
defLayer("heat", { group: "Waste sources", label: "Source density heatmap (weighted by severity)", swatch: "background:linear-gradient(90deg,#3b82f6,#facc15,#dc2626)", dynamic: true });
defLayer("union", { group: "Analysis", label: "Union of 500 m proximity zones (population headline)", swatch: "background:rgba(22,163,74,.25);border:1px solid #16a34a", dynamic: true });

let cluster = null, heat = null, critLayer = null, unionLayer = null;
const selGroup = L.layerGroup().addTo(map);
let pickMarker = null;

async function toggleLayer(key, on) {
  const d = LAYERS[key]; d.on = on;
  if (d.dynamic) { applyDynamic(key); return; }
  if (on && !d.layer) {
    status(`Loading ${d.label}…`);
    try { d.layer = await d.load(); } catch (e) { toast("Could not load layer: " + e.message); d.on = false; status(); return; }
    status();
  }
  if (!d.layer) return;
  if (key === "footprints") { updateFootprints(); return; }
  if (on) d.layer.addTo(map); else map.removeLayer(d.layer);
}
function updateFootprints() {
  const d = LAYERS.footprints; if (!d.layer) return;
  const show = d.on && map.getZoom() >= 11;
  if (show && !map.hasLayer(d.layer)) d.layer.addTo(map);
  if (!show && map.hasLayer(d.layer)) map.removeLayer(d.layer);
}
map.on("zoomend", updateFootprints);

async function applyDynamic(key) {
  const on = LAYERS[key].on;
  if (key === "sources" && cluster) { on ? cluster.addTo(map) : map.removeLayer(cluster); }
  if (key === "critical" && critLayer) { on ? critLayer.addTo(map) : map.removeLayer(critLayer); }
  if (key === "heat") {
    if (on) { buildHeat(); heat.addTo(map); } else if (heat) map.removeLayer(heat);
  }
  if (key === "union") {
    if (on) {
      if (!unionLayer) {
        status("Loading population union…");
        const g = await api(`/api/runs/${S.runId}/union`);
        unionLayer = L.geoJSON(g, { pane: "zones", interactive: false, style: { color: "#15803d", weight: 1, fillColor: "#22c55e", fillOpacity: .18 } });
        status();
      }
      unionLayer.addTo(map);
    } else if (unionLayer) map.removeLayer(unionLayer);
  }
}

// ------------------------------------------------------------------ markers
function markerIcon(p, selected = false) {
  const size = p.cr ? 14 : (p.c === "industrial" && !p.t ? 9 : 12);
  const cls = ["src-marker", shapeOf(p), p.cr ? "crit" : "", selected ? "sel" : ""].join(" ");
  return L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<div class="${cls}" style="width:${size}px;height:${size}px;background:${colorOf(p)}"></div>` });
}
function buildMarkers() {
  S.markers.clear();
  for (const f of S.features) {
    const p = f.properties; const [lon, lat] = f.geometry.coordinates;
    const m = L.marker([lat, lon], { icon: markerIcon(p), riseOnHover: true, keyboard: false });
    m._rw = p;
    m.bindTooltip(`<b>${esc(p.n)}</b>${p.cr ? ' <span class="crit-tag">CRITICAL</span>' : ""}<br>${esc(p.it)}${p.rn ? " · " + esc(p.rn) : ""}`, { className: "rw-tip", direction: "top", offset: [0, -6] });
    m.on("click", () => selectSite(p.id));
    S.markers.set(p.id, m);
  }
}
function clusterIcon(c) {
  const ms = c.getAllChildMarkers(); const n = ms.length;
  let crit = 0, red = 0;
  for (const m of ms) { if (m._rw.cr) crit++; if (m._rw.t === "T1" || m._rw.c === "landfill" || m._rw.c === "wastewater") red++; }
  const size = n < 10 ? 30 : n < 100 ? 38 : n < 1000 ? 46 : 54;
  const bg = crit ? `rgba(220,38,38,${0.75 + Math.min(.25, crit / n)})` : red ? "rgba(234,88,12,.85)" : "rgba(15,76,117,.82)";
  return L.divIcon({ className: "", iconSize: [size, size],
    html: `<div class="cluster" style="width:${size}px;height:${size}px;background:${bg}" title="${crit} critical">${n}</div>` });
}
function rebuildCluster() {
  if (cluster) map.removeLayer(cluster);
  cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, iconCreateFunction: clusterIcon, showCoverageOnHover: false, disableClusteringAtZoom: 15 });
  cluster.addLayers(S.filtered.map((f) => S.markers.get(f.properties.id)));
  if (LAYERS.sources.on) cluster.addTo(map);
  if (heat && LAYERS.heat.on) { map.removeLayer(heat); heat = null; buildHeat(); heat.addTo(map); }
}
function buildHeat() {
  if (heat) return;
  const pts = S.filtered.filter((f) => !f.properties.ref).map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0], f.properties.sev ?? 0.25]);
  heat = L.heatLayer(pts, { radius: 18, blur: 16, maxZoom: 12, minOpacity: .25 });
}
function buildCritical(g) {
  if (critLayer) map.removeLayer(critLayer);
  const ramp = (ri) => { const t = Math.max(0, Math.min(1, ri)); const r = 185 + (251 - 185) * (1 - t), gg = 28 + (191 - 28) * (1 - t), b = 28 + (36 - 28) * (1 - t); return `rgb(${r | 0},${gg | 0},${b | 0})`; };
  critLayer = L.geoJSON(g, { renderer: canvasCorr, style: (f) => ({ color: ramp(f.properties.ri), weight: 3.2, opacity: .9 }),
    onEachFeature: (f, l) => { l.bindTooltip(`Downstream of <b>${esc(S.byId.get(f.properties.site_id)?.properties.n || f.properties.site_id)}</b><br>from km ${fmt(f.properties.km, 1)} · relative index ${fmt(f.properties.ri, 2)}`, { sticky: true, className: "rw-tip" }); l.on("click", () => selectSite(f.properties.site_id)); } });
  if (LAYERS.critical.on) critLayer.addTo(map);
}

// ------------------------------------------------------------------ filters / queue
function filters() {
  return { cat: $("#fCat").value, tier: $("#fTier").value, div: $("#fDiv").value, crit: $("#fCrit").checked,
    linked: $("#fLinked").checked, brick: $("#fHideBrick").checked, river: $("#fRiver").value.trim().toLowerCase(), sort: $("#fSort").value };
}
function applyFilters(rebuild = true) {
  const f = filters();
  S.filtered = S.features.filter(({ properties: p }) => {
    if (f.cat && (f.cat === "reference" ? !p.ref : p.c !== f.cat)) return false;
    if (f.tier && tierKey(p.t) !== f.tier) return false;
    if (f.div && p.dv !== f.div) return false;
    if (f.crit && !p.cr) return false;
    if (f.linked && (p.rid === null || p.cs === "unlinked")) return false;
    if (f.brick && p.it === "Brick kiln") return false;
    if (f.river && !(p.rn || "").toLowerCase().includes(f.river)) return false;
    return true;
  });
  const key = {
    crit: (p) => [p.rk === null ? 1 : 0, p.rk ?? 0, p.cr ? 0 : 1, -(p.hi ?? 0), -(p.lo ?? 0)],
    hi: (p) => [-(p.hi ?? -1), -(p.lo ?? -1)], lo: (p) => [-(p.lo ?? -1), -(p.hi ?? -1)],
    pop: (p) => [-(p.pop ?? -1)], snap: (p) => [p.sd ?? 1e9], optical: (p) => [(p.nd ?? 0) >= (S.summary?.config?.min_pairs ?? 6) ? 0 : 1, -(p.md ?? -9)], name: (p) => [p.n.toLowerCase()],
  }[f.sort];
  S.filtered.sort((a, b) => { const ka = key(a.properties), kb = key(b.properties); for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; } return 0; });
  S.queueLimit = 150;
  renderQueue();
  if (rebuild) rebuildCluster();
}
function rangeBar(lo, hi, cls = "range") {
  if (lo === null || lo === undefined) return "";
  return `<div class="${cls}"><span style="left:${lo * 100}%;width:${Math.max(1, (hi - lo) * 100)}%"></span><i style="left:calc(${lo * 100}% - 1px)"></i></div>`;
}
function renderQueue() {
  const list = $("#queueList");
  const rows = S.filtered.slice(0, S.queueLimit);
  $("#queueMeta").innerHTML = `${fmt(S.filtered.length)} of ${fmt(S.features.length)} sites match · the map shows the same filter. Score bars show the <b>possible range</b> (known lower bound → upper bound if missing inputs were maximal).`;
  list.innerHTML = rows.map(({ properties: p }) => `
    <div class="qrow ${S.selected === p.id ? "sel" : ""}" data-id="${esc(p.id)}">
      <div class="dot" style="background:${colorOf(p)};border-radius:${shapeOf(p) === "sq" ? "3px" : "50%"}"></div>
      <div><div class="t">${p.rk ? `<b>#${p.rk}</b> ` : ""}${esc(p.n)}${p.cr ? '<span class="crit-tag">CRITICAL</span>' : ""}</div>
        <div class="s">${esc(p.it)}${p.ds ? " · " + esc(p.ds) : ""}${p.rn ? " · " + esc(p.rn) : ""}</div></div>
      <div class="r">${p.pop !== null ? compact(p.pop) + " ppl" : "—"}${rangeBar(p.lo, p.hi)}<div style="color:#64748b">${p.lo !== null ? fmt(p.lo, 2) + "–" + fmt(p.hi, 2) : ""}</div></div>
    </div>`).join("") + (S.filtered.length > S.queueLimit ? `<button class="btn more" id="moreBtn">Show more (${fmt(S.filtered.length - S.queueLimit)} remaining)</button>` : "");
  $$(".qrow", list).forEach((el) => el.addEventListener("click", () => selectSite(el.dataset.id, true)));
  const mb = $("#moreBtn"); if (mb) mb.addEventListener("click", () => { S.queueLimit += 300; renderQueue(); });
}

// ------------------------------------------------------------------ overview / rivers / layers tabs
function bars(entries, colorFn, total) {
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return `<div class="bars">${entries.map(([k, v, label]) => `<div class="bar"><div>${esc(label || k)}</div><div class="track"><span style="width:${(v / max) * 100}%;background:${colorFn(k)}"></span></div><div class="n">${fmt(v)}</div></div>`).join("")}</div>`;
}
function renderOverview() {
  const s = S.summary, c = s.counts, cfg = s.config, up = s.union_population || {}, am = s.union_mapped_amenities || {};
  const cat = s.by_category || {};
  const tierEntries = ["T1", "T2", "T3", "T4", "none"].filter((t) => s.by_tier[t]).map((t) => [t, s.by_tier[t], `${TIER[t].label}`]);
  const divEntries = Object.entries(s.critical_by_division).sort((a, b) => b[1] - a[1]);
  const qa = s.observation_qa || {};
  const optical = (qa.valid_paired_dates || 0) > 0;
  $("#tab-overview").innerHTML = `
    <div class="run-head"><h2>${esc(s.run.title)}</h2><p>${esc(s.run.description)}</p>
      <div class="badge-row"><span class="pill ${s.run.mode === "synthetic" ? "red" : "blue"}">${esc(s.run.mode)}</span><span class="pill grey">${esc(s.run.period)}</span></div></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${fmt(c.sites)}</div><div class="l">Mapped waste sources</div></div>
      <div class="kpi"><div class="v">${fmt(c.linked)}</div><div class="l">Linked to a river reach within ${fmt(cfg.snap_m)} m</div></div>
      <div class="kpi"><div class="v">${fmt(cat.industrial || 0)}</div><div class="l">Industrial works and zones</div></div>
      <div class="kpi"><div class="v">${fmt((cat.landfill || 0) + (cat.wastewater || 0))}</div><div class="l">Landfills, dumps, transfer stations and wastewater plants</div></div>
      <div class="kpi crit wide"><div class="v">${fmt(c.critical)}</div><div class="l"><b>Critical to rivers:</b> ${esc(s.critical_rule)}</div></div>
      <div class="kpi pop wide"><div class="v">${up.pop_near != null ? compact(up.pop_near) : "Unavailable"}</div><div class="l">Estimated residents within ${fmt(cfg.buffer_m)} m of the modelled ${fmt(cfg.corridor_km)} km downstream corridors. Counted once from the <b>union</b> of ${fmt(s.union_zone_count)} zones, not summed per site.${up.pop_coverage_complete ? "" : " Raster coverage is partial at the border."}</div></div>
      <div class="kpi wide"><div class="amen" style="margin:0">${Object.keys(POI).map((k) => `<div><b>${fmt(am[k])}</b><span>${POI[k].label}</span></div>`).join("")}</div><div class="l" style="margin-top:6px">OpenStreetMap amenities inside the union zone. They are mapped features, not evidence of contamination.</div></div>
      <div class="kpi"><div class="v">${fmt(c.ranked)}</div><div class="l">Complete review ranks (these need a reviewed link)</div></div>
      <div class="kpi"><div class="v">${fmt(c.link_reviewed)}</div><div class="l">Links reviewed by an analyst</div></div>
    </div>
    ${c.ranked === 0 ? `<div class="warn">No site has a complete rank yet. A rank needs a <b>documented outfall, a citation and a reviewed flow direction</b> (README §3). Until then, sites are sorted by their provisional score range. Open a site and use the analyst review form to confirm its link.</div>` : ""}
    <div class="section-title">Potential-hazard tier (ECR category, inferred)</div>
    ${bars(tierEntries, (k) => TIER[k].color)}
    ${divEntries.length ? `<div class="section-title">Critical-to-river sources by division</div>${bars(divEntries, () => "#dc2626")}` : ""}
    ${optical ? `<div class="section-title">Sentinel-2 optical screening</div>
      <table class="kv"><tr><td>Valid same-scene pairs</td><td>${fmt(qa.valid_paired_dates)}</td></tr>
      <tr><td>Sites with paired dates</td><td>${fmt(c.with_optical)}</td></tr>
      <tr><td>Sites with ≥ ${cfg.min_pairs} pairs (scored)</td><td>${fmt(c.optical_scored)}</td></tr>
      <tr><td>Accepted sample rows / input rows</td><td>${fmt(qa.accepted_sample_rows)} / ${fmt(qa.input_rows)}</td></tr></table>
      <p class="note">NDTI = (red − green)/(red + green). The contrast is downstream minus upstream on the same scene. A positive contrast can come from sediment or water colour. It flags a site for review and is not a verified discharge.</p>` : ""}
    <div class="section-title">Modelled routes</div>
    ${bars(Object.entries(s.corridor_stops).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, STOP[k] || k]), (k) => k === "distance_limit" || k === "network_end" ? "#0e7490" : "#f59e0b")}
    <div class="section-title">Run settings</div>
    <table class="kv">
      <tr><td>Projected CRS</td><td>${esc(cfg.crs)}</td></tr>
      <tr><td>Snap limit / ambiguity</td><td>${fmt(cfg.snap_m)} m / ${fmt(cfg.ambiguity_m)} m</td></tr>
      <tr><td>Corridor / buffer</td><td>${fmt(cfg.corridor_km)} km / ${fmt(cfg.buffer_m)} m</td></tr>
      <tr><td>Weights</td><td>optical ${cfg.weights.optical} · severity ${cfg.weights.severity} · population ${cfg.weights.population} · POI ${cfg.weights.poi}</td></tr>
      <tr><td>Population</td><td>${esc(cfg.population_label)}</td></tr>
      <tr><td>Run created</td><td>${esc((s.run.created_utc || "").replace("T", " ").slice(0, 19))} UTC</td></tr>
    </table>
    <div id="reviewBanner"></div>`;
  renderReviewBanner();
}
function renderRivers() {
  const rs = S.summary.rivers || [];
  $("#tab-rivers").innerHTML = `
    <p class="note">Named receiving rivers ranked by how many <b>critical</b> sources, then total sources, are linked to them. River names come from the nearest named OpenStreetMap river (display only). Many delta distributaries are unnamed in the source data. Click a row to filter the queue and zoom the map.</p>
    <table class="rtable"><thead><tr><th>River</th><th class="num">Sources</th><th class="num">Red</th><th class="num">Critical</th><th class="num">Max ppl/zone</th></tr></thead>
    <tbody>${rs.map((r, i) => `<tr data-i="${i}"><td><b>${esc(r.river_name)}</b></td><td class="num">${fmt(r.sources)}</td><td class="num">${fmt(r.red)}</td><td class="num" style="color:${r.critical ? "#dc2626" : "inherit"};font-weight:700">${fmt(r.critical)}</td><td class="num">${compact(r.pop_max)}</td></tr>`).join("")}</tbody></table>`;
  $$("#tab-rivers tbody tr").forEach((tr) => tr.addEventListener("click", () => {
    const r = rs[+tr.dataset.i];
    $("#fRiver").value = r.river_name; switchTab("queue"); applyFilters();
    map.fitBounds([[r.minlat, r.minlon], [r.maxlat, r.maxlon]], { padding: [40, 40], maxZoom: 13 });
  }));
}
function renderLayersTab() {
  const groups = {};
  for (const [k, d] of Object.entries(LAYERS)) (groups[d.group] ||= []).push([k, d]);
  $("#tab-layers").innerHTML = `
    <div class="lgroup"><div class="section-title">Basemap</div>${Object.keys(BASE).map((b) => `<label class="lrow"><input type="radio" name="base" value="${esc(b)}" ${b === currentBase ? "checked" : ""}> ${esc(b)}</label>`).join("")}
      <p class="note">Use satellite imagery to check outfall locations, parallel canals and culverts before you confirm a link.</p></div>
    ${Object.entries(groups).map(([g, items]) => `<div class="lgroup"><div class="section-title">${esc(g)}</div>${items.map(([k, d]) => `<label class="lrow"><input type="checkbox" data-layer="${k}" ${d.on ? "checked" : ""}><span class="sw" style="${d.swatch}"></span><span>${esc(d.label)}</span></label>`).join("")}</div>`).join("")}`;
  $$('#tab-layers input[name=base]').forEach((r) => r.addEventListener("change", () => { map.removeLayer(BASE[currentBase]); currentBase = r.value; BASE[currentBase].addTo(map); }));
  $$("#tab-layers input[data-layer]").forEach((c) => c.addEventListener("change", () => toggleLayer(c.dataset.layer, c.checked)));
}
function renderLegend() {
  $("#legend").innerHTML = `<h4 id="legendToggle" style="cursor:pointer">Legend <span style="float:right">▾</span></h4><div id="legendBody">
    ${["T1", "T2", "T3", "T4", "none"].map((t) => `<div class="li"><span class="mk" style="background:${TIER[t].color};border-radius:50%"></span>Industrial: ${TIER[t].label}${t === "none" ? "" : " tier"}</div>`).join("")}
    <div class="li"><span class="mk" style="background:${CAT.landfill.color};border-radius:2px"></span>Landfill / dump / transfer station</div>
    <div class="li"><span class="mk" style="background:${CAT.wastewater.color};transform:rotate(45deg)"></span>Wastewater treatment plant</div>
    <div class="li"><span class="mk" style="background:#fff;border-radius:50%;box-shadow:0 0 0 2px #dc2626,0 0 0 4px rgba(220,38,38,.25)"></span>Critical to rivers (ring)</div>
    <div class="li"><span class="ln" style="background:linear-gradient(90deg,#b91c1c,#fbbf24)"></span>Critical downstream corridor</div>
    <div class="li"><span class="ln" style="background:#3b82c4"></span>River (width ∝ mean discharge)</div>
    <div class="li"><span class="ln" style="background:#0e7490"></span>Selected route · <span style="color:#16a34a">▢</span> 500 m zone</div></div>`;
  $("#legendToggle").onclick = () => { const b = $("#legendBody"); b.classList.toggle("hidden"); localStorage.setItem("rw_legend", b.classList.contains("hidden") ? "0" : "1"); };
  if (localStorage.getItem("rw_legend") === "0" || window.innerWidth < 1200) $("#legendBody").classList.add("hidden");
}
function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".tab-body").forEach((b) => b.classList.toggle("hidden", b.id !== "tab-" + name));
}
$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

// ------------------------------------------------------------------ site detail
function clearSelection() {
  selGroup.clearLayers();
  if (S.selected && S.markers.has(S.selected)) S.markers.get(S.selected).setIcon(markerIcon(S.markers.get(S.selected)._rw));
  S.selected = null; S.detail = null;
}
async function selectSite(id, fly = false) {
  if (!S.byId.has(id)) return;
  const prev = S.selected;
  clearSelection();
  S.selected = id;
  const m = S.markers.get(id);
  if (m) m.setIcon(markerIcon(m._rw, true));
  $$(".qrow").forEach((r) => r.classList.toggle("sel", r.dataset.id === id));
  history.replaceState(null, "", `#run=${encodeURIComponent(S.runId)}&site=${encodeURIComponent(id)}`);
  $("#drawer").classList.remove("hidden");
  $("#drawerBody").innerHTML = `<p class="note">Loading ${esc(id)}…</p>`;
  let d;
  try { d = await api(`/api/runs/${S.runId}/sites/${encodeURIComponent(id)}`); } catch (e) { $("#drawerBody").innerHTML = `<div class="warn">${esc(e.message)}</div>`; return; }
  if (S.selected !== id) return;
  S.detail = d;
  drawSelection(d, fly || prev === null);
  renderDrawer(d);
  setTimeout(() => map.invalidateSize(), 50);
}
function drawSelection(d, fit) {
  selGroup.clearLayers();
  const g = d.geo, p = d.properties;
  const bounds = L.latLngBounds([[p.lat, p.lon]]);
  if (g.zone) { const z = L.geoJSON(g.zone, { pane: "zones", interactive: false, style: { color: "#16a34a", weight: 1.5, fillColor: "#22c55e", fillOpacity: .16, dashArray: "4 3" } }).addTo(selGroup); bounds.extend(z.getBounds()); }
  if (g.corridor) {
    L.geoJSON(g.corridor, { pane: "sel", style: { color: "#fff", weight: 9, opacity: .9 } }).addTo(selGroup);
    const c = L.geoJSON(g.corridor, { pane: "sel", style: (f) => ({ color: `rgba(14,116,144,${0.45 + 0.55 * (f.properties.relative_index ?? 1)})`, weight: 5 }),
      onEachFeature: (f, l) => l.bindTooltip(`Reach ${f.properties.reach_id} · km ${fmt(f.properties.start_km, 1)}–${fmt(f.properties.end_km, 1)} · relative index ${fmt(f.properties.relative_index, 2)}`, { sticky: true, className: "rw-tip" }) }).addTo(selGroup);
    bounds.extend(c.getBounds());
  }
  for (const poi of d.pois || []) {
    L.circleMarker([poi.lat, poi.lon], { pane: "sel", radius: 4, color: "#fff", weight: 1, fillColor: POI[poi.t]?.color || "#333", fillOpacity: 1 })
      .bindTooltip(POI[poi.t]?.label.replace(/s$/, "") || poi.t, { className: "rw-tip" }).addTo(selGroup);
  }
  if (g.link) {
    const lf = g.link.features[0];
    if (lf) {
      const [lon, lat] = lf.geometry.coordinates;
      L.polyline([[p.lat, p.lon], [lat, lon]], { pane: "sel", color: "#ea580c", weight: 2, dashArray: "5 4" }).addTo(selGroup);
      L.circleMarker([lat, lon], { pane: "sel", radius: 6, color: "#fff", weight: 2, fillColor: "#ea580c", fillOpacity: 1 })
        .bindTooltip(`Snapped point on reach ${lf.properties.reach_id} (${fmt(lf.properties.snap_distance_m)} m, ${esc(lf.properties.snap_method)})`, { className: "rw-tip" }).addTo(selGroup);
    }
  }
  if (g.samples) {
    for (const f of g.samples.features) {
      const [lon, lat] = f.geometry.coordinates; const up = f.properties.side === "up";
      L.circle([lat, lon], { pane: "sel", radius: d.properties.sample_radius_m || 25, color: up ? "#2563eb" : "#dc2626", weight: 2, fillOpacity: .2 }).addTo(selGroup);
      L.marker([lat, lon], { pane: "sel", icon: L.divIcon({ className: "", iconSize: [36, 16], iconAnchor: [18, -6], html: `<div style="font:700 10px sans-serif;color:#fff;background:${up ? "#2563eb" : "#dc2626"};border-radius:4px;padding:1px 4px;text-align:center">${up ? "UP" : "DOWN"}</div>` }) })
        .bindTooltip(`Sentinel-2 sample (${up ? "upstream" : "downstream"}), 25 m radius`, { className: "rw-tip" }).addTo(selGroup);
    }
  }
  if (fit) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
}
function opticalChart(pairs) {
  if (!pairs.length) return "";
  const W = 400, H = 200, L0 = 40, R0 = 10, T0 = 24, B0 = 26;
  const xs = pairs.map((p) => new Date(p.date).getTime());
  const vals = pairs.flatMap((p) => [p.up, p.down]);
  let ymin = Math.min(...vals), ymax = Math.max(...vals); const pad = (ymax - ymin) * 0.1 || 0.02; ymin -= pad; ymax += pad;
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 - x0 < 864e5) { x0 -= 15 * 864e5; x1 += 15 * 864e5; }
  const X = (t) => L0 + ((t - x0) / Math.max(1, x1 - x0)) * (W - L0 - R0), Y = (v) => T0 + (1 - (v - ymin) / (ymax - ymin)) * (H - T0 - B0);
  const line = (k) => pairs.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p[k]).toFixed(1)}`).join("");
  const ticks = [ymin, (ymin + ymax) / 2, ymax];
  const months = []; const dd = new Date(x0); dd.setDate(1);
  while (dd.getTime() <= x1) { if (dd.getTime() >= x0) months.push(dd.getTime()); dd.setMonth(dd.getMonth() + 1); }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Upstream vs downstream NDTI">
    ${ticks.map((v) => `<line x1="${L0}" x2="${W - R0}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef2f7"/><text x="${L0 - 4}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="#64748b">${v.toFixed(2)}</text>`).join("")}
    ${months.map((t) => `<text x="${X(t)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="#64748b">${new Date(t).toLocaleString("en", { month: "short" })}</text>`).join("")}
    <path d="${line("up")}" fill="none" stroke="#2563eb" stroke-width="1.8"/>
    <path d="${line("down")}" fill="none" stroke="#dc2626" stroke-width="1.8"/>
    ${pairs.map((p, i) => `<circle cx="${X(xs[i])}" cy="${Y(p.up)}" r="2.2" fill="#2563eb"/><circle cx="${X(xs[i])}" cy="${Y(p.down)}" r="${p.unusual ? 5 : 2.2}" fill="${p.unusual ? "#fbbf24" : "#dc2626"}" stroke="${p.unusual ? "#b45309" : "none"}"><title>${p.date}: up ${p.up.toFixed(3)}, down ${p.down.toFixed(3)}, Δ ${p.delta.toFixed(3)}${p.unusual ? " (unusual)" : ""}</title></circle>`).join("")}
    <text x="${L0}" y="13" font-size="10" fill="#2563eb" font-weight="700">— upstream</text><text x="${L0 + 80}" y="13" font-size="10" fill="#dc2626" font-weight="700">— downstream</text>
    <text x="${L0 + 180}" y="13" font-size="10" fill="#b45309" font-weight="700">● unusual contrast (NDTI)</text>
  </svg>`;
}
function renderDrawer(d) {
  const p = d.properties, w = d.weights, rv = d.review;
  const tk = tierKey(p.hazard_tier); const isRef = p.role === "reference";
  const [acls, ahelp] = ACTION_HELP[p.action] || ["verify", ""];
  const comps = [["optical", "Optical contrast (Sentinel-2)", p.optical_score], ["severity", "Documented severity", p.severity_score],
    ["population", "Residents near corridor", p.population_score], ["poi", "Mapped facilities", p.poi_score]];
  const lo = p.score_low ?? 0, hi = p.score_high ?? 0;
  const pairs = d.pairs || [];
  const unusual = pairs.filter((x) => x.unusual).length;
  const catKey = isRef ? "reference" : (p.category || "industrial");
  $("#drawerBody").innerHTML = `
    <div class="d-title">${esc(p.name)}</div>
    <div class="d-id">${esc(p.site_id)}${p.osm_url ? ` · <a href="${esc(p.osm_url)}" target="_blank" rel="noopener">OpenStreetMap ↗</a>` : ""}</div>
    <div class="badge-row">
      <span class="pill ${CAT[catKey]?.pill || "grey"}">${esc(CAT[catKey]?.label || catKey)}</span>
      ${isRef ? "" : `<span class="pill ${TIER[tk].pill}">${TIER[tk].label} tier</span>`}
      ${p.critical ? '<span class="pill red">Critical to river</span>' : ""}
      ${String(p.link_reviewed) === "True" || p.link_reviewed === true ? '<span class="pill green">Link reviewed</span>' : '<span class="pill amber">Provisional link</span>'}
      ${p.rank ? `<span class="pill dark">Rank #${p.rank}</span>` : ""}
    </div>
    <div class="action ${acls}"><b>${esc(p.action)}</b>${esc(ahelp)}</div>

    <div class="d-sec"><h3>Review score <span class="note" style="text-transform:none">coverage ${fmt((p.component_coverage || 0) * 100)}% of weights</span></h3>
      <div class="score-wrap"><div class="score-big">${p.review_score != null ? fmt(p.review_score, 2) : `${fmt(lo, 2)}–${fmt(hi, 2)}`}</div>
      ${rangeBar(lo, hi, "score-range")}</div>
      <table class="comp"><tr><th>Component</th><th>Weight</th><th>Value</th></tr>
      ${comps.map(([k, label, v]) => `<tr><td>${label}</td><td>${w[k]}</td><td>${v == null ? '<span class="miss">missing</span>' : fmt(v, 2)}</td></tr>`).join("")}</table>
      <p class="note">Missing components are not counted as zero. The bar runs from the known lower bound to the highest score still possible.</p></div>

    <div class="d-sec"><h3>River link and downstream route</h3><table class="kv">
      <tr><td>Receiving reach</td><td>${p.reach_id != null ? `HYRIV_ID ${p.reach_id}` : "—"}${p.river_name ? ` · ${esc(p.river_name)}` : ""}</td></tr>
      <tr><td>Reach mean discharge</td><td>${p.reach_discharge_cms != null ? fmt(p.reach_discharge_cms, 1) + " m³/s (modelled)" : "—"}</td></tr>
      <tr><td>Snap distance / method</td><td>${p.snap_distance_m != null ? fmt(p.snap_distance_m) + " m" : "—"} · ${esc(p.snap_method)}</td></tr>
      <tr><td>Modelled route</td><td>${fmt(p.corridor_km, 1)} km · ${esc(p.corridor_stop_text)}</td></tr>
      <tr><td>Outfall confirmed</td><td>${String(p.outfall_source || "") ? esc(p.outfall_source) : "No documented outfall. The point is a footprint or centroid."}</td></tr>
    </table></div>

    <div class="d-sec"><h3>Proximity (${fmt(S.summary.config.buffer_m)} m around the corridor)</h3>
      <table class="kv"><tr><td>Estimated residents (WorldPop 2020)</td><td>${p.pop_near != null ? fmt(p.pop_near) : "—"} ${p.pop_coverage_complete === "True" || p.pop_coverage_complete === true ? "" : '<span class="pill amber">partial coverage</span>'}</td></tr></table>
      <div class="amen">${Object.keys(POI).map((k) => `<div><b style="color:${POI[k].color}">${p[k] != null ? fmt(p[k]) : "—"}</b><span>${POI[k].label}</span></div>`).join("")}</div>
      <p class="note">Mapped OSM amenities inside the zone. They are not evidence of contamination, and a mapped well is not necessarily a drinking-water source.</p></div>

    <div class="d-sec"><h3>Sentinel-2 optical contrast</h3>
      ${pairs.length ? `${opticalChart(pairs)}
        <table class="kv"><tr><td>Valid same-scene dates</td><td>${fmt(p.n_clear_dates)} ${p.n_clear_dates < d.min_pairs ? `<span class="pill amber">below ${d.min_pairs} = insufficient</span>` : ""}</td></tr>
        <tr><td>Median Δ NDTI (down − up)</td><td>${fmt(p.median_delta, 3)}</td></tr>
        <tr><td>Unusual dates / last</td><td>${unusual} · ${esc(p.last_unusual_date || "—")}</td></tr></table>
        <p class="note">An unusual contrast prompts independent review. It is not a verified event, and too few dates means insufficient observations, not clean water.</p>`
      : `<p class="note">${S.summary.observation_qa?.valid_paired_dates ? "No valid same-scene pairs for this site. The water pixels may be too few, or the probes may sit off the channel." : "This run has no satellite observations. Switch to the <b>Dhaka pilot</b> run, or export pairs with <code>riverwatch.s2_stac</code> or the Earth Engine script."}</p>`}</div>

    <div class="d-sec"><h3>Provenance</h3><table class="kv">
      <tr><td>Type (inferred)</td><td>${esc(p.industry_type || "—")}</td></tr>
      <tr><td>Severity source</td><td>${esc(p.severity_source || "— (missing)")}</td></tr>
      <tr><td>District / division</td><td>${esc(p.district || "—")} / ${esc(p.division || "—")}</td></tr>
      ${p.area_ha ? `<tr><td>Mapped footprint</td><td>${fmt(p.area_ha, 1)} ha</td></tr>` : ""}
      ${p.operator ? `<tr><td>Operator</td><td>${esc(p.operator)}</td></tr>` : ""}
      ${p.product ? `<tr><td>Product</td><td>${esc(p.product)}</td></tr>` : ""}
      <tr><td>Coordinates</td><td>${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}</td></tr>
    </table>
    <div class="btn-row">
      <button class="btn small" id="zoomBtn">Zoom to route</button>
      <button class="btn small" id="satBtn">Check on satellite</button>
      <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=map&center=${p.lat},${p.lon}&zoom=17&basemap=satellite">Google Maps ↗</a>
    </div></div>

    <div class="d-sec"><h3>Analyst review</h3><div class="review-box" id="reviewBox"></div></div>`;
  $("#zoomBtn").onclick = () => drawSelection(d, true);
  $("#satBtn").onclick = () => { map.removeLayer(BASE[currentBase]); currentBase = "Satellite (Esri)"; BASE[currentBase].addTo(map); map.setView([p.lat, p.lon], 16); renderLayersTab(); };
  renderReviewForm(d);
}
function renderReviewForm(d) {
  const box = $("#reviewBox"); const p = d.properties; const rv = d.review || {};
  if (!S.reviewEnabled) {
    box.innerHTML = `<p class="note">Review editing is turned off on this server. To turn it on, start the server with <code>RIVERWATCH_ADMIN_TOKEN</code>. Reviews follow README §3: confirm the outfall with a citation, check the flow direction, and override the receiving reach if needed. Then re-run.</p>${rv.saved_utc ? `<div class="ok">Existing review saved ${esc(rv.saved_utc.slice(0, 16))} by ${esc(rv.reviewer || "—")}</div>` : ""}`;
    return;
  }
  box.innerHTML = `
    ${rv.saved_utc ? `<div class="ok" style="margin:0 0 8px">Saved ${esc(rv.saved_utc.replace("T", " ").slice(0, 16))} UTC by ${esc(rv.reviewer || "—")}. Re-run the analysis to apply it.</div>` : ""}
    <form class="review-form" id="rvForm">
      <label class="inline"><input type="checkbox" name="outfall_confirmed" ${rv.outfall_confirmed ? "checked" : ""}> Outfall location documented (not a centroid or gate)</label>
      <label>Outfall source (citation, record ID or URL)<input type="text" name="outfall_source" value="${esc(rv.outfall_source || "")}" placeholder="e.g. DoE ETP inspection 2025-03, record #…"></label>
      <div class="two"><label>Outfall lon<input type="number" step="0.000001" name="outfall_lon" value="${rv.outfall_lon ?? ""}"></label><label>Outfall lat<input type="number" step="0.000001" name="outfall_lat" value="${rv.outfall_lat ?? ""}"></label></div>
      <button type="button" class="btn small" id="pickBtn">📍 Pick the outfall on the map</button>
      <label class="inline"><input type="checkbox" name="flow_reviewed" ${rv.flow_reviewed ? "checked" : ""}> Receiving reach and flow direction checked (leave unticked for tidal or reversing reaches)</label>
      <label>Receiving reach override (HYRIV_ID)<input type="text" name="receiving_reach_id" value="${esc(rv.receiving_reach_id || "")}" placeholder="current: ${p.reach_id ?? "none"}"></label>
      <div class="two"><label>Severity 0–1 (optional)<input type="number" min="0" max="1" step="0.01" name="severity" value="${rv.severity ?? ""}"></label><label>Severity source<input type="text" name="severity_source" value="${esc(rv.severity_source || "")}"></label></div>
      <label>Notes<textarea name="notes" rows="3">${esc(rv.notes || "")}</textarea></label>
      <label>Reviewer<input type="text" name="reviewer" value="${esc(rv.reviewer || S.reviewer)}"></label>
      <div class="btn-row"><button class="btn primary" type="submit">Save review</button>${rv.saved_utc ? '<button class="btn danger" type="button" id="rvDel">Delete review</button>' : ""}</div>
    </form>`;
  const form = $("#rvForm");
  $("#pickBtn").onclick = () => startPick(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!S.token) { askToken(); return; }
    const fd = new FormData(form); const num = (k) => fd.get(k) === "" ? null : Number(fd.get(k));
    const body = { outfall_confirmed: fd.get("outfall_confirmed") === "on", outfall_source: fd.get("outfall_source"), flow_reviewed: fd.get("flow_reviewed") === "on",
      receiving_reach_id: fd.get("receiving_reach_id").trim(), outfall_lon: num("outfall_lon"), outfall_lat: num("outfall_lat"), severity: num("severity"),
      severity_source: fd.get("severity_source"), notes: fd.get("notes"), reviewer: fd.get("reviewer") };
    S.reviewer = body.reviewer; localStorage.setItem("rw_reviewer", S.reviewer);
    try {
      await api(`/api/runs/${S.runId}/sites/${encodeURIComponent(p.site_id)}/review`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": S.token }, body: JSON.stringify(body) });
      toast("Review saved. Re-run the analysis to apply it.");
      S.summary.reviews = (S.summary.reviews || 0) + (d.review ? 0 : 1);
      d.review = { ...body, saved_utc: new Date().toISOString() };
      renderReviewForm(d); renderReviewBanner();
    } catch (err) { toast("Save failed: " + err.message, 6000); if (/token/i.test(err.message)) askToken(); }
  };
  const del = $("#rvDel");
  if (del) del.onclick = async () => {
    if (!confirm("Delete this review?")) return;
    try { await api(`/api/runs/${S.runId}/sites/${encodeURIComponent(p.site_id)}/review`, { method: "DELETE", headers: { "X-Admin-Token": S.token } }); d.review = null; S.summary.reviews = Math.max(0, (S.summary.reviews || 1) - 1); renderReviewForm(d); renderReviewBanner(); toast("Review deleted."); }
    catch (err) { toast(err.message); }
  };
}
function startPick(form) {
  S.picking = form; $("#pickHint").classList.remove("hidden"); map.getContainer().style.cursor = "crosshair";
}
function stopPick() { S.picking = false; $("#pickHint").classList.add("hidden"); map.getContainer().style.cursor = ""; }
map.on("click", (e) => {
  if (!S.picking) return;
  const f = S.picking; f.outfall_lon.value = e.latlng.lng.toFixed(6); f.outfall_lat.value = e.latlng.lat.toFixed(6);
  if (pickMarker) map.removeLayer(pickMarker);
  pickMarker = L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#0e7490", fillOpacity: 1, pane: "sel" }).bindTooltip("Proposed outfall").addTo(map);
  stopPick();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (S.picking) stopPick(); else if (!$("#modal").classList.contains("hidden")) closeModal(); } });

function renderReviewBanner() {
  const el = $("#reviewBanner"); if (!el) return;
  const n = S.summary?.reviews || 0; const job = S.summary?.job || {};
  if (!S.reviewEnabled) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="section-title">Analyst workflow</div>
    <div class="review-box"><div class="note">${fmt(n)} saved review(s) for this run. A re-run applies them to the site inputs and runs the RiverWatch pipeline again (README §3–4).</div>
    ${job.state === "running" ? `<div class="warn">Re-run in progress: ${esc(job.step || "")}…</div>` : ""}
    ${job.state === "failed" ? `<div class="warn">Last re-run failed: ${esc((job.error || "").slice(0, 300))}</div>` : ""}
    ${job.state === "done" ? `<div class="ok">Last re-run finished ${esc((job.finished_utc || "").slice(0, 16))} UTC</div>` : ""}
    <div class="btn-row"><button class="btn primary small" id="rerunBtn" ${job.state === "running" ? "disabled" : ""}>Re-run analysis</button>
    ${S.runs.find((r) => r.id === S.runId)?.id === "dhaka_pilot" ? `<button class="btn small" id="rerunS2Btn" ${job.state === "running" ? "disabled" : ""}>Re-run + refresh Sentinel-2</button>` : ""}</div></div>`;
  const go = async (s2) => {
    if (!S.token) { askToken(); return; }
    try { await api(`/api/runs/${S.runId}/rerun?refresh_s2=${s2}`, { method: "POST", headers: { "X-Admin-Token": S.token } }); toast("Re-run started"); pollJob(); }
    catch (e) { toast(e.message, 6000); }
  };
  $("#rerunBtn").onclick = () => go(false);
  const b2 = $("#rerunS2Btn"); if (b2) b2.onclick = () => go(true);
}
async function pollJob() {
  const j = await api(`/api/runs/${S.runId}/job`);
  S.summary.job = j; renderReviewBanner();
  if (j.state === "running") { setTimeout(pollJob, 3000); return; }
  if (j.state === "done") { toast("Re-run finished. Reloading results."); await loadRun(S.runId, S.selected); }
  if (j.state === "failed") toast("Re-run failed. See the Overview tab.", 6000);
}
function askToken() {
  openModal(`<h2>Analyst sign-in</h2><p>Enter the admin token set on the server (<code>RIVERWATCH_ADMIN_TOKEN</code>). It is kept only in this browser.</p>
    <input type="text" id="tokIn" style="width:100%" value="${esc(S.token)}" placeholder="admin token"><div class="btn-row"><button class="btn primary" id="tokSave">Save</button><button class="btn" id="tokClear">Sign out</button></div>`);
  $("#tokSave").onclick = () => { S.token = $("#tokIn").value.trim(); localStorage.setItem("rw_token", S.token); closeModal(); toast(S.token ? "Token saved" : "Signed out"); };
  $("#tokClear").onclick = () => { S.token = ""; localStorage.removeItem("rw_token"); closeModal(); toast("Signed out"); };
}

// ------------------------------------------------------------------ modals
function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modalClose").onclick = closeModal;
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
$("#btnToken").onclick = () => { if (!S.reviewEnabled) toast("Review editing is turned off on this server. Set RIVERWATCH_ADMIN_TOKEN to turn it on."); askToken(); };
$("#btnDownloads").onclick = () => {
  const r = S.runId;
  const items = [["review_queue.csv", "Review queue: geometry checks, contrasts, population, POIs, score components and action"],
    ["riverwatch.gpkg", "GeoPackage for QGIS: sites, rivers, links, sampling points, corridors, zones and union"],
    ["samples_gee.csv", "Sample points for Earth Engine or riverwatch.s2_stac"],
    ["paired_observations.csv", "Valid same-scene optical pairs"], ["manifest.json", "Run settings, inputs, counts and QA"]];
  openModal(`<h2>Downloads: ${esc(S.summary.run.title)}</h2><div class="dl-list">
    ${items.map(([f, t]) => `<a href="/api/runs/${r}/download/${f}"><span><b>${f}</b><br><small>${t}</small></span><span>⬇</span></a>`).join("")}
    <a href="/api/runs/${r}/export/sites.geojson"><span><b>sites.geojson</b><br><small>All sites with queue fields as GeoJSON points</small></span><span>⬇</span></a>
    <a href="/static/data/rivers_display.geojson" download><span><b>rivers_display.geojson</b><br><small>Display river network (HydroRIVERS, simplified)</small></span><span>⬇</span></a>
    <a href="/static/data/water_bodies.geojson" download><span><b>water_bodies.geojson</b><br><small>Named water bodies ≥ 0.5 km² (OSM)</small></span><span>⬇</span></a>
    <a href="/static/data/footprints.geojson" download><span><b>footprints.geojson</b><br><small>Landfill, wastewater plant and industrial footprints (OSM)</small></span><span>⬇</span></a></div>
    <p class="note">Data licences: OpenStreetMap (ODbL), HydroRIVERS (HydroSHEDS licence), WorldPop (CC BY 4.0), geoBoundaries (CC BY 4.0), Copernicus Sentinel-2. Check the data-sharing terms before you publish facility-level outputs.</p>`);
};
$("#btnMethods").onclick = async () => {
  let src = { sources: [] };
  try { src = await api("/api/sources"); } catch (_) { /* ignore */ }
  const cfg = S.summary.config;
  openModal(`<h2>Methods and data sources</h2>
  <p>RiverWatch BD is a <b>desk-screening</b> workflow. It links mapped waste sources to a directed river network, compares upstream and downstream optical conditions on the same Sentinel-2 scene, counts residents and mapped facilities near the modelled downstream reaches, and builds a review queue. <b>It does not identify a polluter, establish permit violations, measure contaminants, predict a plume or establish human exposure.</b></p>
  <h3>Pipeline</h3><ol>
  <li><b>Sources.</b> OSM <code>man_made=works</code>, <code>landuse=industrial</code>, <code>industrial=*</code>, tanneries and dyers, <code>landuse=landfill</code>, waste transfer stations and <code>man_made=wastewater_plant</code>, placed at their representative points. A footprint is <i>not</i> an outfall.</li>
  <li><b>Network.</b> Whole HydroRIVERS v1.0 reaches with <code>HYRIV_ID</code>/<code>NEXT_DOWN</code>. Flow orientation comes from the topology and endpoint continuity, not vertex order.</li>
  <li><b>Snap.</b> Each source goes to the nearest reach within ${fmt(cfg.snap_m)} m. It is flagged ambiguous when the second-nearest reach is within ${fmt(cfg.ambiguity_m)} m.</li>
  <li><b>Corridor.</b> The route follows one encoded downstream branch for ${fmt(cfg.corridor_km)} km and is buffered by ${fmt(cfg.buffer_m)} m. The buffer is a proximity scenario, not a flood extent or exposure boundary.</li>
  <li><b>Population.</b> WorldPop 2020 people-per-pixel cells whose centres fall in the zone. The headline uses the <b>union</b> of zones, so overlapping zones are not double-counted.</li>
  <li><b>Optical.</b> NDTI = (B4 − B3)/(B4 + B3) on clear (SCL 4/5/6) water (NDWI &gt; 0.05) pixels within ${fmt(cfg.sample_radius_m)} m of probes ${fmt(cfg.offset_m)} m upstream and downstream. The daily same-scene contrast is downstream − upstream, and the score uses its median. Scenes come from Earth Search (AWS); the doc's Earth Engine script produces the same output.</li>
  <li><b>Score.</b> Weights: optical ${cfg.weights.optical}, severity ${cfg.weights.severity}, population ${cfg.weights.population}, POI ${cfg.weights.poi}. Missing components give a range and are never treated as zero. A complete rank needs a reviewed link, an unbroken route and every weighted input.</li>
  <li><b>Critical to rivers</b> (map highlight): ${esc(S.summary.critical_rule)}.</li></ol>
  <h3>Severity rubric</h3><p>Categories follow ECR 1997 Schedule-1 / ECR 2023: Red 1.0, Orange-B 0.66, Orange-A 0.33, Green 0.10. They are <b>inferred from OSM names and tags</b> (data/severity_rubric.md), so they mark potential hazard only. Analysts can override them with documented values.</p>
  <h3>Data sources</h3><table><tr><th>Dataset</th><th>Licence</th><th>Used for</th><th>Known gaps</th></tr>
  ${src.sources.map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><small>${esc(s.provider)} · ${esc(s.version)}</small></td><td>${esc(s.license)}</td><td>${esc(s.used_for)}</td><td>${esc(s.known_gaps)}</td></tr>`).join("")}</table>
  <h3>Interpretation</h3><ul><li>A positive optical contrast can come from sediment, water colour, algae or ships. It is a review flag, not a discharge event.</li>
  <li>HydroRIVERS simplifies delta distributaries, so the Buriganga and Shitalakshya can be misplaced. Always check links against imagery.</li>
  <li>OSM coverage is uneven, and some features are outdated (for example, Hazaribagh tanneries relocated to Savar in 2017).</li>
  <li>A rank means "review this case first", not "this site pollutes". Keep questionable facility-level links in an internal queue and publish aggregates where needed.</li></ul>`);
};

// ------------------------------------------------------------------ search
const searchIn = $("#search"), searchOut = $("#searchResults");
searchIn.addEventListener("input", () => {
  const q = searchIn.value.trim().toLowerCase();
  if (q.length < 2) { searchOut.classList.remove("open"); return; }
  const hits = [];
  const rivers = (S.summary?.rivers || []).filter((r) => r.river_name.toLowerCase().includes(q)).slice(0, 3);
  for (const r of rivers) hits.push(`<div class="sr-item" data-river="${esc(r.river_name)}">🌊 <b>${esc(r.river_name)}</b><small>${fmt(r.sources)} linked sources · ${fmt(r.critical)} critical</small></div>`);
  for (const f of S.features) {
    const p = f.properties;
    if ((p.n + " " + p.id + " " + p.ds + " " + p.rn + " " + p.it).toLowerCase().includes(q)) {
      hits.push(`<div class="sr-item" data-id="${esc(p.id)}"><span style="color:${colorOf(p)}">●</span> ${esc(p.n)}${p.cr ? ' <span class="crit-tag">CRITICAL</span>' : ""}<small>${esc(p.it)} · ${esc(p.ds || "")} · ${esc(p.id)}</small></div>`);
      if (hits.length >= 15) break;
    }
  }
  searchOut.innerHTML = hits.join("") || '<div class="sr-item"><small>No matches</small></div>';
  searchOut.classList.add("open");
  $$(".sr-item", searchOut).forEach((el) => el.addEventListener("click", () => {
    searchOut.classList.remove("open");
    if (el.dataset.id) selectSite(el.dataset.id, true);
    else if (el.dataset.river) { const r = S.summary.rivers.find((x) => x.river_name === el.dataset.river); $("#fRiver").value = r.river_name; switchTab("queue"); applyFilters(); map.fitBounds([[r.minlat, r.minlon], [r.maxlat, r.maxlon]], { padding: [40, 40], maxZoom: 13 }); }
  }));
});
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) searchOut.classList.remove("open"); });

// ------------------------------------------------------------------ run loading
$("#drawerClose").onclick = () => { $("#drawer").classList.add("hidden"); clearSelection(); history.replaceState(null, "", `#run=${S.runId}`); $$(".qrow").forEach((r) => r.classList.remove("sel")); setTimeout(() => map.invalidateSize(), 50); };
["#fCat", "#fTier", "#fDiv", "#fSort", "#fCrit", "#fLinked", "#fHideBrick"].forEach((s) => $(s).addEventListener("change", () => applyFilters(s !== "#fSort")));
let riverT; $("#fRiver").addEventListener("input", () => { clearTimeout(riverT); riverT = setTimeout(() => applyFilters(), 300); });

async function loadRun(id, selectId = null) {
  status("Loading run…");
  clearSelection(); $("#drawer").classList.add("hidden");
  S.runId = id;
  if (unionLayer) { map.removeLayer(unionLayer); unionLayer = null; }
  if (heat) { map.removeLayer(heat); heat = null; }
  const [summary, sites, crit] = await Promise.all([api(`/api/runs/${id}/summary`), api(`/api/runs/${id}/sites`), api(`/api/runs/${id}/critical-corridors`)]);
  S.summary = summary; S.features = sites.features; S.byId = new Map(sites.features.map((f) => [f.properties.id, f]));
  const divs = [...new Set(S.features.map((f) => f.properties.dv).filter(Boolean))].sort();
  $("#fDiv").innerHTML = `<option value="">All divisions</option>` + divs.map((d) => `<option>${esc(d)}</option>`).join("");
  buildMarkers(); buildCritical(crit);
  renderOverview(); renderRivers(); applyFilters(true);
  if (LAYERS.union.on) applyDynamic("union");
  if (LAYERS.heat.on) applyDynamic("heat");
  history.replaceState(null, "", `#run=${encodeURIComponent(id)}`);
  if (selectId && S.byId.has(selectId)) selectSite(selectId, true);
  else if (S.features.length) {
    const b = L.latLngBounds(S.features.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]));
    map.fitBounds(b, { padding: [30, 30], maxZoom: 12 });
  }
  if (summary.job?.state === "running") pollJob();
  status();
}

async function init() {
  renderLegend(); renderLayersTab();
  for (const [k, d] of Object.entries(LAYERS)) if (d.on && !d.dynamic) toggleLayer(k, true);
  const r = await api("/api/runs");
  S.runs = r.runs; S.reviewEnabled = r.review_enabled; S.criticalSnap = r.critical_snap_m;
  $("#runSel").innerHTML = S.runs.map((x) => `<option value="${esc(x.id)}">${esc(x.title)} (${fmt(x.sites)} sites)</option>`).join("");
  const h = new URLSearchParams(location.hash.slice(1));
  const want = h.get("run") && S.runs.some((x) => x.id === h.get("run")) ? h.get("run") : (S.runs.find((x) => x.default) || S.runs[0])?.id;
  if (!want) { status("No completed runs found on the server."); return; }
  $("#runSel").value = want;
  $("#runSel").onchange = () => loadRun($("#runSel").value);
  await loadRun(want, h.get("site"));
}
init().catch((e) => { status("Failed to load: " + e.message); console.error(e); });
})();
