# Reproduction and release integrity

The delivered numerical outputs use retained snapshots, not fresh network requests. `DATASETS.json` lists five sources and hashes. `DATA-MANIFEST.json` additionally freezes derived browser data, metadata, the Gazette table render and font assets. `npm run verify:data` verifies byte identity and checks the register agrees with the manifest.

`npm run verify:handoff` checks all files listed in this kit's `EVIDENCE-MANIFEST.json`. The manifest excludes itself, runtime installations, builds and reproduction scratch directories. Its trust comes from keeping the received archive/hash independently; a checksum file alone is not an adversarial signature. `provenance/original-release-manifest.json` is retained solely as an earlier reference. It is not incorrectly asserted to describe these changed sources.

## Isolated numerical reproduction

Use the pinned Python environment and `python scripts/reproduce.py` as in the README. Node must be on PATH. The script verifies the frozen data, copies inputs/source/scripts to a fresh uniquely named `reproductions/` directory, regenerates water/climate/benchmark outputs there and compares selected numerical/content fields at `1e-9`. It preserves the root manifest and supplied outputs. Inspect its `REPRODUCTION-RESULT.json` and retain it with the environment details when sharing scientific changes.

The DO forest is selected using 2017–2019 training and early-2020 selection, then calibrated on late 2020. The 2021 holdout has 174 rows on nine dates; three rows are outside numeric training ranges and the browser abstains. The 171 supported predictions are compared against Python by the core tests at `1e-6`. Cross-runtime tree precision is explicitly handled in `inferDO`.

Held-out aggregate MAE is about 1.159 mg/L versus 1.548 for the monthly-median baseline. Temporal/station dependence and incomplete source QA remain; the approximate interval is wide. Results do not demonstrate prospective generalization or potability. The separate NASA/NOAA experiment reports an unsuccessful RONI addition rather than claiming unsupported forecast benefit.

## Intentional regeneration

These commands write output files in the working project; first commit or copy the existing frozen outputs:

```powershell
.venv\Scripts\python.exe scripts/prepare-water-data.py
.venv\Scripts\python.exe scripts/climate-analysis.py
npm run benchmark
.venv\Scripts\python.exe scripts/credibility-audit.py
```

The credibility audit writes `public/data/credibility-audit.json` plus a separately named `EVIDENCE-MANIFEST.regenerated.json`; it does not silently replace the received handoff manifest. Its manifest is a numerical-audit inventory, not the complete collaborator release inventory. Generated timestamps can change hashes even if numerical results match. Review diffs and update claims, register, parity tests, new-release manifests and dataset limitations as appropriate.

For new sources or models, preserve versioned snapshots and old evaluations. Decide the new split and evaluation protocol before looking at outcomes; the original 2021 test is already disclosed and cannot serve indefinitely as an untouched selection set.
