#!/usr/bin/env python3
"""Create a clean source/data/schema collaborator ZIP; never copy runtime databases.

python scripts/package-handoff.py --out ../artifacts/ClimatePlus-Water-Platform-v4
Optional --seal-source writes the same evidence manifest into this checkout before
the release publisher commits it. Existing output paths are never overwritten.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = {"app", "worker", "src", "backend", "db", "drizzle", "routing", "public", "research", "scripts", "tests", "docs", "documentation", "contracts", "examples", "schemas", "provenance", "verification", ".vscode", ".openai", "lib", "tools"}
FILES = {".editorconfig", ".gitattributes", ".gitignore", ".nvmrc", ".npmrc", ".prettierrc.json", ".prettierignore", ".env.example", "ATTRIBUTIONS.md", "LICENSE-NOTICE.md", "README.md", "DATASETS.json", "DATA-MANIFEST.json", "package.json", "package-lock.json", "requirements-research.txt", "climateplus.code-workspace", "PRODUCT.md", "DESIGN.md", "GLOSSARY.md", "vite.config.ts", "next.config.ts", "next-env.d.ts", "tsconfig.json", "cloudflare-env.d.ts", "drizzle.config.ts"}
EXCLUDE_DIRS = {".git", "node_modules", "dist", ".wrangler", ".sites-runtime", ".vinext", ".next", ".venv", "__pycache__", ".ruff_cache", "reproductions", "runtime", "outputs"}


def allowed(path):
    rel = path.relative_to(ROOT)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if rel.parts[0] not in FOLDERS and rel.as_posix() not in FILES:
        return False
    if rel.parts[0] == ".openai" and rel.as_posix() != ".openai/hosting.json":
        return False
    if path.name.startswith((".env", ".dev.vars")) and path.name != ".env.example":
        return False
    if path.suffix in {".sqlite", ".sqlite3", ".db", ".wal", ".shm", ".tsbuildinfo", ".pyc"}:
        return False
    if path.suffix == ".log" and not rel.as_posix().startswith(("verification/operations-", "verification/v3-")):
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seal-source", action="store_true")
    args = parser.parse_args()
    target = args.out.resolve()
    archive = target.parent / (target.name + ".zip")
    if target == ROOT or target.is_relative_to(ROOT):
        raise SystemExit("Output must be outside the source checkout.")
    if target.exists() or archive.exists():
        raise SystemExit("Output exists; choose a new version/path. No overwrite performed.")
    paths = []
    for directory, dirs, names in os.walk(ROOT):
        dirs[:] = [name for name in dirs if name not in EXCLUDE_DIRS and (Path(directory) != ROOT or name in FOLDERS)]
        for name in names:
            candidate = Path(directory) / name
            if allowed(candidate):
                paths.append(candidate)
    paths.sort()
    manifest = {"schema": "climate-plus/source-data-handoff-v4-water", "version": "4.0.0", "createdAt": datetime.now(timezone.utc).isoformat(), "scope": "Editable frontend, API, schema/migrations, original datasets, derived graph, documentation and verification. Excludes dependencies, builds, Git metadata, runtime databases, credentials and private GPS/invitation exports. Site identity is configuration, not a credential; publishing requires owner authorization.", "files": [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]}
    serialized = json.dumps(manifest, indent=2) + "\n"
    target.mkdir(parents=True)
    for source in paths:
        dest = target / source.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
    (target / "EVIDENCE-MANIFEST.json").write_text(serialized, encoding="utf-8", newline="\n")
    if args.seal_source:
        (ROOT / "EVIDENCE-MANIFEST.json").write_text(serialized, encoding="utf-8", newline="\n")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=False) as zipped:
        for source in sorted(p for p in target.rglob("*") if p.is_file()):
            zipped.write(source, Path(target.name) / source.relative_to(target))
    with zipfile.ZipFile(archive) as zipped:
        assert zipped.testzip() is None
        for entry in manifest["files"]:
            data = zipped.read(target.name + "/" + entry["path"])
            assert len(data) == entry["bytes"] and hashlib.sha256(data).hexdigest() == entry["sha256"]
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(digest + "  " + archive.name + "\n", encoding="utf-8")
    print(json.dumps({"folder": str(target), "archive": str(archive), "files": len(paths)+1, "bytes": archive.stat().st_size, "sha256": digest, "CRC": "passed"}, indent=2))


if __name__ == "__main__":
    main()
