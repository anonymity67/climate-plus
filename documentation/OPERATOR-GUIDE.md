# Operator and reviewer guide

## Demonstration sequence

1. Open the local product and choose **Pollution & GIS**.
2. In the Dhaka layer, select a year, river and sampling location. Read the sample date before interpreting the indicator.
3. Inspect the three measurements, objectives and missing evidence. Open the standards/method disclosure.
4. Switch to **Source investigation**. Select a published hydraulic group, inspect closure errors and adjust the assumed reduction. Treat the output as a hypothesis for investigation.
5. Open **Model validation**. Compare held-out errors with the baseline. Change an input beyond its training range to see abstention.
6. Use **Enter an observation** to validate a new record. Export an investigation receipt only after checking its metadata. User input remains unverified.
7. Return to **Continuity desk**. Select salinity, storm or dry-period stress; set budget, demand and school floor.
8. Calculate a response and inspect all catchments. Review the comparison table, total shortage, cost and closing stock.
9. Confirm the demonstration plan. Record task completion separately. Open the Bangla or English notice and use the browser print function if needed.
10. In **Evidence & trust**, create and verify a receipt, test tampering and, when the local EVM service is running, anchor its digest. A local transaction is not a public-chain transaction.

## Measured observation input

Use a real sampling date, WGS84 coordinates and explicit mg/L units. Optional labels must be text. Negative concentrations, invalid dates/coordinates, impossible pH and future-dated measurements are rejected. Missing parameters can be omitted or set to null.

```json
{
  "date": "2026-10-20",
  "location": "Training example; replace with measured record",
  "latitude": 23.8,
  "longitude": 90.4,
  "ph": 7.2,
  "do": 4.1,
  "cod": 65,
  "units": {"do": "mg/L", "cod": "mg/L"}
}
```

These values are an input-format example, not field evidence. Retain the laboratory report, instrument calibration, sampling depth/time, sample ID and custody record outside this demo. The application does not independently validate those documents.

## Paired source-investigation input

In Source investigation, expand **Use your own paired measurements**. Provide the same pollutant and concentration units at upstream, source/drain and downstream positions. `qu`, `qs`, `qd` are flows in m³/s; `cu`, `cs`, `cd` are concentrations. Supported unit labels are `mg/L` and `CFU/100mL`.

```json
{
  "qu": 1,
  "qs": 0.1,
  "qd": 1.1,
  "cu": 10,
  "cs": 100,
  "cd": 20,
  "pollutant": "COD",
  "units": {"flow": "m3/s", "concentration": "mg/L"}
}
```

This is an arithmetic example. Real sampling must account for mixing distance, travel time, comparable operating conditions and other inflows. Poor closure blocks a credible source-contribution conclusion. Do not interpret a model setting or slider as proof that treatment will deliver that reduction.

## Interpreting states

| State | Meaning | Appropriate next step |
|---|---|---|
| Published historical sample | Values are reproduced from the attributed repository | Review original QA and collect current observations |
| User supplied | Entry passed software checks, not independent scientific review | Attach calibration/lab/custody evidence |
| Partial screen | Some tested objectives were compared; other hazards are unassessed | Review missing parameters and intended use |
| Outside model domain | One or more inputs are missing or outside numerical training ranges | Obtain a direct measurement; do not force an estimate |
| Closure failed | Entered flows/loads do not reconcile within the selected diagnostic tolerance | Inspect timing, mixing, measurement error and missing pathways |
| Confirmed demo plan | A user confirmed the synthetic schedule in this session | Do not treat it as a real dispatch commitment |
| Recorded complete | An operator entry exists in the demo | Seek measured and independently checked execution evidence |
| Record intact | Canonical content matches its presented digest | Compare with a separately trusted digest/registry where needed |
| Notice expired | More than 24 hours since confirmation | Refresh and reconfirm before communicating service |

## Failure behavior

- Without network tiles, use the station selector and coordinates; do not infer absence of hazards from a blank map.
- Without the local EVM service, hash receipts still work. The interface reports that local anchoring is unavailable.
- Changing a continuity scenario or constraint invalidates confirmation and prior receipt state.
- Reloading resets the operating session. Local investigation summaries persist only in that browser's local storage.
- No automatic SMS, public warning, dispatch, source reopening, payment or infrastructure control occurs.

## Safe review practice

Keep demonstration entries separate from field records. Use synthetic labels for rehearsal. Review exports before sharing. A named location in a dataset may reference a nearby facility for identification; it is not an allegation that the facility caused the observed impairment.
