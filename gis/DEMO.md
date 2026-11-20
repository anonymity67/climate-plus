# Aquavelle map demo (QGIS + web app), about 4 minutes

**Story:** the rivers are polluted and the dry season is long, so Aquavelle stores the monsoon in shared rain tanks for the people who need it most.
QGIS shows **how the map is built**; the web app shows **what a planner does with it**. Both read the same data, so every number matches.

## Before you record (5 minutes, once)
1. Install **QGIS 3.34 LTR or newer** (qgis.org). Open `gis/aquavelle.qgz`, with `aquavelle.gpkg` in the same folder.
2. Start the web app (`web` folder: `npm.cmd run dev -- --host 127.0.0.1 --port 5195 --strictPort`) and open it in a browser next to QGIS.
3. In QGIS, click the **Map Themes** button at the top of the Layers panel (the eye icon). That list holds the five demo steps.
4. Turn on the **Identify Features** tool (the "i" cursor). You click map features with it.
5. The street map underneath needs internet. Everything else is local.

To switch a step: eye icon → pick the theme. To zoom: right-click the step's main layer → **Zoom to Layer(s)**.

---

## Step 1 · Problem (35 s)
**QGIS:** theme **1 Problem**. Zoom to *People exposed per 2 km block*.
**Click:** the darkest block in central Dhaka (**W0001**): 481,841 people · chance of severe pollution 0.84 · **404,024 expected exposed**.
**Say:** "Each square is 2 km. Red means many people live where the river is likely severely polluted: 12.6 million of 24.7 million here. They need another source of fresh water."
**Web app:** **Start**. Point at the three numbers and the rain chart.

## Step 2 · Resource (45 s)
**QGIS:** theme **2 Resource**. Zoom to *Average rain per year*.
**Say:** "Rain is the answer: 2,200 to 2,491 mm a year across the area. But look at the chart on the Start page: almost none falls from November to March. A tank has to store the monsoon."
**Click:** **Hub 4** (on the darkest blue): **2,474 mm** a year, reliability **0.93**. Then **Hub 14** (paler blue): **2,281 mm**, reliability **0.90**.
**Say:** "Wetter places make more reliable tanks. The model chose hub sites using exactly this."

## Step 3 · Need (40 s)
**QGIS:** theme **3 Need**. Zoom to *Chance of severe pollution (model)*.
**Say:** "Where should the rain go first? We had 1,495 river samples at 58 sites, seven measurements each. The dark-ringed dots are the sites; the squares are the Bayesian model filling the gaps. Red is where people can't rely on the river."
**Click:** the red site east of the city centre (24 samples): measured severity **0.435**, above the 0.35 severe line.
**Web app:** **Rivers** → tap a site → the green box says what failed.

## Step 4 · Solution (60 s)
**QGIS:** theme **4 Solution**. Zoom to *Rain hub*.
**Click:** **Hub 4**: 12,000 m³ tank · 5,000 people · reliability 0.93.
**Say:** "Fifteen shared rain hubs. Dashed lines lead to the blocks each one serves, in the most exposed areas. Each tank was tested against thousands of simulated rain years and has water every dry-season day in 90 to 93% of them."
**Web app:** **Rain hubs** → tick **Build 15 shared rain tanks**.
**Say:** "75,000 people get fresh rainwater. That's the first phase." Then tick **Clean the 10 worst river stretches**: "Add cleanup in the dashed zone and the share of people who don't depend on polluted river water goes from 49% to 66%."
**Web app (10 s):** **Rain tank** → **Calculate water balance**: "The same logic for a single school or clinic roof."

## Step 5 · Upstream (30 s)
**QGIS:** theme **5 Upstream**. Zoom to *Divisions*.
**Say:** "Across Bangladesh, 4,898 factories, dumps and wastewater plants are mapped; 171 are critical, within 500 m of a river. Downstream of them is where rain hubs are needed next."
**Web app:** **Sources** → river **Buriganga River** → tap the large red dot (**Battery Factory**, 98 m from the river, 354,600 people downstream).

## Close (20 s)
**Web app:** **Outage drill** for 10 seconds: "When a tank or pump fails, teams practise who gets water first."
**Say:** "Aquavelle: fresh water from the rain, where rivers can't be trusted."

---

## Ready-made map images
`gis/maps/Step_1_Problem.png` … `Step_5_Upstream.png` (A4 landscape, 150 dpi, made without the street map). To re-export with the street map: **Project → Layout Manager** → open a step → **Layout → Export as Image**.

## If something looks wrong
- **Layers have a red "!"**: `aquavelle.gpkg` is not next to the project. Put both in the same folder.
- **Grey background**: no internet for the street map. The data layers still show.
- **Labels overlap when zoomed out**: zoom in. Hub labels are sized for the Dhaka view.

## Rebuild after new data
From the `aquavelle` folder:
```
python gis/build_gpkg.py              # any Python with geopandas
python-qgis gis/build_project.py      # QGIS's Python (OSGeo4W Shell on Windows)
```
