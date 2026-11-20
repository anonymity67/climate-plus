"""Freeze bounded OSM channel snapshots; no runtime dependency on Overpass."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import datetime, timezone
import json, hashlib, argparse

ROOT=Path(__file__).resolve().parents[1]
AREAS={'dhaka':[90.20,23.65,90.60,24.12], 'sylhet':[91.80,24.85,91.94,24.96], 'dacope':[89.40,22.40,89.70,22.70]}
parser=argparse.ArgumentParser();parser.add_argument('--area',choices=AREAS,required=True);args=parser.parse_args()
folder=ROOT/'research/gis/waterways-v4'/args.area;folder.mkdir(parents=True,exist_ok=True)
if (folder/'osm.json').exists():
    raise SystemExit('Frozen source exists; preserve it and acquire a new dated version for refresh.')
w,s,e,n=AREAS[args.area]
query=f'[out:json][timeout:45];way["waterway"~"^(river|stream|canal|drain|ditch)$"]({s},{w},{n},{e});out body geom;'
(folder/'query.overpassql').write_text(query+'\n',encoding='utf-8')
errors=[]
for endpoint in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
    try:
        request=Request(endpoint,data=urlencode({'data':query}).encode(),headers={'User-Agent':'ClimatePlus-Water-Research/4.0 (bounded snapshot; no runtime requests)','Content-Type':'application/x-www-form-urlencoded'})
        with urlopen(request,timeout=65) as response:data=response.read()
        value=json.loads(data)
        if value.get('remark') or not value.get('elements'):raise ValueError(value.get('remark','Empty result'))
        (folder/'osm.json').write_bytes(data)
        meta=dict(area=args.area,bounds=[w,s,e,n],endpoint=endpoint,acquiredAt=datetime.now(timezone.utc).isoformat(),osmBaseTimestamp=value.get('osm3s',{}).get('timestamp_osm_base'),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),ways=len(value['elements']),attribution='© OpenStreetMap contributors',license='ODbL 1.0',licenseUrl='https://opendatacommons.org/licenses/odbl/1-0/',sourceUrl='https://www.openstreetmap.org/copyright',meaning='Mapped channel geometry and shared-node connectivity only; flow, contamination transport and present conditions are unverified.')
        (folder/'source.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(meta),flush=True);break
    except Exception as error:
        errors.append(str(error));print(endpoint,str(error),flush=True)
else:raise SystemExit('Acquisition failed: '+'; '.join(errors))
