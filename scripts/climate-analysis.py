"""Reproducible retrospective experiment; never a live local warning model."""

from pathlib import Path
from urllib.request import urlopen, Request
from html.parser import HTMLParser
from datetime import datetime, timezone
import json, hashlib, calendar, math
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data"
RAW = ROOT / "research/raw"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)
SOURCES = {
    "power": "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude=89.51&latitude=22.57&start=1983&end=2025&format=JSON",
    "roni": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/",
}


def fetch(name, url):
    p = RAW / (name + ".txt")
    if not p.exists():
        p.write_bytes(
            urlopen(
                Request(url, headers={"User-Agent": "ClimatePlusResearch/0.1"}),
                timeout=60,
            ).read()
        )
    return p.read_text(encoding="utf-8")


class Rows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = []
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = ""

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        if tag == "tr":
            self.rows.append(self.row)


def main():
    raw = fetch("power", SOURCES["power"])
    data = json.loads(raw)
    rain = data["properties"]["parameter"]["PRECTOTCORR"]
    units = data.get("parameters", {}).get("PRECTOTCORR", {}).get("units", "unknown")
    if units.lower() not in ("mm/day", "mm day-1"):
        raise ValueError("Review rainfall units before proceeding: " + units)
    monthly = {
        int(k): v * calendar.monthrange(int(k[:4]), int(k[4:]))[1]
        for k, v in rain.items()
        if len(k) == 6 and 1 <= int(k[4:]) <= 12 and v >= 0
    }
    parser = Rows()
    parser.feed(fetch("roni", SOURCES["roni"]))
    roni = {}
    for row in parser.rows:
        if len(row) >= 13 and row[0].isdigit() and 1950 <= int(row[0]) <= 2026:
            for m, v in enumerate(row[1:13], 1):
                try:
                    roni[int(row[0]) * 100 + m] = float(v.replace("\u2212", "-"))
                except ValueError:
                    pass
    if len(roni) < 500:
        raise ValueError("RONI table parsing incomplete")

    def shift(k, n):
        y, m = divmod(k, 100)
        z = y * 12 + m - 1 + n
        return (z // 12) * 100 + z % 12 + 1

    thresholds = {
        m: float(
            np.quantile(
                [
                    v
                    for k, v in monthly.items()
                    if 1984 <= k // 100 <= 2010 and k % 100 == m
                ],
                0.2,
            )
        )
        for m in range(1, 13)
    }
    rows = []
    for k in sorted(monthly):
        if not 1984 <= k // 100 <= 2025:
            continue
        # RONI indexed by center month. Center target-3 => final month target-2;
        # conservative one-month reporting gap. Modern revisions remain retrospective.
        lag = [shift(k, -i) for i in [1, 2, 3]]
        rk = shift(k, -3)
        if any(l not in monthly for l in lag) or rk not in roni:
            continue
        m = k % 100
        x = [
            math.sin(2 * math.pi * m / 12),
            math.cos(2 * math.pi * m / 12),
            *[math.log1p(monthly[l]) for l in lag],
            roni[rk],
        ]
        rows.append(
            (
                k,
                x,
                int(monthly[k] <= thresholds[m]),
                int(monthly[lag[0]] <= thresholds[lag[0] % 100]),
            )
        )
    train = [r for r in rows if r[0] // 100 <= 2010]
    val = [r for r in rows if 2011 <= r[0] // 100 <= 2018]
    test = [r for r in rows if r[0] // 100 >= 2019]

    def arrays(rs, n):
        return np.array([r[1][:n] for r in rs]), np.array([r[2] for r in rs])

    y = np.array([r[2] for r in test])
    metrics = []
    predictions = {}

    def score(name, p, extra={}):
        metrics.append(
            {
                "name": name,
                "testBrier": float(brier_score_loss(y, p)),
                "testAUC": float(roc_auc_score(y, p)),
                "testMonths": len(y),
                **extra,
            }
        )
        predictions[name] = list(map(float, p))

    climatology = np.array(
        [np.mean([r[2] for r in train if r[0] % 100 == t[0] % 100]) for t in test]
    )
    score("calendar-month climatology", climatology)
    score("previous-month dry-state persistence", np.array([r[3] for r in test]))
    for name, n in [("rainfall logistic", 5), ("rainfall + lagged RONI logistic", 6)]:
        xt, yt = arrays(train, n)
        xv, yv = arrays(val, n)
        xs, ys = arrays(test, n)
        candidates = []
        for c in [0.01, 0.1, 1, 10]:
            model = make_pipeline(
                StandardScaler(),
                LogisticRegression(C=c, max_iter=2000, random_state=17),
            )
            model.fit(xt, yt)
            candidates.append(
                (brier_score_loss(yv, model.predict_proba(xv)[:, 1]), c, model)
            )
        vb, c, model = min(candidates, key=lambda a: a[0])
        p = model.predict_proba(xs)[:, 1]
        score(name, p, {"selectedC": c, "validationBrier": float(vb)})
    best = min(metrics, key=lambda x: x["testBrier"])
    modelmetric = next(m for m in metrics if "RONI" in m["name"])
    baseline = metrics[0]
    summary = f"Retrospective test on {len(test)} months (2019–2025): RONI model Brier {modelmetric['testBrier']:.3f}; calendar-month baseline {baseline['testBrier']:.3f}. Lower is better. No live forecast validation."
    out = {
        "summary": summary,
        "status": "completed retrospective research experiment",
        "location": {
            "latitude": 22.57,
            "longitude": 89.51,
            "meaning": "illustrative Dacope-area gridded point, not a station or community service record",
        },
        "target": "Next calendar month precipitation at or below training calendar-month 20th percentile",
        "units": {"raw": units, "target": "mm/month derived using calendar day count"},
        "splits": {"train": len(train), "validation": len(val), "test": len(test)},
        "metrics": metrics,
        "conclusion": "Do not promote the RONI model as operationally superior. Keep climate context separate from allocation; validate on issued forecasts and local decisions before deployment.",
        "summaryBestTestModel": best["name"],
        "thresholds": thresholds,
        "testRows": [
            {
                "month": r[0],
                "lowRainfall": r[2],
                **{name: ps[i] for name, ps in predictions.items()},
            }
            for i, r in enumerate(test)
        ],
        "limitations": [
            "NASA gridded model-derived precipitation, not local gauge truth",
            "RONI ERSSTv6 historical revisions: retrospective reconstruction, not as-issued hindcast",
            "Single point; modest sample; no causal ENSO attribution",
            "No direct mapping from monthly rainfall to salinity or tank stock",
            "Model selection uses validation only; test metrics are descriptive and must not drive retuning",
        ],
        "sources": [
            {
                "name": name,
                "url": url,
                "sha256": hashlib.sha256(
                    (RAW / (name + ".txt")).read_bytes()
                ).hexdigest(),
            }
            for name, url in SOURCES.items()
        ],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    (OUT / "climate-analysis.json").write_text(
        json.dumps(out, indent=2), encoding="utf-8"
    )
    print(summary)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
