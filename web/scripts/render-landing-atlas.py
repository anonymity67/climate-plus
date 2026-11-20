from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public"
WIDTH, HEIGHT = 1000, 780
WEST, EAST, SOUTH, NORTH = 90.17, 90.61, 23.62, 23.934
im = Image.new("RGB", (WIDTH, HEIGHT), "#103e3a")
draw = ImageDraw.Draw(im)

def project(lon, lat):
    return ((lon - WEST) / (EAST - WEST) * WIDTH, (NORTH - lat) / (NORTH - SOUTH) * HEIGHT)

for x in range(40, WIDTH, 53):
    draw.line((x, 0, x, HEIGHT), fill="#1a4c46", width=1)
for y in range(25, HEIGHT, 53):
    draw.line((0, y, WIDTH, y), fill="#1a4c46", width=1)

streams = json.loads((ROOT / "data/streams/dhaka.json").read_text(encoding="utf-8"))
for way in streams["ways"]:
    path = [project(*p) for p in way["geometry"]["coordinates"]]
    major = len(path) >= 18
    draw.line(path, fill="#569992" if major else "#336d65", width=4 if major else 2)

evidence = json.loads((ROOT / "data/water-evidence.json").read_text(encoding="utf-8"))
for lon, lat in sorted({(o["longitude"], o["latitude"]) for o in evidence["observations"]}):
    if WEST < lon < EAST and SOUTH < lat < NORTH:
        x, y = project(lon, lat)
        draw.ellipse((x-7, y-7, x+7, y+7), fill="#173e38", outline="#b5dfb9")
        draw.ellipse((x-3, y-3, x+3, y+3), fill="#c4edd0")

im.save(ROOT / "images/dhaka-river-atlas.webp", quality=85, method=6)

# National cover, using the same map data and priority sites as the atlas.
national = ROOT / "data/riverwatch"
base = json.loads((national / "bangladesh.json").read_text(encoding="utf-8"))
sites = json.loads((national / "national.json").read_text(encoding="utf-8"))["sites"]
im = Image.new("RGB", (WIDTH, HEIGHT), "#103e3a")
draw = ImageDraw.Draw(im)

def national_point(lon, lat):
    return (500 + (lon - 90.27) * 103, 405 - (lat - 23.68) * 102)

for x in range(25, WIDTH, 50):
    draw.line((x, 0, x, HEIGHT), fill="#194b45", width=1)
for y in range(28, HEIGHT, 51):
    draw.line((0, y, WIDTH, y), fill="#194b45", width=1)

extra = json.loads((national / "waterways-detail.json").read_text(encoding="utf-8"))
for item in base["features"] + extra["features"]:
    layer = item["properties"]["layer"]
    g = item["geometry"]
    coords = g["coordinates"]
    if layer == "divisions":
        polygons = [coords] if g["type"] == "Polygon" else coords
        for rings in polygons:
            draw.polygon([national_point(*p) for p in rings[0]], fill="#20544d", outline="#74a195")
    elif layer in ("rivers_display", "osm_rivers"):
        lines = [coords] if g["type"] == "LineString" else coords
        for line in lines:
            draw.line([national_point(*p) for p in line], fill="#6ca39f" if layer == "osm_rivers" else "#4e8d85", width=1)

for s in sites:
    if s["priority"]:
        x, y = national_point(*s["point"])
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill="#e6c693", outline="#254d44")
im.save(ROOT / "images/bangladesh-river-atlas.webp", quality=85, method=6)
