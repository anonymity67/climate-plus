"""Audit frozen artifacts without fitting or choosing a new model."""

from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, collections, random, statistics, platform, argparse

parser = argparse.ArgumentParser()
parser.add_argument("--manifest-output", default="EVIDENCE-MANIFEST.regenerated.json")
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public/data"
data = json.loads((PUBLIC / "water-evidence.json").read_text(encoding="utf-8"))
rows = data["observations"]
tests = data["evaluation"]["testRows"]
keys = [
    "temp",
    "ph",
    "do",
    "cod",
    "turbidity",
    "rainfall",
    "nitrateUnspecified",
    "phosphateUnspecified",
]
train = {tuple(r[k] for k in keys) for r in rows if r["date"] < "2020-01-01"}
clusters = collections.defaultdict(list)
for r in tests:
    clusters[r["date"]].append(r)


def maes(rs):
    return {
        "model": statistics.mean(abs(r["observed"] - r["predicted"]) for r in rs),
        "baseline": statistics.mean(abs(r["observed"] - r["baseline"]) for r in rs),
    }


rng = random.Random(17020)
gains = []
dates = list(clusters)
for _ in range(2000):
    sample = [r for date in rng.choices(dates, k=len(dates)) for r in clusters[date]]
    m = maes(sample)
    gains.append(m["baseline"] - m["model"])
gains.sort()
by_date = {d: {"n": len(rs), **maes(rs)} for d, rs in clusters.items()}
by_month = {
    m: maes([r for r in tests if r["date"].startswith(m)])
    for m in sorted(set(r["date"][:7] for r in tests))
}
checks = {
    "sourceRecordCount": len(rows),
    "uniqueCoordinatePairs": len(set((r["latitude"], r["longitude"]) for r in rows)),
    "riverLocationKeys": len(set(r["site"] for r in rows)),
    "dateRange": [min(r["date"] for r in rows), max(r["date"] for r in rows)],
    "uniqueSampleDates": len(set(r["date"] for r in rows)),
    "duplicateStationDateRecords": len(rows)
    - len(set((r["site"], r["date"]) for r in rows)),
    "testMeasurementVectorsExactlyRepeatedInTraining": sum(
        tuple(r[k] for k in keys) in train for r in rows if r["date"] >= "2021-01-01"
    ),
    "testUniqueDates": len(clusters),
    "testCampaignMonths": len(by_month),
    "byTestDate": by_date,
    "byTestMonth": by_month,
    "supportedTestSubset": {
        "n": sum(r["inDomain"] for r in tests),
        **maes([r for r in tests if r["inDomain"]]),
    },
    "exploratoryDateClusterBootstrap": {
        "replicates": 2000,
        "seed": 17020,
        "metric": "baseline MAE minus model MAE; positive favors model",
        "percentile95IntervalMgL": [gains[49], gains[1949]],
        "limitations": "Only nine test dates in three campaign months. Dates may remain dependent; this interval is exploratory, not proof of prospective superiority.",
    },
    "publisherHashes": [
        {"doi": s["doi"], "sha256": s["sha256"]} for s in data["sources"]
    ],
    "generatedAt": datetime.now(timezone.utc).isoformat(),
}
(PUBLIC / "credibility-audit.json").write_text(
    json.dumps(checks, indent=2), encoding="utf-8"
)
raw_files = [
    "research/water/Water quality.csv",
    "research/water/basis-v2.xlsx",
    "research/water/dhaka-metadata.json",
    "research/water/basis-metadata.json",
    "research/water/ecr2023.pdf",
    "research/raw/power.txt",
    "research/raw/roni.txt",
]
files = raw_files + [
    "public/data/water-evidence.json",
    "public/data/water-validation.json",
    "public/data/water-stations.geojson",
    "public/data/climate-analysis.json",
    "public/data/benchmark.json",
    "public/data/credibility-audit.json",
    "src/engine.mjs",
    "src/water-engine.mjs",
    "scripts/prepare-water-data.py",
    "scripts/climate-analysis.py",
    "contracts/EvidenceRegistry.sol",
    "package-lock.json",
]
files = sorted(
    set(
        files
        + [
            "README.md",
            "ATTRIBUTIONS.md",
            "DATASETS.json",
            "requirements-research.txt",
            "package.json",
            "vite.config.js",
        ]
        + [
            p.relative_to(ROOT).as_posix()
            for folder in ["src", "tests", "scripts", "documentation"]
            for p in (ROOT / folder).glob("*")
            if p.is_file()
        ]
    )
)
manifest = {
    "schema": "climate-plus/evidence-manifest-v1",
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "files": [
        {
            "path": name,
            "bytes": (ROOT / name).stat().st_size,
            "sha256": hashlib.sha256((ROOT / name).read_bytes()).hexdigest(),
        }
        for name in files
    ],
}
(ROOT / args.manifest_output).write_text(
    json.dumps(manifest, indent=2), encoding="utf-8"
)
print(
    json.dumps(
        {
            k: checks[k]
            for k in [
                "testUniqueDates",
                "testCampaignMonths",
                "testMeasurementVectorsExactlyRepeatedInTraining",
                "supportedTestSubset",
                "exploratoryDateClusterBootstrap",
            ]
        },
        indent=2,
    )
)
