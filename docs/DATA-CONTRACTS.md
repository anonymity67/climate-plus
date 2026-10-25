# Data contracts and provenance

`DATASETS.json` is the source register. `DATA-MANIFEST.json` freezes supplied raw, processed, reference and font bytes. Checksums establish byte identity with the retained snapshot; they do not establish laboratory truth. Acquisition dates are distinct from sample dates. Preserve the original release manifest as historical provenance; it describes the earlier release, not these formatted/refactored sources.

## Single observation import

Use `examples/observation.json`. `schemas/observation.schema.json` provides editor/tool documentation; the application enforces `validateObservation` at runtime, including a real calendar date and no future measured dates. JSON Schema alone does not enforce the current date. Set a schema validator to enforce date formats if using one separately.

- Required: `date` (YYYY-MM-DD), WGS84 `latitude` (-90…90), `longitude` (-180…180), and at least one measured `ph`, `do`, or `cod`.
- Values must be JSON numbers, not numeric strings. `null` means absent, not zero. pH must be 0–14; DO is screened to 0–30 mg/L; COD must be nonnegative.
- For a provided DO or COD value, declare `units.do` or `units.cod` as `mg/L`. Do not treat unspecified ppm, nitrogen species or phosphorus species as interchangeable.
- Optional labels `location` and `river` must be text of at most 200 characters.
- User imports are marked unverified. They are not appended to training data or silently attributed to a publisher. Imports do not retrain the model.
- The example is synthetic. Its screen is 100 × 2 / 3 ≈ 66.67, covering only 3 of the 12 listed fisheries parameters. It does not represent overall environmental quality.

Optional model inputs are `temp` (°C), `turbidity` (NTU), and `rainfall` (mm, as described by the dataset). The model also uses pH, COD and month from the sample date. Missing inputs abstain. Before operational ingestion, collect laboratory methods, instrument calibration, sample time/timezone, uncertainty, detection/quantification limits, censored-result flags, custody and reviewer identifiers in a separate provenance record; the current form does not verify those.

## Processed water artifact

`public/data/water-evidence.json` contains `sources`, `observations`, `survey`, `hydraulics`, `unlocatedSpatialSamples`, `model`, `evaluation`, and `qualityAudit`. Inspect the actual file for complete source fields; do not invent new implicit positional columns.

`observations`: normalized historical Dhaka rows with ID, source row, site key, sample date, measured fields, WGS84 coordinates, unit declarations, issues and provenance. The six invalid negative-value rows remain present with the affected values null; six rows are excluded from modeling. The supplied WQI and pollution labels are not used as targets or inputs.

`survey`: 40 velocity-survey points. `unlocatedSpatialSamples`: 62 quality samples whose coordinates are null. `hydraulics`: six published mixing groups. These are separate evidence objects; numeric survey IDs are not foreign keys for quality-station IDs.

`model`: exported frozen forest, feature order, training ranges and approximate interval. Use `inferDO`; its `Math.fround` predictor conversion matches scikit-learn tree branching. Preserve parity tests for every supported held-out row. Domain abstention does not establish validity inside the numeric ranges.

`evaluation`: split dates/counts, baseline/model metrics, interval diagnostics and per-row temporal test predictions. New models require a new version and evaluation record. `water-validation.json` is the inspection export of this evaluation.

## GeoJSON

`public/data/water-stations.geojson` is a FeatureCollection of **observations**, so repeat locations across sample dates are intentional. Coordinates are `[longitude, latitude]`, as required for GeoJSON. The Leaflet API takes `[latitude, longitude]`. The map currently selects the latest available observation per source site within the chosen year; this does not create a simultaneous survey or current pollution map.

Do not turn a point collection into a river surface/raster without a justified spatial model and validation. Use a projected metric CRS for distance/area computations; WGS84 degrees are not meters. Preserve source precision and positional uncertainty.

## Paired source-investigation input

Use `examples/paired-measurements.json`: upstream `qu, cu`, measured drain/source `qs, cs`, downstream `qd, cd`. All flows use `m3/s`. Use one declared pollutant and one common concentration unit (`mg/L` or `CFU/100mL`) at all locations. Negative, non-finite, zero-total-flow and overflowing inputs are rejected. Reduction and analyst closure tolerance must each be numeric fractions in [0,1].

Concentration × flow has scaled load units: mg/L × m³/s = g/s; CFU/100mL × m³/s = 10,000 CFU/s. Ratios and predicted concentrations retain consistency within the shared unit system. The code's `incomingLoad` and `observedLoad` are these common scaled products; do not label them kg/day without conversion. A closure failure invalidates source-share interpretation. A passing diagnostic does not identify an emitter or validate a treatment technology.

The paired-input UI checks pollutant and units before `mixLoad`; the pure function validates numeric physics inputs. It cannot verify simultaneous sampling, drainage topology, tides or laboratory methods.
