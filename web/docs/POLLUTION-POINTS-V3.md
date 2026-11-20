# Pollution points on the calamity map

`src/mvp/pollution-vectors.mjs` supplies coordinate-preserving GeoJSON Point features for the selected map region. No coordinates are translated, snapped, averaged or expanded into an affected-area polygon. A point denotes its source record; it does not identify an industrial emitter or certify drinking-water quality.

## Published sources

`buildPublishedVectors(waterEvidence, riverContext, bounds)` returns `{ features, counts }`. Bounds are optional `[west,south,east,north]` WGS84 degrees, inclusive. Invalid bounds throw an error. Omitting bounds shows global source coverage, subject to the disclosed display cap.

- `historical-measurement`: the latest valid dated row at each exact coordinate pair in `water-evidence.json` observations. The packaged dataset has 1,495 rows at 58 coordinate pairs. Source IDs beginning `DHA-` map to the explicitly supplied `dhaka` source, [Sinha, Debnath and Bhattacharjee, Mendeley dataset v1](https://data.mendeley.com/datasets/xftpv7jvx3/1), CC BY 4.0. Explicit `sourceKey` values are respected. Unknown namespaces have unknown attribution; they never borrow another source. Equal-date ties preserve source input order. River/location labels are preserved even when two names share a coordinate. The selected record's values remain unchanged; `originalRecord`, `recordCount` and `otherRecordCount` disclose the source row and omitted history. The adapter does not combine parameters across dates.
- `publisher-context`: each original point from `river-pollution-context.json`, [A.B.M. Mostakim Niloy's Kaggle dataset v2](https://www.kaggle.com/datasets/niloysust21/bangladesh-river-pollution-gis/data). Its 9,958 numeric scores and class labels have no documented sample dates or pollutant units. They remain `publisherValue` and `contextClass`, with `date: null`, `units: null` and no measured parameters or screening. Publisher update/acquisition times are not sampling times. Class labels are not health ratings.

Unlocated quality samples and unrelated velocity surveys are not joined or given invented point locations. Dataset presence elsewhere never implies coverage in Dacope, Ukhia, Chattogram, Khulna or Tongi. A selected region with no matching rows has zero features. Current conditions remain unknown.

Filtering occurs before the 1,500-feature display cap. Historical sites precede context points; remaining context points follow source order. This is a rendering limit, not a ranked or spatially representative sample. `counts` discloses `measuredRecords`, `validMeasuredRecords`, `invalidMeasuredRecords`, `measuredSites`, `historicalOtherRecords`, `measuredInBounds`, `measuredShown`, `contextRecords`, `invalidContextRecords`, `contextInBounds`, `contextShown`, and `omittedByCap`. `historicalOtherRecords` counts valid nonselected historical rows globally; `omittedByCap` counts in-bounds sites/context points excluded only by the cap. Show truncation when nonzero.

## Private observations and feature properties

`observationsToFeatures(rows, bounds)` accepts the flattened private API observation response (`date`, coordinates, measured parameters, `units`, nested `metadata`, `contentHash`, `createdAt`, `verification`). It returns an array of valid Point features inside bounds. It retains metadata and hashes. API authentication and privacy remain the backend's responsibility.

Feature properties used by the map are:

| Property                                            | Meaning                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`, `name`                                        | Original record ID and location/site label; imports use local `import-N` IDs until saved |
| `sourceKind`                                        | `historical-measurement`, `publisher-context`, `field-entry` or `representational`       |
| `sourceLabel`                                       | Original attribution or explicit uploader attribution                                    |
| `sourceKey`, `sourceUrl`, `sourceHash`              | Published source reference and raw hash where known; private evidence URL is `sourceUrl` |
| `date`                                              | Original sample calendar date; null for undated publisher context                        |
| `ph`, `do`, `cod`, `units`                          | Supplied measured values only; missing measurements are omitted                          |
| `screening`                                         | Existing `screenWater` partial pH/DO/COD screening for measurement points only           |
| `contextClass`, `publisherValue`                    | Publisher research classification and undocumented numeric score only                    |
| `verification`, `reason`                            | Evidence limitation to show in the selected point panel                                  |
| `inBounds`                                          | Whether supplied coordinates intersect the selected region                               |
| `originalRecord`, `recordCount`, `otherRecordCount` | Published row and historical selection disclosure                                        |
| `metadata`, `contentHash`, `createdAt`              | Private observation evidence trail                                                       |

Screening uses the existing fisheries objective profile in `water-engine.mjs`. It is neither overall ecological status nor current legal compliance nor potability. There is no safe/unsafe label.

## CSV / GeoJSON import

`parsePointUpload(text, options = {})` returns `{ features, observations }` only after the entire file validates. `observations` are ready for `POST /api/observations`; each includes required provenance `metadata`. No rows are saved by this pure function. The caller controls authenticated persistence. An error names the CSV physical row or GeoJSON feature and invalid field. No partial result is returned.

Options are `{ format?: 'csv' | 'geojson' | 'json', sourceKind?, sourceLabel?, method?, evidenceUrl?, bounds? }`. Format is inferred from the text if omitted. Each row/feature must explicitly declare `field-entry` or `representational` through its `sourceKind` or the options. File-level labels and provenance are defaults; per-record properties take precedence. Bounds only annotate upload feature `inBounds`; an out-of-region upload is retained at its actual coordinates. The caller should show a clear no-points-in-current-region message and keep observations available for save/export.

Canonical CSV header:

```csv
date,latitude,longitude,ph,do_mg_l,cod_mg_l,source
2025-10-01,22.5738,89.5135,7.2,4.5,55,"REPRESENTATIONAL example only, no actual sample claim"
```

CSV requires the canonical headers, optionally plus `sourceKind`, `location`, `river`, `method`, `evidenceUrl`. Optional measurements use empty fields, not zero. The unit-bearing headers explicitly declare mg/L. Numeric fields accept finite decimal notation, not formulas, comma-formatted numbers, hex or unit-suffixed strings. Quoted commas/newlines and doubled quotes are supported; malformed quoting, duplicate headers and unknown/ambiguous unit headers are rejected.

GeoJSON requires a WGS84 FeatureCollection of Point Features with exactly two numeric coordinates `[longitude,latitude]`. Each properties object includes `date`, at least one numeric `ph`/`do`/`cod`, nonempty `sourceLabel`, explicit `sourceKind` (or option), and `units: { do: 'mg/L', cod: 'mg/L' }` for parameters present. Custom CRS and non-Point geometry are rejected. Dates must be real nonfuture `YYYY-MM-DD` dates; latitude/longitude must be finite WGS84 numbers. Valid values are pH 0–14, DO 0–30 mg/L and COD ≥0 mg/L. `validateObservation` and `screenWater` remain the shared validation and screening truth.

Each import is limited to 1 MiB UTF-8 text and 200 rows/features. Empty files fail. Attribution is bounded to 500 characters; location/river to 200. Optional method and evidence URL are preserved in metadata; evidence URLs must be http/https without embedded credentials, with backend validation repeated on save. Text labels are data and must stay React-escaped; never render them with raw HTML or evaluate them as formulas/scripts. Numeric formulas fail validation. This parser does not authenticate a supplied attribution or laboratory method.

`examples/pollution-points-v3.csv` and `.geojson` are explicitly **REPRESENTATIONAL**. Their calendar dates and coordinates are format examples; their invented values make no actual sample claim. Parse the CSV with `{ sourceKind: 'representational' }`; the GeoJSON declares provenance per feature. Neither example belongs in published historical evidence.

Run `node --test tests/pollution-vectors.test.mjs` for coordinate preservation, latest-source selection, unknown context dates/units, missing regional coverage, strict file validation, explicit provenance, upload limits and private hash retention.
