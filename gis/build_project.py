"""Build gis/aquavelle.qgz: the Aquavelle map story in QGIS, styled like the web app.

Run with QGIS's Python, from the Aquavelle folder, after build_gpkg.py:
  Windows (OSGeo4W Shell):  python-qgis gis\\build_project.py
  Linux:                    python3 gis/build_project.py
It also exports one PNG per demo step to gis/maps/ (add --no-png to skip).

The project has five map themes, one per demo step (Problem, Resource, Need, Solution, Upstream),
and one print layout per step. Colours match the web app.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from qgis.core import (  # noqa: E402
    Qgis, QgsApplication, QgsProject, QgsVectorLayer, QgsRasterLayer, QgsCoordinateReferenceSystem,
    QgsGraduatedSymbolRenderer, QgsRendererRange, QgsRuleBasedRenderer, QgsSingleSymbolRenderer,
    QgsMarkerSymbol, QgsLineSymbol, QgsFillSymbol, QgsProperty, QgsSymbolLayer, QgsPalLayerSettings,
    QgsTextFormat, QgsTextBufferSettings, QgsVectorLayerSimpleLabeling, QgsMapThemeCollection, QgsPrintLayout,
    QgsLayoutItemMap, QgsLayoutItemLabel, QgsLayoutItemLegend, QgsLayoutItemScaleBar, QgsLayoutItemPicture,
    QgsLayoutPoint, QgsLayoutSize, QgsUnitTypes, QgsLayoutExporter, QgsCoordinateTransform,
    QgsReferencedRectangle, QgsLayerTreeModel, QgsLegendStyle,
)
from qgis.PyQt.QtGui import QColor, QFont  # noqa: E402

here = Path(__file__).resolve().parent
gpkg = here / "aquavelle.gpkg"
out = here / "aquavelle.qgz"
app = QgsApplication([], False)
app.initQgis()
P = QgsProject.instance()
P.clear()
P.setTitle("Aquavelle: rainwater harvesting for fresh water access")
P.setCrs(QgsCoordinateReferenceSystem("EPSG:3857"))
P.setFilePathStorage(Qgis.FilePathType.Relative)  # relative paths, so the folder can be moved

RED, ORANGE, AMBER, GREEN, GREY = "#a5402a", "#d47a38", "#c9a23a", "#458078", "#8a8f8c"
BLUE, HUB, ZONE, INK = "#2d7ea3", "#2f6cb0", "#5367a1", "#173d34"


def vlayer(name, title):
    lyr = QgsVectorLayer(f"{gpkg}|layername={name}", title, "ogr")
    assert lyr.isValid(), name
    return lyr


def fill(color, alpha=1.0, outline=None, width=0.0):
    s = QgsFillSymbol.createSimple({"color": color, "outline_style": "no" if outline is None else "solid",
                                     "outline_color": outline or color, "outline_width": str(width)})
    s.setOpacity(alpha)
    return s


def graduated(lyr, field, classes, alpha):
    ranges = [QgsRendererRange(lo, hi, fill(c, alpha), label) for lo, hi, c, label in classes]
    r = QgsGraduatedSymbolRenderer(field, ranges)
    lyr.setRenderer(r)


def labels(lyr, expr, size=8, color=INK):
    s = QgsPalLayerSettings()
    s.fieldName = expr
    s.isExpression = True
    f = QgsTextFormat()
    f.setFont(QFont("Arial"))
    f.setSize(size)
    f.setColor(QColor(color))
    b = QgsTextBufferSettings()
    b.setEnabled(True)
    b.setSize(0.8)
    b.setColor(QColor("white"))
    f.setBuffer(b)
    s.setFormat(f)
    lyr.setLabeling(QgsVectorLayerSimpleLabeling(s))
    lyr.setLabelsEnabled(True)


# ---------- basemap ----------
osm = QgsRasterLayer("type=xyz&url=https://tile.openstreetmap.org/{z}/{x}/{y}.png&zmax=19&zmin=0",
                     "OpenStreetMap (needs internet)", "wms")
if osm.isValid():
    osm.renderer().setOpacity(0.55)

# ---------- national: cause ----------
div = vlayer("bd_divisions", "Divisions")
div.setRenderer(QgsSingleSymbolRenderer(fill("#ffffff", 1.0, "#6b7570", 0.4)))
div.renderer().symbol().setOpacity(1)
div.renderer().symbol().symbolLayer(0).setFillColor(QColor(0, 0, 0, 0))
labels(div, '"division"', 9, "#4b5550")

rivers = vlayer("bd_rivers", "Rivers (HydroRIVERS)")
ls = QgsLineSymbol.createSimple({"color": "#6aa6c4", "width": "0.2"})
ls.symbolLayer(0).setDataDefinedProperty(QgsSymbolLayer.PropertyStrokeWidth,
                                         QgsProperty.fromExpression('min(0.9, 0.1 + 0.18*log10("flow_m3s"+1))'))
rivers.setRenderer(QgsSingleSymbolRenderer(ls))

cor = vlayer("critical_corridors", "10 km downstream of a critical source")
cor.setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple({"color": RED, "width": "0.7"})))
cor.renderer().symbol().setOpacity(0.75)

src = vlayer("pollution_sources", "Pollution sources (RiverWatch)")
root_rule = QgsRuleBasedRenderer.Rule(None)
for flt, label, color, size, outline in [
    ('"critical" = 0 AND "hazard" = \'Red\'', "High hazard (Red)", RED, 1.6, None),
    ('"critical" = 0 AND "hazard" LIKE \'Orange%\'', "Medium hazard (Orange)", ORANGE, 1.6, None),
    ('"critical" = 0 AND "hazard" = \'Green\'', "Low hazard (Green)", GREEN, 1.6, None),
    ('"critical" = 0 AND "hazard" = \'Not classified\'', "Not classified", GREY, 1.4, None),
    ('"critical" = 1', "Critical (high hazard, < 500 m from a river)", RED, 3.2, "white"),
]:
    sym = QgsMarkerSymbol.createSimple({"name": "circle", "color": color, "size": str(size),
                                        "outline_color": outline or color, "outline_width": "0.4" if outline else "0"})
    rule = QgsRuleBasedRenderer.Rule(sym, 0, 0, flt, label)
    root_rule.appendChild(rule)
rr = QgsRuleBasedRenderer(root_rule)  # critical rule is last, so it draws on top
src.setRenderer(rr)

# ---------- Dhaka: problem, method, solution ----------
chan = vlayer("dhaka_channels", "Rivers and canals (OpenStreetMap)")
chan.setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple({"color": BLUE, "width": "0.35"})))

blocks = vlayer("population_blocks", "People exposed per 2 km block")
graduated(blocks, "exposed_people", [
    (0, 5000, "#f6e3dc", "under 5,000"), (5000, 25000, "#e9b39f", "5,000 to 25,000"),
    (25000, 100000, "#d47a5c", "25,000 to 100,000"), (100000, 1e9, "#a5402a", "over 100,000"),
], 0.8)

rain = vlayer("rain_surface", "Average rain per year, mm (CHIRPS 2017–2021)")
graduated(rain, "rain_mm_year", [
    (0, 2260, "#d6e6f2", "under 2,260"), (2260, 2305, "#9cc3e0", "2,260 to 2,305"),
    (2305, 2350, "#5b9bcb", "2,305 to 2,350"), (2350, 9999, "#2f6cb0", "over 2,350"),
], 0.75)

surf = vlayer("river_severity_surface", "Chance of severe pollution (model)")
graduated(surf, "chance_severe", [
    (0, 0.34, GREEN, "unlikely (under 34%)"), (0.34, 0.5, AMBER, "possible (34 to 50%)"),
    (0.5, 0.7, ORANGE, "likely (50 to 70%)"), (0.7, 1.0001, RED, "very likely (over 70%)"),
], 0.6)

sites = vlayer("river_sites_measured", "Measured river sites (1,495 samples)")
root_rule = QgsRuleBasedRenderer.Rule(None)
for flt, label, color in [('"measured_severity" < 0.25', "cleaner", GREEN),
                          ('"measured_severity" >= 0.25 AND "measured_severity" < 0.35', "near the severe line", AMBER),
                          ('"measured_severity" >= 0.35', "severe (above 0.35)", RED)]:
    root_rule.appendChild(QgsRuleBasedRenderer.Rule(QgsMarkerSymbol.createSimple(
        {"name": "circle", "color": color, "size": "3.4", "outline_color": "#222222", "outline_width": "0.5"}), 0, 0, flt, label))
sites.setRenderer(QgsRuleBasedRenderer(root_rule))

zones = vlayer("cleanup_area", "Cleanup area (within 5 km of the top 10 cells)")
zones.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple(
    {"color": "83,103,161,40", "outline_color": ZONE, "outline_width": "0.7", "outline_style": "dash"})))
zcells = vlayer("cleanup_priority_cells", "Cleanup priority (1 = clean first)")
zcells.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple(
    {"name": "diamond", "color": ZONE, "size": "2.6", "outline_color": "white", "outline_width": "0.3"})))
labels(zcells, '"rank"', 7, ZONE)

links = vlayer("hub_service_links", "Hub to the area it serves")
links.setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple({"color": HUB, "width": "0.5", "line_style": "dash"})))

hubs = vlayer("rain_hubs", "Rain hub (serves 5,000 people)")
hubs.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple(
    {"name": "circle", "color": HUB, "size": "4.4", "outline_color": INK, "outline_width": "0.9"})))
labels(hubs, "'Hub ' || \"hub_id\" || '  ' || round(\"dry_season_reliability\"*100) || '%'", 7.5, INK)

served = vlayer("population_blocks", "Blocks a hub serves")
served.setSubsetString('"hub_cover" > 0')
served.setRenderer(QgsSingleSymbolRenderer(fill(INK, 0.9, "white", 0.3)))

# ---------- layer tree in story order ----------
tree = P.layerTreeRoot()
groups = [
    ("5 · Upstream: pollution sources (Bangladesh)", [src, cor, rivers, div]),
    ("4 · Solution: shared rain hubs", [hubs, links, served, zcells, zones]),
    ("3 · Need: where the river can't be relied on", [sites, surf]),
    ("2 · Resource: how much rain falls", [rain]),
    ("1 · Problem: people beside polluted rivers", [chan, blocks]),
]
for gname, layers in groups:
    g = tree.addGroup(gname)
    for lyr in layers:
        P.addMapLayer(lyr, False)
        g.addLayer(lyr)
if osm.isValid():
    P.addMapLayer(osm, False)
    tree.addLayer(osm)

# ---------- map themes: one per demo step ----------
themes = {
    "1 Problem": [osm, chan, blocks],
    "2 Resource": [osm, chan, rain, hubs],
    "3 Need": [osm, chan, surf, sites],
    "4 Solution": [osm, chan, surf, zones, zcells, served, links, hubs],
    "5 Upstream": [osm, div, rivers, cor, src],
}
tc = P.mapThemeCollection()
model = QgsLayerTreeModel(tree)
all_layers = [l for _, ls_ in groups for l in ls_] + ([osm] if osm.isValid() else [])
for name, on in themes.items():
    for lyr in all_layers:
        node = tree.findLayer(lyr.id())
        if node:
            node.setItemVisibilityChecked(lyr in on)
    for g in tree.findGroups():
        g.setItemVisibilityChecked(True)
    tc.insert(name, QgsMapThemeCollection.createThemeFromCurrentState(tree, model))
# leave the project opened on step 1
for lyr in all_layers:
    node = tree.findLayer(lyr.id())
    if node:
        node.setItemVisibilityChecked(lyr in themes["1 Problem"])

# ---------- extents (in EPSG:3857) ----------
to3857 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), P.crs(), P)
def ext(lyr, pad=0.04):
    e = to3857.transformBoundingBox(lyr.extent())
    e.grow(max(e.width(), e.height()) * pad)
    return e
dhaka = ext(surf)
bd = ext(div, 0.02)
hubs_view = ext(hubs, 0.25)
P.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(dhaka, P.crs()))

# ---------- print layouts ----------
steps = [
    ("1 Problem", dhaka, [blocks, chan],
     "1 · Problem: millions live beside polluted rivers",
     "Expected people exposed to a severely polluted river, per 2 km block. 12.6 million of 24.7 million in the Dhaka study area."),
    ("2 Resource", dhaka, [rain, hubs],
     "2 · Resource: plenty of rain, at the wrong time",
     "2,200 to 2,491 mm of rain a year across the area (CHIRPS 2017–2021), but only 134 mm in the five driest months. Tanks must store the monsoon."),
    ("3 Need", dhaka, [sites, surf, chan],
     "3 · Need: where the river can't be relied on",
     "1,495 samples at 58 sites, seven measurements each. A Bayesian spatial model fills the gaps: red is where people most need rainwater instead."),
    ("4 Solution", hubs_view, [hubs, links, served, zcells, zones, surf],
     "4 · Solution: shared rain hubs",
     "15 shared rain tanks of 12,000 m³ supply 75,000 people in the most exposed areas, with water every dry-season day in 90 to 93% of years."),
    ("5 Upstream", bd, [src, cor, rivers],
     "5 · Upstream: where river pollution comes from",
     "4,898 mapped factories, dumps and wastewater plants; 171 are critical. Downstream of them, people need rainwater most. A lead to check, not proof."),
]
lm = P.layoutManager()
for theme, extent, legend_layers, title, sub in steps:
    lay = QgsPrintLayout(P)
    lay.initializeDefaults()
    lay.setName("Step " + theme)
    page = lay.pageCollection().page(0)
    page.setPageSize(QgsLayoutSize(297, 210, QgsUnitTypes.LayoutMillimeters))
    mp = QgsLayoutItemMap(lay)
    mp.attemptMove(QgsLayoutPoint(8, 30, QgsUnitTypes.LayoutMillimeters))
    mp.attemptResize(QgsLayoutSize(200, 172, QgsUnitTypes.LayoutMillimeters))
    mp.setCrs(P.crs())
    mp.zoomToExtent(extent)
    mp.setFollowVisibilityPreset(True)
    mp.setFollowVisibilityPresetName(theme)
    mp.setFrameEnabled(True)
    lay.addLayoutItem(mp)
    for text, y, size, bold in [(title, 8, 20, True), (sub, 19, 10, False)]:
        lb = QgsLayoutItemLabel(lay)
        lb.setText(text)
        f = QgsTextFormat()
        f.setFont(QFont("Arial", size, QFont.Bold if bold else QFont.Normal))
        f.setSize(size)
        f.setColor(QColor(INK))
        lb.setTextFormat(f)
        lb.attemptMove(QgsLayoutPoint(8, y, QgsUnitTypes.LayoutMillimeters))
        lb.attemptResize(QgsLayoutSize(281, 11 if bold else 10, QgsUnitTypes.LayoutMillimeters))
        lay.addLayoutItem(lb)
    lg = QgsLayoutItemLegend(lay)
    lg.setTitle("Legend")
    lg.setLinkedMap(mp)
    lg.setAutoUpdateModel(False)
    root = lg.model().rootGroup()
    root.removeAllChildren()
    for lyr in legend_layers:
        root.addLayer(lyr)
    lg.attemptMove(QgsLayoutPoint(214, 30, QgsUnitTypes.LayoutMillimeters))
    lg.setColumnCount(1)
    for st, size in ((QgsLegendStyle.Title, 13), (QgsLegendStyle.Group, 10), (QgsLegendStyle.Subgroup, 10), (QgsLegendStyle.SymbolLabel, 9)):
        tf = QgsTextFormat()
        tf.setFont(QFont("Arial"))
        tf.setSize(size)
        tf.setColor(QColor(INK))
        lg.rstyle(st).setTextFormat(tf)
    lg.setMaximumSymbolSize(5)
    lg.setWrapString("|")
    lay.addLayoutItem(lg)
    sb = QgsLayoutItemScaleBar(lay)
    sb.setStyle("Single Box")
    sb.setLinkedMap(mp)
    sb.setUnits(QgsUnitTypes.DistanceKilometers)
    sb.setUnitLabel("km")
    sb.setMapUnitsPerScaleBarUnit(1000)
    sb.setNumberOfSegments(2)
    sb.setNumberOfSegmentsLeft(0)
    sb.applyDefaultSize(QgsUnitTypes.DistanceKilometers)
    sb.setUnitLabel("km")
    sb.attemptMove(QgsLayoutPoint(12, 188, QgsUnitTypes.LayoutMillimeters))
    lay.addLayoutItem(sb)
    na = QgsLayoutItemPicture(lay)
    na.setPicturePath(":/images/north_arrows/layout_default_north_arrow.svg")
    na.attemptMove(QgsLayoutPoint(194, 32, QgsUnitTypes.LayoutMillimeters))
    na.attemptResize(QgsLayoutSize(10, 14, QgsUnitTypes.LayoutMillimeters))
    lay.addLayoutItem(na)
    cr = QgsLayoutItemLabel(lay)
    cr.setText("Aquavelle · Data: OpenStreetMap contributors, HydroRIVERS, WorldPop 2020, CHIRPS, Dhaka river dataset (Mendeley, CC BY 4.0). Model estimates and desk screening; confirm on the ground.")
    cf = QgsTextFormat()
    cf.setFont(QFont("Arial", 7))
    cf.setSize(7)
    cf.setColor(QColor("#5b6460"))
    cr.setTextFormat(cf)
    cr.attemptMove(QgsLayoutPoint(214, 180, QgsUnitTypes.LayoutMillimeters))
    cr.attemptResize(QgsLayoutSize(76, 24, QgsUnitTypes.LayoutMillimeters))
    lay.addLayoutItem(cr)
    lm.addLayout(lay)

P.write(str(out))
print("wrote", out, "| layouts:", [l.name() for l in lm.printLayouts()], "| themes:", tc.mapThemes())

if "--no-png" not in sys.argv:
    (here / "maps").mkdir(exist_ok=True)
    for lay in lm.printLayouts():
        f = here / "maps" / (lay.name().replace(" ", "_") + ".png")
        s = QgsLayoutExporter.ImageExportSettings()
        s.dpi = 150
        r = QgsLayoutExporter(lay).exportToImage(str(f), s)
        print(f.name, "ok" if r == QgsLayoutExporter.Success else f"error {r}")
app.exitQgis()
