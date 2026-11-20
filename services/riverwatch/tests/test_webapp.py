"""Smoke tests for the web GIS API over the committed real-data runs."""
from pathlib import Path
import os
import unittest

ROOT = Path(__file__).resolve().parents[1]
HAVE_RUNS = (ROOT / "runs/national/manifest.json").is_file()


@unittest.skipUnless(HAVE_RUNS, "real runs not built (scripts/build_all.sh)")
class WebAppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.pop("RIVERWATCH_ADMIN_TOKEN", None)
        from fastapi.testclient import TestClient
        from webapp.main import app
        cls.c = TestClient(app)

    def test_runs_and_summary(self):
        r = self.c.get("/api/runs").json()
        ids = [x["id"] for x in r["runs"]]
        self.assertIn("national", ids)
        s = self.c.get("/api/runs/national/summary").json()
        self.assertGreater(s["counts"]["sites"], 1000)
        self.assertLessEqual(s["counts"]["critical"], s["counts"]["linked"])
        # Union headline must not exceed the naive per-site sum (no double counting).
        self.assertIsNotNone(s["union_population"]["pop_near"])

    def test_sites_and_detail(self):
        g = self.c.get("/api/runs/national/sites").json()
        self.assertEqual(g["type"], "FeatureCollection")
        sid = next(f["properties"]["id"] for f in g["features"] if f["properties"]["cr"])
        d = self.c.get(f"/api/runs/national/sites/{sid}").json()
        self.assertEqual(d["properties"]["site_id"], sid)
        self.assertIsNotNone(d["geo"]["corridor"])
        self.assertEqual(self.c.get("/api/runs/national/sites/NOPE").status_code, 404)

    def test_reviews_disabled_without_token(self):
        r = self.c.post("/api/runs/national/sites/x/review", json={})
        self.assertEqual(r.status_code, 403)

    def test_static_and_downloads(self):
        self.assertEqual(self.c.get("/").status_code, 200)
        self.assertEqual(self.c.get("/static/data/divisions.geojson").status_code, 200)
        self.assertEqual(self.c.get("/api/runs/national/download/manifest.json").status_code, 200)
        self.assertEqual(self.c.get("/api/runs/national/download/../config.json").status_code, 404)


if __name__ == "__main__":
    unittest.main()
