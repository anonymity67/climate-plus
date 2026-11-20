"""Copy the original Borsha-Bandhu drawings and field reference files into the app."""
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree

WEB = Path(__file__).resolve().parents[1]
OUTPUT = WEB / "public" / "harvest"
FILES = (
    "drawings/D-01_system_schematic.svg",
    "drawings/D-02_T1_household_tank.svg",
    "drawings/D-03_catchment_firstflush_filter.svg",
    "drawings/D-04_T2_cluster_unit.svg",
    "drawings/D-05_T3_institutional_unit.svg",
    "drawings/D-06_zone_adaptations.svg",
    "drawings/D-07_overflow_mar_access.svg",
    "01_Technical_Design_Manual.docx",
    "02_Construction_OM_and_Water_Safety_Plan.docx",
    "03_Programme_Implementation_and_DRR_Guide.docx",
    "BorshaBandhu_Costing_and_Sizing_Model.xlsx",
)

with ZipFile(WEB.parents[1] / "Rainharvest.zip") as archive:
    manifest = {}
    for name in FILES:
        data = archive.read("borsha_bandhu/" + name)
        if name.endswith(".svg"):
            for element in ElementTree.fromstring(data).iter():
                if element.tag.split("}")[-1] in {"script", "foreignObject"} or any(
                    attribute.lower().startswith("on") or
                    (attribute.split("}")[-1] == "href" and not value.startswith("#"))
                    for attribute, value in element.attrib.items()
                ):
                    raise ValueError(f"Active content in {name}")
        output = OUTPUT / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        manifest[name] = {"bytes": len(data), "sha256": sha256(data).hexdigest()}
    (WEB / "public" / "data" / "borsha-bandhu-assets.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    # The supplied model contains only constants and functions above its report
    # entry point. Use those definitions to capture independent check values.
    import ast

    source = ast.parse(archive.read("borsha_bandhu/engine/rwh_model.py").decode())
    definitions = [item for item in source.body if isinstance(item, (ast.Import, ast.Assign, ast.FunctionDef))]
    model = {}
    exec(compile(ast.Module(body=definitions, type_ignores=[]), "rwh_model.py", "exec"), model)
    profiles = [{"id": key, "name": data["name"], "examples": data["ex"], "mm": data["m"]}
                for key, data in model["ZONES"].items()]
    bom = json.loads(archive.read("borsha_bandhu/engine/bom.json"))
    presets = []
    for identity, tier in (("home", "T1"), ("cluster", "T2"), ("school", "T3")):
        meta = bom[tier]["meta"]
        presets.append({"id": identity, "roofM2": meta["catchment_m2"], "tankL": meta["volume"],
                        "dailyDemandL": meta["users"] * 5, "users": meta["users"],
                        "archiveDailyDemandL": meta["demand_lpd"]})
    reference = {"source": "Borsha-Bandhu engineering archive · rwh_model.py & bom.json",
                 "runoff": model["RUNOFF_COEF"], "dryFactor": model["DESIGN_FACTOR"],
                 "days": model["DAYS"], "profiles": profiles, "presets": presets}
    (WEB / "public/data/borsha-bandhu-profiles.json").write_text(
        json.dumps(reference, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fixtures = []
    for profile in profiles:
        for preset in presets:
            reduced = [mm * model["DESIGN_FACTOR"] for mm in profile["mm"]]
            result = model["simulate"](reduced, preset["roofM2"], preset["tankL"], preset["dailyDemandL"])
            fixtures.append({"profile": profile["id"], "preset": preset["id"],
                             "annualServedL": sum(result["served"]), "dryCoveragePct": result["dry_rel"] * 100,
                             "spillL": result["spill"], "endL": result["final"]})
    path = WEB / "tests" / "fixtures" / "borsha-bandhu-published-equations.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(fixtures, indent=2) + "\n", encoding="utf-8")
