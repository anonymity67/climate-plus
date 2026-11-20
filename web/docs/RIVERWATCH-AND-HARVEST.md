# Bangladesh river atlas and rainwater planning

## RiverWatch evidence

The interactive map uses the completed RiverWatch GeoPackages and review queues bundled in the workspace. The national run contains 4,898 OpenStreetMap-mapped sites, 4,331 candidate river links and 21,972 modelled trace segments. RiverWatch's original priority rule selects 171 leads. Of those, 31 have a candidate link but no drawable trace, and the inspector shows why. Reference reaches appear only in the Dhaka pilot.

The Dhaka–Narayanganj pilot contains 29 mapped sites, two comparison reaches and 109 valid same-scene Sentinel-2 pairs from November 2025 through April 2026. The chart shows downstream minus upstream water appearance and retains RiverWatch's flagged dates. Six usable dates are needed for the optical check. Neither run has completed review rankings. Confirm outlets and flow direction independently before tracing a suspected discharge. HydroRIVERS provides mapped geometry and topology. Actual flow can differ by time of year, tidal state or local structures. [HydroRIVERS](https://www.hydrosheds.org/products/hydrorivers) · [Sentinel-2](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2)

The dashed blue line follows the exported RiverWatch geometry. Optional shading shows the study's 500 m proximity area. Counts use WorldPop 2020 and mapped OpenStreetMap features. A site count may be partial. The combined population estimate uses the original run's union of the areas, which avoids adding overlapping site counts. All these figures describe proximity. Exposure and attribution require field evidence.

Historical field measurements retain the original study coordinates and dates. The inspector offers stations within 500 m of any segment of the selected trace, using a local point-to-line distance. It keeps those measurements separate from satellite image comparisons. Distance on the map alone cannot establish a shared channel or cause.

The country map uses the bundled eight division outlines, 64 district outlines and generalized river lines. Detailed OpenStreetMap waterways and water bodies load on zoom. Selected evidence only loads the relevant site-record shard. The atlas works without external map tile calls. Named facilities and topological links are screening inputs. The app excludes the synthetic demo run.

## Borsha-Bandhu

The planner uses the supplied five regional monthly rainfall profiles and three roof/tank/demand examples. The original institutional bill of materials pairs 400 users with 1,000 litres/day. The editable example follows the manuals’ 5 litres per person per day and starts at 2,000 litres/day for 400 users. The original workbook and drawings retain their supplied figures. The app repeats the monthly water balance to a stable carry-over, using the source model's 80% collection factor. The lower-rain scenario reduces every month by 25%. That factor is a sensitivity scenario, with no estimated probability. The dry-season subtotal uses November to May, 212 days in the non-leap monthly calendar.

The monthly calculation applies rainfall before each month's demand, with overflow limited by tank capacity. Use the daily calculator when the sequence of dry and wet days matters. Neither calculation establishes water quality, structural suitability, or reliability at a specific installation.

There are seven original drawings (D-01 through D-07), three field manuals and the sizing and costing workbook. The app makes these files available as engineering references, with bilingual explanations and a short field checklist. The original drawings and reference documents are in English. Verify local site conditions and prices, assign maintenance, and arrange drinking-water testing and suitable treatment with local professionals. [WHO rainwater sanitary inspection package](https://www.who.int/publications/m/item/sanitary-inspection-package-%28drinking-water%29--rainwater-collection-and-storage)

## Rebuild from the project files

Run these commands in the web directory. The two RiverWatch runs are expected under the sibling `services/riverwatch` directory. The rain archive is expected at the workspace root.

```powershell
python -m pip install "shapely>=2.1" pyproj Pillow
python scripts/export-riverwatch-atlas.py
python scripts/import-harvest-references.py
python scripts/render-landing-atlas.py
npm.cmd run check
```

The web build uses the generated assets. Running the app does not require Python. Reference-file digests are in `public/data/borsha-bandhu-assets.json` and the handoff manifest covers the released web files.

## Release verification

- The production build and all 145 tests passed, including trace availability for all 4,898 mapped sites, the 109 original satellite date pairs, and seasonal balance checks against the Python model for 15 profile and tank combinations.
- The map data initially loads about 285 kB combined when gzipped. Additional waterways and selected site geometry are fetched as needed. All eleven original drawings and reference files matched their supplied bytes and SHA-256 digests.
- The compiled Worker passed 27 HTTP checks and Wrangler accepted the deployment dry run. Browser checks covered the atlas, site drill-down, historical sample links, both rainwater calculators, drawing selection, downloads and Bangla layouts at 320–1440 px. Axe reported no violations in five tested states.
