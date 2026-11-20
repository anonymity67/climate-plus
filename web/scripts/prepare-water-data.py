"""Transform attributed Bangladesh datasets and freeze a leakage-aware DO model.
Run with Python, numpy, scikit-learn and openpyxl. Raw input is never overwritten.
"""

from pathlib import Path
from datetime import datetime, timezone
import csv, json, hashlib, math, platform
import numpy as np
import openpyxl, sklearn
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "research/water"
OUT = ROOT / "public/data"
OUT.mkdir(parents=True, exist_ok=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def num(v):
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def main():
    dhaka_meta = json.loads((RAW / "dhaka-metadata.json").read_text())
    basis_meta = json.loads((RAW / "basis-metadata.json").read_text())
    assert (
        digest(RAW / "Water quality.csv")
        == dhaka_meta["files"][0]["content_details"]["sha256_hash"]
    )
    assert (
        digest(RAW / "basis-v2.xlsx")
        == basis_meta["files"][-1]["content_details"]["sha256_hash"]
    )
    source_rows = list(
        csv.DictReader((RAW / "Water quality.csv").open(encoding="utf-8-sig"))
    )
    observations = []
    issues = []
    for i, r in enumerate(source_rows, 2):
        month = int(r["Date"][5:7])
        record = {
            "id": f"DHA-{i}",
            "row": i,
            "date": r["Date"],
            "river": r["River/Stream"].replace("Tongi khal", "Tongi Khal"),
            "location": r["Location"],
            "latitude": float(r["Latitude"]),
            "longitude": float(r["Longitude"]),
            "temp": num(r["Temp (°C)"]),
            "ph": num(r["pH"]),
            "do": num(r["DO (mg/L)"]),
            "cod": num(r["COD\n(mg/L)"]),
            "nitrateUnspecified": num(r["Nitrate\n(mg/L)"]),
            "phosphateUnspecified": num(r["Phosphate\n(mg/L)"]),
            "turbidity": num(r["Turbidity\n(NTU)"]),
            "rainfall": num(r["Rainfall (mm)"]),
            "monthSin": math.sin(2 * math.pi * month / 12),
            "monthCos": math.cos(2 * math.pi * month / 12),
            "units": {"do": "mg/L", "cod": "mg/L", "turbidity": "NTU"},
            "provenance": "repository-published measurement; original lab QA not supplied",
            "issues": [],
        }
        for k in [
            "do",
            "cod",
            "turbidity",
            "rainfall",
            "nitrateUnspecified",
            "phosphateUnspecified",
        ]:
            if record[k] is not None and record[k] < 0:
                record["issues"].append(
                    f"{k}: negative source value {record[k]} excluded"
                )
                record[k] = None
        if record["ph"] is not None and not 0 <= record["ph"] <= 14:
            record["issues"].append("pH outside physical range excluded")
            record["ph"] = None
        record["logTurbidity"] = (
            math.log1p(record["turbidity"]) if record["turbidity"] is not None else None
        )
        record["site"] = record["river"] + " | " + record["location"]
        observations.append(record)
        if record["issues"]:
            issues.append({"row": i, "issues": record["issues"]})
    wb = openpyxl.load_workbook(RAW / "basis-v2.xlsx", data_only=True)
    survey = []
    for rownum, row in enumerate(wb["06_Average_Channel_Velocity"].values, 1):
        for offset, channel in [(0, "Malnichara"), (10, "Goalichara")]:
            if isinstance(row[offset], (int, float)) and isinstance(
                row[offset + 3], (int, float)
            ):
                survey.append(
                    {
                        "id": channel + "-V" + str(int(row[offset])),
                        "channel": channel,
                        "date": "2025-05-16",
                        "latitude": row[offset + 3],
                        "longitude": row[offset + 4],
                        "chainage": row[offset + 2],
                        "velocity": row[offset + 8],
                        "replicates": list(row[offset + 5 : offset + 8]),
                        "sourceRow": rownum,
                        "note": "Velocity survey location only. Not matched to a water-quality station.",
                    }
                )
    hydraulics = []
    for rownum, row in enumerate(wb["05_Mass_Balance_Hydraulics"].values, 1):
        if (
            isinstance(row[0], str)
            and isinstance(row[1], str)
            and isinstance(row[8], (int, float))
            and isinstance(row[23], (int, float))
        ):
            hydraulics.append(
                {
                    "id": row[1],
                    "channel": row[0],
                    "qu": row[15],
                    "qs": row[8],
                    "qd": row[23],
                    "cu": row[17] * 1e5,
                    "cs": row[10] * 1e5,
                    "cd": row[25] * 1e5,
                    "sourceRow": rownum,
                    "date": None,
                    "units": {"flow": "m3/s", "concentration": "CFU/100mL"},
                    "note": "Dataset means of analytical replicates. No timestamp or coordinates supplied in this worksheet. Raw concentration values multiplied by 10^5 per published units.",
                }
            )
    spatial = []
    channel = ""
    for rownum, row in enumerate(wb["01_Spatial_62_Stations"].values, 1):
        if isinstance(row[2], datetime) and isinstance(row[4], (float, int)):
            if row[0]:
                channel = row[0]
            spatial.append(
                {
                    "id": row[1],
                    "channel": channel,
                    "date": row[2].date().isoformat(),
                    "fc": row[4] * 1e5,
                    "ph": row[5],
                    "turbidity": row[6],
                    "latitude": None,
                    "longitude": None,
                    "sourceRow": rownum,
                }
            )
    features = ["temp", "ph", "cod", "logTurbidity", "rainfall", "monthSin", "monthCos"]
    eligible = [
        r
        for r in observations
        if r["do"] is not None and all(r[k] is not None for k in features)
    ]
    tr = [r for r in eligible if r["date"] < "2020-01-01"]
    va = [r for r in eligible if "2020-01-01" <= r["date"] < "2020-07-01"]
    cal = [r for r in eligible if "2020-07-01" <= r["date"] < "2021-01-01"]
    te = [r for r in eligible if r["date"] >= "2021-01-01"]
    assert min(map(len, [tr, va, cal, te])) >= 20

    def xy(rs):
        return np.array([[r[k] for k in features] for r in rs]), np.array(
            [r["do"] for r in rs]
        )

    xt, yt = xy(tr)
    xv, yv = xy(va)
    xc, yc = xy(cal)
    xs, ys = xy(te)
    candidates = []
    for alpha in [1, 10, 100]:
        candidates.append(
            (f"ridge-{alpha}", make_pipeline(StandardScaler(), Ridge(alpha=alpha)))
        )
    for depth in [4, 6]:
        candidates.append(
            (
                f"forest-{depth}",
                RandomForestRegressor(
                    n_estimators=60,
                    max_depth=depth,
                    min_samples_leaf=8,
                    random_state=17,
                    n_jobs=1,
                ),
            )
        )
    selection = []
    for name, model in candidates:
        model.fit(xt, yt)
        selection.append(
            (
                float(mean_absolute_error(yv, np.maximum(0, model.predict(xv)))),
                name,
                model,
            )
        )
    _, name, model = min(selection, key=lambda a: a[0])
    pred = np.maximum(0, model.predict(xs))
    res = np.abs(yc - np.maximum(0, model.predict(xc)))
    q = min(1, math.ceil((len(res) + 1) * 0.9) / len(res))
    interval = float(np.quantile(res, q, method="higher"))
    monthly = {
        m: float(np.median([r["do"] for r in tr if int(r["date"][5:7]) == m]))
        for m in range(1, 13)
    }
    base = np.array([monthly[int(r["date"][5:7])] for r in te])

    def metrics(p):
        return {
            "mae": float(mean_absolute_error(ys, p)),
            "rmse": float(np.sqrt(mean_squared_error(ys, p))),
            "r2": float(r2_score(ys, p)),
            "bias": float(np.mean(p - ys)),
        }

    ranges = {
        k: [float(xt[:, i].min()), float(xt[:, i].max())]
        for i, k in enumerate(features)
    }
    supported = np.all((xs >= xt.min(axis=0)) & (xs <= xt.max(axis=0)), axis=1)
    exported = {
        "features": features,
        "ranges": ranges,
        "interval": interval,
        "modelName": name,
        "trainedThrough": "2019-12-31",
        "domain": "Historical Dhaka-region sampled rivers; prospective local validation required",
    }
    if name.startswith("ridge"):
        scaler, reg = model.steps[0][1], model.steps[1][1]
        exported.update(
            kind="ridge",
            means=scaler.mean_.tolist(),
            scales=scaler.scale_.tolist(),
            coefficients=reg.coef_.tolist(),
            intercept=float(reg.intercept_),
        )
    else:
        exported.update(
            kind="forest",
            trees=[
                {
                    "left": t.tree_.children_left.tolist(),
                    "right": t.tree_.children_right.tolist(),
                    "feature": t.tree_.feature.tolist(),
                    "threshold": t.tree_.threshold.tolist(),
                    "value": t.tree_.value[:, 0, 0].tolist(),
                }
                for t in model.estimators_
            ],
        )
    test_rows = [
        {
            "id": r["id"],
            "date": r["date"],
            "site": r["site"],
            "observed": float(y),
            "predicted": float(p),
            "baseline": float(b),
            "inDomain": bool(s),
            "features": {k: r[k] for k in features},
        }
        for r, y, p, b, s in zip(te, ys, pred, base, supported)
    ]
    eval = {
        "target": "Measured dissolved oxygen (mg/L), not WQI or a pollution label",
        "purpose": "Retrospective contemporaneous screening estimate when a DO measurement is unavailable; not a forecast or safety decision",
        "splits": {
            "train": {"period": "2017–2019", "rows": len(tr)},
            "selection": {"period": "2020 Jan–Jun", "rows": len(va)},
            "calibration": {"period": "2020 Jul–Dec", "rows": len(cal)},
            "test": {"period": "2021", "rows": len(te)},
        },
        "selection": [{"name": n, "validationMAE": m} for m, n, _ in selection],
        "selected": name,
        "model": metrics(pred),
        "baseline": metrics(base),
        "interval": {
            "nominal": 0.9,
            "radiusMgL": interval,
            "testCoverage": float(np.mean(np.abs(ys - pred) <= interval)),
            "method": "Split absolute residual quantile; coverage is empirical under temporal shift, not guaranteed",
        },
        "testInDomain": int(supported.sum()),
        "testOutsideDomain": int((~supported).sum()),
        "trainingFeatures": features,
        "excludedFeatures": ["DO target", "WQI", "Pollution_Label", "station identity"],
        "limitations": [
            "Publisher does not provide original laboratory QA/custody records",
            "Known stations can recur across years; this is temporal validation, not unseen-basin validation",
            "Historical source data do not establish current conditions",
            "Intervals can be wide and poorly calibrated under distribution shift",
            "Any inference outside training numeric ranges abstains; within-range does not prove applicability",
        ],
        "testRows": test_rows,
    }
    sources = [
        {
            "id": "dhaka",
            "doi": dhaka_meta["doi"]["id"],
            "authors": "Sinha, Debnath and Bhattacharjee",
            "url": "https://data.mendeley.com/datasets/xftpv7jvx3/1",
            "license": "CC BY 4.0",
            "sha256": digest(RAW / "Water quality.csv"),
        },
        {
            "id": "basis",
            "doi": basis_meta["doi"]["id"],
            "authors": "Banik, Gupta, Chowdhury, Hasan, Kabir and Hoque",
            "url": "https://data.mendeley.com/datasets/bncwnj8yjt/2",
            "license": "CC BY 4.0",
            "sha256": digest(RAW / "basis-v2.xlsx"),
        },
    ]
    output = {
        "schema": "climate-plus/water-evidence-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": sources,
        "observations": observations,
        "survey": survey,
        "hydraulics": hydraulics,
        "unlocatedSpatialSamples": spatial,
        "qualityAudit": {
            "sourceRows": len(source_rows),
            "locations": len(
                set((r["latitude"], r["longitude"]) for r in observations)
            ),
            "riverLocationKeys": len(set(r["site"] for r in observations)),
            "invalidCells": issues,
            "excludedModelRows": len(observations) - len(eligible),
            "coordinateWarning": "BASIS water-quality station coordinates absent; velocity survey not joined to those samples. Dhaka contains 60 river/location name combinations at 58 unique coordinate pairs; original names are preserved.",
            "labelWarning": "Supplied WQI and Pollution_Label are not used: undocumented formula/provenance and possible label leakage.",
            "chemicalFormWarning": "Nitrate and phosphate chemical forms unspecified: excluded from regulatory-objective comparison.",
        },
        "model": exported,
        "evaluation": eval,
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "sklearn": sklearn.__version__,
        },
    }
    (OUT / "water-evidence.json").write_text(
        json.dumps(output, separators=(",", ":"), allow_nan=False), encoding="utf-8"
    )
    (OUT / "water-validation.json").write_text(
        json.dumps(eval, indent=2, allow_nan=False), encoding="utf-8"
    )
    (OUT / "water-stations.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [r["longitude"], r["latitude"]],
                        },
                        "properties": {
                            k: v
                            for k, v in r.items()
                            if k not in ["longitude", "latitude"]
                        },
                    }
                    for r in observations
                ],
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "observations": len(observations),
                "survey": len(survey),
                "hydraulics": len(hydraulics),
                "unlocatedSpatial": len(spatial),
                "invalidCells": len(issues),
                "model": name,
                "evaluation": {
                    k: eval[k]
                    for k in [
                        "splits",
                        "model",
                        "baseline",
                        "interval",
                        "testOutsideDomain",
                    ]
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
