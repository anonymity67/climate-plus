from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1]
old=root/'provenance/README-v3.md'
if not old.exists():shutil.copy2(root/'README.md',old)
pkg=json.loads((root/'package.json').read_text())
pkg['name']='climateplus-water-platform';pkg['version']='4.0.0';pkg['description']='Sourced water-point search, historical pollution evidence linked to mapped channels, private field checks and rainwater supply planning'
pkg['scripts']['rebuild:streams']='node scripts/build-waterways.mjs'
pkg['scripts']['verify:streams']='node --test tests/channel-topology.test.mjs'
(root/'package.json').write_text(json.dumps(pkg,indent=2)+'\n',encoding='utf-8')
lock=json.loads((root/'package-lock.json').read_text());lock['name']=pkg['name'];lock['version']=pkg['version'];lock['packages']['']['name']=pkg['name'];lock['packages']['']['version']=pkg['version'];(root/'package-lock.json').write_text(json.dumps(lock,indent=2)+'\n',encoding='utf-8')
pack=root/'scripts/package-handoff.py';s=pack.read_text();s=s.replace('ClimatePlus-V3-Map-MVP','ClimatePlus-Water-Platform-v4').replace('climate-plus/source-data-handoff-v3-map','climate-plus/source-data-handoff-v4-water').replace('"version": "3.0.0"','"version": "4.0.0"');pack.write_text(s,encoding='utf-8')
api=root/'backend/api.mjs';api.write_text(api.read_text().replace("release: '3.0.0'","release: '4.0.0'"),encoding='utf-8')
print('Release metadata updated; dependency versions and original source bytes unchanged.')
