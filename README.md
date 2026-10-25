# Climate++

**Keep essential water flowing when a storm, flood or salt intrusion hits.**

Climate++ is a research prototype built for the IEEE ClimateChain 2026 hackathon. It helps people who deal with fresh-water distribution in coastal Bangladesh see three things before a calamity forces the decision:

1. **Who gets water first.** Set a budget and a school floor, and the Continuity desk calculates a fair seven-day response.
2. **Which deliveries slow down.** The Response map shows how a Moderate or Severe storm delays a delivery on real roads, labelled _open_, _delayed_ or _extreme delay_.
3. **Where river pollution is highest near customers.** The pollution tabs show measured river readings and a pollution-intensity grid, and look up the nearest points to any customer.

|                |                                                                               |
| -------------- | ----------------------------------------------------------------------------- |
| **Live demo**  | https://tourmaline-squirrel-94d50f.netlify.app                                |                                                           |
| **Team**       | Ahnaf Antar (GIS and response map) · Munim Hasnat (water evidence) |
| **Status**     | Research prototype. Scenario data. No live alerts.                            |

> **Please read this first.** Storm areas, storm delays and the service network are **scenarios, not forecasts**. The pollution grid is a publisher score with no sampling date, unit or laboratory validation: it helps decide where to look first and is **not a drinking-water or health rating**. Climate++ has no ordering, payment or dispatch feature. The next step is a field pilot with a local operator.

## What you can do in the app

| Tab                          | What it does                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Continuity desk**          | Pick Storm, Salinity or Dry. Set the budget, a demand assumption (0.8x to 1.4x) and a school daily floor. Calculate a fair seven-day response.           |
| **Response map**             | Five regions on real OpenStreetMap roads. Choose Storm, then Moderate or Severe, and see the delivery detour and its delay label. Block a road yourself. |
| **Pollution monitoring**     | Historical Dhaka river measurements (pH, dissolved oxygen, COD) screened against fisheries objectives, plus source investigation and model validation.   |
| **Customer pollution check** | All 9,958 pollution-intensity grid points. Click a place or add customers to see the nearest class, the worst class within 1, 2 or 5 km, and export CSV. |
| **Compare responses**        | The calculated plan beside the reference plan, with the trade-offs explicit.                                                                             |
| **Action register**          | Assign actions. Completion is recorded separately from confirmation.                                                                                     |
| **Resident notice**          | A printable water-service notice (English and Bangla) for confirmed plans only.                                                                          |
| **Evidence & trust**         | Sources, assumptions and a verifiable receipt for the plan.                                                                                              |

### How the storm delay is calculated

For the same supplier-to-reserve trip, `factor = scenario trip time / clear-road trip time`.

- **Open:** below 1.2x. **Delayed:** 1.2x or more. **Extreme delay:** 1.75x or more. **No route:** the destination is unreachable.
- **Dacope:** the roads touched by each storm area close, so the detour comes from the original polygons (7.89 km clear, 11.2 km moderate at 1.42x, 15.9 km severe at 2.02x).
- **Ukhia, Chattogram, Khulna, Tongi:** a synthetic storm area on the clear route slows the roads inside it (moderate 50% speed, severe 20%). The areas are invented for the scenario.
- Routes are calculated in the browser at an assumed 25 km/h with road-type caps. They are modelled times, not traffic estimates.

### How the pollution check works

The grid comes from the Kaggle dataset _Bangladesh River Pollution GIS_ (A.B.M. Mostakim Niloy, MIT licence). For a customer location the app finds the nearest grid points. If the nearest point is more than 1.5 km away, the place is reported as **outside the grid**, never as clean. The grid covers roughly Dhaka, Gazipur, Narsingdi, Brahmanbaria and Sylhet; most of the five regions fall outside it.

## Run it on your computer

Install **Node.js 24 LTS** (the app accepts Node 22.12 to 24). Open the project folder in VS Code, then in a terminal:

```powershell
npm ci
npm run check
npm run dev
```

Open **http://127.0.0.1:5173**. Stop with Ctrl+C.

