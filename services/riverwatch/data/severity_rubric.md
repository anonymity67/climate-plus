# RiverWatch BD — severity rubric v1 (category-based potential hazard)

The pipeline accepts an optional 0–1 `severity` per site, and it only counts when
`severity_source` cites a documented rubric (README, "Recommended site columns").
This file is that rubric for the national screening run. **It describes potential
hazard by industry category. It does not measure discharge, show non-compliance, or
show that any facility pollutes.**

## Basis

Bangladesh *Environment Conservation Rules* (ECR) 1997, Schedule‑1, and the
*Environment Conservation Rules 2023*, both from the Department of Environment (DoE).
They group industrial units and projects into Green, Orange‑A (Yellow in 2023),
Orange‑B (Orange in 2023) and Red categories, based on how much pollution the
activity could cause. Red-category units need an EIA and an effluent treatment plant
(ETP) where effluent is produced.

| Tier | ECR category | `severity` |
|---|---|---|
| T1 | Red | 1.00 |
| T2 | Orange‑B / Orange | 0.66 |
| T3 | Orange‑A / Yellow | 0.33 |
| T4 | Green | 0.10 |
| — | Cannot be inferred | blank (missing, **not** zero) |

## How each site gets a category

The category is **inferred** from OpenStreetMap tags (`name`, `product`, `industrial`,
`craft`, `man_made`, `landuse`, `amenity`), using case-insensitive keyword rules that
are checked in order. The first rule that matches sets the category. The rules live in
`scripts/prepare_inputs.py` (`RULES`), so they can be audited and changed.

| Tier | Keyword or tag rules (summary) |
|---|---|
| T1 Red | tannery/leather/hide; dyeing/dye/washing/printing/composite/knit-dyeing; chemical; fertiliser/urea; pesticide/insecticide; pharmaceutical; pulp/paper/board mill; sugar mill/distillery; refinery; cement/clinker; steel/iron/re-rolling/foundry/metal; ship breaking/recycling; battery; rubber/tyre; paint; electroplating; acid; landfill / dumping ground (`landuse=landfill`); wastewater/sewage treatment plant (`man_made=wastewater_plant`) |
| T2 Orange‑B | textile/spinning/jute mill; food, fish, dairy, beverage, feed, rice or flour mill, edible oil; soap/detergent; plastic/PVC; glass/ceramic; brick kiln (`industrial=brickworks`); shipyard/dockyard; waste transfer station; ice plant/cold storage |
| T3 Orange‑A | garment/apparel/knit/sweater/fashion/RMG without wet processing; packaging/printing press; furniture/wood; electronics/assembly |
| T4 Green | warehouse/storage/depot |
| blank | `landuse=industrial` zones and `man_made=works` that have no descriptive keyword |

`severity_source` is set to
`"ECR-1997 Sch.1 / ECR-2023 category inferred from OSM tags — data/severity_rubric.md v1"`.
If you have a real document for a site (a DoE clearance certificate category, an
inspection report or an ETP record), put it in `severity` / `severity_source` in the
web UI's analyst review form. Values entered there replace the inferred ones.

## Known biases

* OSM coverage of factories is uneven. Garment clusters around Dhaka, Gazipur and
  Narayanganj are mapped much more densely than rural agro-processing.
* Names are not always descriptive. Many wet-processing plants have generic names,
  so they fall in the "blank" group and are under-ranked rather than over-ranked.
* Landfill and treatment-plant footprints are treated as single source points at
  their representative point. That is not an outfall.
