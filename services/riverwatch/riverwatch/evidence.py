import numpy as np
import pandas as pd

RAW = ["pair_id", "side", "date", "scene_id", "ndti", "water_px", "radius_m"]
PAIR = ["pair_id", "date", "scene_id", "site_id", "up", "down",
        "water_up", "water_down", "delta", "unusual"]


def analyze(paths, samples, cfg):
    mapping = samples.drop_duplicates("pair_id").set_index("pair_id")["site_id"].to_dict()
    files = []
    for path in paths:
        df = pd.read_csv(path, dtype={c: "string" for c in RAW[:4]})
        missing = set(RAW) - set(df.columns)
        if missing:
            raise ValueError(f"{path}: missing satellite export fields {sorted(missing)}")
        files.append(df[RAW])
    qa = {"input_rows": 0, "unknown_pair_rows": 0, "accepted_sample_rows": 0,
          "valid_paired_dates": 0}
    if not files:
        return pd.DataFrame(columns=PAIR), {}, qa
    obs = pd.concat(files, ignore_index=True)
    qa["input_rows"] = len(obs)
    for col in ["ndti", "water_px", "radius_m"]:
        obs[col] = pd.to_numeric(obs[col], errors="coerce")
    obs["date"] = pd.to_datetime(obs.date, format="%Y-%m-%d", errors="coerce").dt.strftime("%Y-%m-%d")
    known = obs.pair_id.isin(mapping)
    qa["unknown_pair_rows"] = int((~known).sum())
    valid = (
        known & obs.side.isin(["up", "down"]) & obs.date.notna()
        & obs.scene_id.notna() & obs.scene_id.ne("")
        & obs.ndti.between(-1, 1) & np.isfinite(obs.water_px)
        & obs.water_px.ge(cfg["min_water_pixels"])
        & obs.radius_m.eq(cfg["sample_radius_m"])
    )
    obs = obs.loc[valid.fillna(False)].copy()
    keys = ["pair_id", "date", "scene_id"]
    obs = obs.sort_values("water_px", ascending=False, kind="stable").drop_duplicates(keys + ["side"])
    qa["accepted_sample_rows"] = len(obs)
    up = obs.loc[obs.side.eq("up"), keys + ["ndti", "water_px"]].rename(
        columns={"ndti": "up", "water_px": "water_up"}
    )
    down = obs.loc[obs.side.eq("down"), keys + ["ndti", "water_px"]].rename(
        columns={"ndti": "down", "water_px": "water_down"}
    )
    pairs = up.merge(down, on=keys, how="inner", validate="one_to_one")
    pairs["quality"] = pairs[["water_up", "water_down"]].min(axis=1)
    pairs = pairs.sort_values(
        ["date", "quality", "scene_id"], ascending=[True, False, True]
    ).drop_duplicates(["pair_id", "date"]).reset_index(drop=True)
    pairs["site_id"] = pairs.pair_id.map(mapping)
    pairs["delta"] = pairs.down - pairs.up
    pairs["unusual"] = False

    summary = {}
    for sid, group in pairs.groupby("site_id"):
        n = len(group)
        median = float(group.delta.median())
        enough = n >= cfg["min_pairs"]
        mad = float((group.delta - median).abs().median())
        flags = group.delta.gt(max(0, median + max(0.03, 3 * 1.4826 * mad))) & enough
        pairs.loc[group.index, "unusual"] = flags
        summary[sid] = {
            "n_clear_dates": n, "median_delta": median,
            "optical_score": float(np.clip(median / cfg["delta_scale"], 0, 1)) if enough else None,
            "last_unusual_date": str(group.loc[flags, "date"].max()) if flags.any() else "",
        }
    qa["valid_paired_dates"] = len(pairs)
    return pairs[PAIR], summary, qa
