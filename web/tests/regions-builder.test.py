"""Optional offline reproducibility check: python tests/regions-builder.test.py.

Requires Node on PATH because Dacope proof uses the production JS router.
"""
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('regions', ROOT / 'scripts/build-regions.py')
regions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(regions)

class RegionBuildTests(unittest.TestCase):
    def test_offline_rebuild_matches_checked_in_bytes(self):
        with tempfile.TemporaryDirectory(prefix='climate-regions-') as temporary:
            output = Path(temporary)
            with redirect_stdout(io.StringIO()):
                regions.build(output)
            files = sorted(output.rglob('*.json'))
            self.assertEqual(len(files), 16)
            for generated in files:
                checked_in = ROOT / generated.relative_to(output)
                self.assertEqual(hashlib.sha256(generated.read_bytes()).hexdigest(), hashlib.sha256(checked_in.read_bytes()).hexdigest(), str(checked_in))

    def test_bounded_segments_never_interpolate_or_connect_across_external_vertex(self):
        raw = {'elements':[{'type':'way','id':1,'tags':{'highway':'residential','oneway':'-1'},'geometry':[{'lon':0.1,'lat':0.1},{'lon':0.2,'lat':0.2},{'lon':2,'lat':2},{'lon':0.3,'lat':0.3},{'lon':0.4,'lat':0.4}]}]}
        rows,_ = regions.bounded_rows(raw,[0,0,1,1])
        self.assertEqual([row['_geometry']['coordinates'] for row in rows], [[[0.1,0.1],[0.2,0.2]],[[0.3,0.3],[0.4,0.4]]])
        graph = regions.road.build_topology(rows)
        self.assertEqual(len(graph['edges']),2)
        self.assertTrue(all(not edge['bidirectional'] for edge in graph['edges']))
        self.assertEqual(graph['metadata']['roadComponentCount'],2)

if __name__ == '__main__':
    unittest.main(verbosity=2)