- On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd` for the same commands.
- For a production preview: `npm run build` then `npm run preview`, and open http://127.0.0.1:4173.
- Deployments must serve the `dist` folder at the **website root**, because data files load from `/data/`. Opening `index.html` directly does not work. GitHub Pages project sites serve from a subfolder and will break.
- Map background tiles need internet. Without it the roads, routes and pollution points still show.

No API key, account or server is needed. Routes are calculated in the browser, entered points stay in the session (export the GeoJSON to keep them), and there is no central database.

## Commands

| Command               | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `npm ci`              | Install the exact locked dependencies                            |
| `npm run dev`         | Run the app on port 5173                                         |
| `npm test`            | Run the tests                                                    |
| `npm run check`       | Check formatting, tests, production build and frozen data hashes |
| `npm run verify:data` | Check the frozen data files against their recorded hashes        |
| `npm run build`       | Build the app into `dist`                                        |

To regenerate the storm-severity scenario files run `node scripts/build-storm-severity.mjs` (add `--check` to verify without writing).

## Project layout

```text
src/
  App.jsx                    App shell and the Continuity desk workflows
  response-map/              Response map and Customer pollution check (storm delay, routing UI, pollution lookup)
  routing/engine.mjs         Road-graph shortest-path engine
  PollutionPanel.jsx         Measured water evidence and investigation interface
  engine.mjs                 Continuity planning and receipt functions
  water-engine.mjs           Screening, mass balance and dissolved-oxygen model
public/data/
  regions/                   Road graphs and scenarios for the five regions
  river-pollution-context.json   Pollution-intensity grid (9,958 points)
research/                    Original data snapshots and acquisition records
scripts/                     Reproduction, integrity checks and the storm-severity builder
tests/                       Unit, regression and data-parity tests
docs/ documentation/         Architecture, data contracts and the scientific write-ups
DATASETS.json                Sources, versions, authors, rights and hashes
DATA-MANIFEST.json           Checksums of the frozen data files
```

## Data and credits

| Source                                                               | Used for                                           | Terms                  |
| -------------------------------------------------------------------- | -------------------------------------------------- | ---------------------- |
| OpenStreetMap contributors                                           | Road networks for all five regions and the basemap | ODbL 1.0               |
| Kaggle, _Bangladesh River Pollution GIS_ (A.B.M. Mostakim Niloy)     | Pollution-intensity grid                           | MIT                    |
| Dhaka river water quality, Mendeley Data (DOI 10.17632/xftpv7jvx3.1) | Measured pH, DO, COD, 2017 to 2021                 | CC BY 4.0              |
| BASIS Sylhet survey, Mendeley Data (DOI 10.17632/bncwnj8yjt.2)       | Velocity points and mixing groups                  | CC BY 4.0              |
| NASA POWER and NOAA CPC                                              | Rainfall and climate-feature experiments           | Source terms           |
| Bangladesh ECR 2023 Gazette                                          | Fisheries objectives (pH, DO, COD)                 | Government publication |

Full authors, dates, units and transformations are in `DATASETS.json`, `ATTRIBUTIONS.md` and `documentation/DATASETS.md`. No data provider endorses Climate++. The Dacope boundary file in `research/gis/v1/` has an unconfirmed licence; see `LICENSE-NOTICE.md`.

## Limits

- The service networks, assets and storm areas are fictional or synthetic scenarios placed on real roads. They are not surveyed facilities or forecasts.
- Travel times assume 25 km/h with road caps. Current traffic, flooding and road access are unknown.
- The pollution grid has no sampling date, unit or laboratory validation. Measured readings are historical and do not establish whether water is safe to drink.
- No production authentication, server storage, dispatch, SMS or current contamination alerts exist.
- The dissolved-oxygen model was tested on familiar historical locations, not on unseen river basins.

## Licence

Code released under the **MIT Licence** (see `LICENSE`). Third-party data keeps its own terms, listed above.

## Learn more

`docs/ARCHITECTURE.md`, `docs/DATA-CONTRACTS.md`, `docs/GIS-EXTENSION.md` and `docs/CONTRIBUTING.md` explain how to extend it. `documentation/PILOT-AND-VENTURE.md` describes the field-pilot plan.
