import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

import geopandas as gpd
import pandas as pd
import pyogrio

from riverwatch.__main__ import settings
from riverwatch.evidence import analyze


class RiverWatchTests(unittest.TestCase):
    def test_demo_end_to_end(self):
        with TemporaryDirectory() as d:
            out = Path(d) / "demo"
            job = subprocess.run(
                [sys.executable, "-m", "riverwatch", "--demo", "--out", str(out)],
                capture_output=True, text=True,
            )
            self.assertEqual(job.returncode, 0, job.stdout + job.stderr)
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["mode"], "synthetic")
            self.assertEqual(manifest["ranked_count"], 2)
            queue = pd.read_csv(out / "review_queue.csv").set_index("site_id")
            self.assertEqual(queue.loc["DEMO-01", "rank"], 1)
            self.assertTrue(pd.isna(queue.loc["DEMO-03", "rank"]))
            self.assertTrue(pd.isna(queue.loc["DEMO-REF", "rank"]))
            self.assertLess(manifest["union_population"]["pop_near"],
                            queue.loc[["DEMO-01", "DEMO-02"], "pop_near"].sum())
            gpkg = out / "riverwatch.gpkg"
            self.assertIn("portfolio_union", {row[0] for row in pyogrio.list_layers(gpkg)})
            samples = gpd.read_file(gpkg, layer="sampling_points")
            s = samples.loc[samples.site_id.eq("DEMO-02")].set_index("side")
            # The probe crosses into the upstream reach despite reversed source vertices.
            self.assertAlmostEqual(s.geometry["up"].x, 241700, places=1)
            self.assertAlmostEqual(s.geometry["down"].x, 242700, places=1)

    def test_same_scene_and_one_pair_per_day(self):
        with TemporaryDirectory() as d:
            path = Path(d) / "obs.csv"
            pd.DataFrame([
                ("p_demo", "up", "2024-01-01", "A", 0.0, 5, 25),
                ("p_demo", "down", "2024-01-01", "B", 0.3, 5, 25),
                ("p_demo", "up", "2024-01-02", "A", 0.0, 5, 25),
                ("p_demo", "down", "2024-01-02", "A", 0.1, 5, 25),
                ("p_demo", "up", "2024-01-02", "B", 0.0, 10, 25),
                ("p_demo", "down", "2024-01-02", "B", 0.2, 10, 25),
                ("p_stale", "down", "2024-01-02", "B", 0.3, 10, 25),
            ], columns=["pair_id", "side", "date", "scene_id", "ndti", "water_px",
                        "radius_m"]).to_csv(path, index=False)
            samples = pd.DataFrame([{"pair_id": "p_demo", "site_id": "BD-001"}])
            pairs, summary, qa = analyze([path], samples, settings(None))
            self.assertEqual(len(pairs), 1)
            self.assertEqual(pairs.iloc[0].scene_id, "B")
            self.assertAlmostEqual(pairs.iloc[0].delta, 0.2)
            self.assertIsNone(summary["BD-001"]["optical_score"])
            self.assertEqual(qa["unknown_pair_rows"], 1)


if __name__ == "__main__":
    unittest.main()
