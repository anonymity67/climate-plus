"""Reproduce numerical outputs in an isolated folder, preserving the release."""

from pathlib import Path
from datetime import datetime, timezone
import subprocess, sys, shutil, json, hashlib, uuid

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / "DATA-MANIFEST.json"
before = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
subprocess.run(["node", str(ROOT / "scripts/verify-data.mjs")], cwd=ROOT, check=True)
destination = (
    ROOT
    / "reproductions"
    / (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + "-"
        + uuid.uuid4().hex[:6]
    )
)
destination.mkdir(parents=True)
for folder in ["src", "scripts", "research"]:
    shutil.copytree(
        ROOT / folder,
        destination / folder,
        ignore=shutil.ignore_patterns("__pycache__"),
    )
for script in ["prepare-water-data.py", "climate-analysis.py"]:
    subprocess.run(
        [sys.executable, str(destination / "scripts" / script)],
        cwd=destination,
        check=True,
        stdout=subprocess.DEVNULL,
    )
subprocess.run(
    ["node", str(destination / "scripts/benchmark.mjs")],
    cwd=destination,
    check=True,
    stdout=subprocess.DEVNULL,
)


def load(base, name):
    return json.loads((base / "public/data" / name).read_text(encoding="utf-8"))


def near(a, b, path=""):
    if isinstance(a, dict):
        if set(a) != set(b):
            raise AssertionError("Keys differ: " + path)
        for k in a:
            near(a[k], b[k], path + "/" + k)
    elif isinstance(a, list):
        if len(a) != len(b):
            raise AssertionError("Length differs: " + path)
        for i, (x, y) in enumerate(zip(a, b)):
            near(x, y, path + "/" + str(i))
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        if abs(a - b) > 1e-9:
            raise AssertionError("Number differs: " + path)
    elif a != b:
        raise AssertionError("Value differs: " + path)


water0 = load(ROOT, "water-evidence.json")
water1 = load(destination, "water-evidence.json")
for key in ["observations", "survey", "hydraulics", "model", "evaluation"]:
    near(water0[key], water1[key], key)
near(
    load(ROOT, "benchmark.json")["results"],
    load(destination, "benchmark.json")["results"],
    "benchmark",
)
for key in ["metrics", "thresholds", "testRows"]:
    near(
        load(ROOT, "climate-analysis.json")[key],
        load(destination, "climate-analysis.json")[key],
        "climate/" + key,
    )
assert before == hashlib.sha256(manifest_path.read_bytes()).hexdigest(), (
    "Frozen data manifest changed"
)
result = {
    "status": "passed",
    "outputDirectory": str(destination),
    "numericalTolerance": 1e-9,
    "dataManifestSha256": before,
    "frozenDataManifestPreserved": True,
    "checks": [
        "water normalized records",
        "survey and hydraulics",
        "frozen model",
        "held-out predictions and metrics",
        "144 operational policy runs",
        "climate metrics thresholds and test rows",
    ],
}
(destination / "REPRODUCTION-RESULT.json").write_text(
    json.dumps(result, indent=2), encoding="utf-8"
)
print(json.dumps(result, indent=2))
