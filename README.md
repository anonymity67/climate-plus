# Aquavelle

**Watch:** [20-second overview](media/Aquavelle-20s.mp4) · **Deploy:** `web/docs/DEPLOY-AQUAVELLE.md`, or push to `main` after adding the three Cloudflare secrets listed in `.github/workflows/aquavelle.yml`.

The October 2026 IEEE ClimateChain version of Climate++ is kept at the tag `climatechain-oct-2026`.

**Store the rain. Have water all year.** Aquavelle is a rainwater-harvesting planner for Bangladesh, in Bangla and English. Many rivers are too polluted to rely on, and only 134 of 2,301 mm of yearly rain falls in the five driest months (Dhaka area, CHIRPS 2017–2021). Aquavelle helps households, schools, NGOs and local government plan rain tanks, choose shared tank sites and keep a backup water source.

- **Rainwater:** size a tank for a home, shared site or school, see which months need backup water, and use the Borsha-Bandhu construction drawings.
- **Shared tanks:** 15 proposed shared tanks in the Dhaka study area, chosen by a Bayesian model of rainfall and river pollution, for about 75,000 people; each met its dry-season target in 90–93% of simulated years. Model estimates; sites need field checks.
- **Find water / Check before you drink:** recorded backup sources and what to ask before using any source, including stored rain.
- **Field teams:** river pollution atlas, river measurements, outage drill and private field records.

`gis/DEMO.md` is a 4-minute demo script that walks through the same data in QGIS and in the app.

## Run locally

Install Node.js 24 LTS. In PowerShell:

```powershell
cd web
npm.cmd ci
npm.cmd run setup:local
npm.cmd run build
npm.cmd run serve:local -- --port 5198
```

Open http://127.0.0.1:5198/. Use `npm` on macOS or Linux. See [deployment and verification](web/docs/DEPLOY-AQUAVELLE.md) for Cloudflare Workers, D1 and optional operator sign-in.

## Data and methods

| Source | What it supports |
| --- | --- |
| WPdx historical inventory | 20,084 recorded points in 46 district and subdistrict combinations. Records span 2014–2019 and are concentrated in Cox’s Bazar. Current service and quality require local checks. |
| Dhaka river dataset | 1,495 dated observations at original coordinates from 2017–2021. The site reader uses a partial fishery comparison. This cannot establish current drinking-water safety. |
| RainHub, CHIRPS and WorldPop | A Dhaka-area scenario for 15 proposed shared tanks. Its estimated coverage and reliability use historical inputs and design assumptions. |
| RiverWatch, OpenStreetMap and HydroRIVERS | A screening map of possible inspection leads. Sites, modelled river links and nearby population require field verification before any attribution or exposure claim. |
| Borsha-Bandhu | Roof, tank and daily-use examples for home, shared and school planning. The calculator estimates water volume under the rainfall people enter. Its results are independent of the workbook’s monthly reliability model. |
| District WASH Operations Playbook and Climate Plus | Outage tabletop practice, field forms and simulated delivery planning. Practice results do not describe a real service or a live hazard. |

The [release plan](web/docs/AQUAVELLE-RELEASE-PLAN.md) records the archive decisions and reproduction limits. [Sources and licences](web/ATTRIBUTIONS.md) lists the original data providers.

## Project layout

- `web/` contains the bilingual public entry points, field workspace, Worker API and D1 migrations.
- `model/rainhub/` contains the R modelling pipeline, archived outputs and restored CHIRPS and WorldPop inputs.
- `services/riverwatch/` contains the RiverWatch analysis pipeline and optional analyst service.
- `gis/` contains the QGIS project, GeoPackage and offline map images.

Project team. Ahnaf Antar and Munim Hasnat.
