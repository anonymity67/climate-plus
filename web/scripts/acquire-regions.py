#!/usr/bin/env python3
"""Fetch four small OSM road snapshots once; builds subsequently work offline."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import urllib.request
import urllib.parse
import time
import argparse
import shutil

ROOT = Path(__file__).resolve().parent.parent
REGIONS = {
    'ukhia': ('Ukhia', [92.118, 21.225, 92.150, 21.260]),
    'chattogram': ('Chattogram (Chittagong)', [91.812, 22.330, 91.850, 22.365]),
    'khulna': ('Khulna', [89.548, 22.805, 89.585, 22.840]),
    'tongi': ('Tongi', [90.385, 23.880, 90.425, 23.920]),
}
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', choices=list(REGIONS), help='Explicitly refresh one snapshot, retaining its prior bytes in history/')
    args = parser.parse_args()
    for region_id, (name, bounds) in REGIONS.items():
        if args.refresh and region_id != args.refresh:
            continue
        directory = ROOT / 'research/gis/regions-v3' / region_id
        directory.mkdir(parents=True, exist_ok=True)
        if (directory / 'source.json').exists():
            if args.refresh != region_id:
                print(region_id, 'existing frozen source retained', flush=True)
                continue
            old_source = json.loads((directory / 'source.json').read_text(encoding='utf-8'))
            history = directory / 'history' / old_source['sourceSha256'][:16]
            history.mkdir(parents=True, exist_ok=True)
            for filename in ('source.json','roads.overpass.json','query.overpassql'):
                shutil.copyfile(directory / filename, history / filename)
        west, south, east, north = bounds
        query = f'[out:json][timeout:90];way["highway"]({south},{west},{north},{east});out body geom;\n'
        (directory / 'query.overpassql').write_text(query, encoding='utf-8', newline='\n')
        errors = []
        for endpoint in ENDPOINTS:
            url = endpoint + '?' + urllib.parse.urlencode({'data': query})
            started = datetime.now(timezone.utc).isoformat()
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'ClimatePlus-Research-MVP/3.0 (bounded four-region OSM road snapshots)', 'Accept': 'application/json'})
                with urllib.request.urlopen(request, timeout=110) as response:
                    raw = response.read()
                    headers = dict(response.headers.items())
                    status = response.status
                parsed = json.loads(raw)
                if parsed.get('remark') or not parsed.get('elements'):
                    raise ValueError(parsed.get('remark') or 'empty source')
                (directory / 'roads.overpass.json').write_bytes(raw)
                metadata = {'regionId':region_id, 'name':name, 'bounds':bounds, 'endpoint':endpoint, 'requestUrl':url, 'queryFile':'query.overpassql', 'responseFile':'roads.overpass.json', 'acquisitionStartedAt':started, 'acquiredAt':datetime.now(timezone.utc).isoformat(), 'httpStatus':status, 'responseHeaders':headers, 'sourceSha256':hashlib.sha256(raw).hexdigest(), 'querySha256':hashlib.sha256(query.encode()).hexdigest(), 'osmBaseTimestamp':parsed.get('osm3s',{}).get('timestamp_osm_base'), 'attribution':'© OpenStreetMap contributors', 'licence':'Open Database License (ODbL) 1.0', 'licenceUrl':'https://opendatacommons.org/licenses/odbl/1-0/', 'copyrightUrl':'https://www.openstreetmap.org/copyright', 'sourceDocumentation':'https://dev.overpass-api.de/command_line.html', 'priorAttempts':errors}
                (directory / 'source.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')
                print(region_id, len(parsed['elements']), len(raw), metadata['sourceSha256'], flush=True)
                break
            except Exception as error:
                errors.append({'endpoint':endpoint, 'startedAt':started, 'error':str(error)})
                print(region_id, endpoint, str(error), flush=True)
        else:
            (directory / 'acquisition-errors.json').write_text(json.dumps(errors, indent=2)+'\n', encoding='utf-8')
            raise RuntimeError(f'All official endpoints failed for {region_id}')
        time.sleep(1)

if __name__ == '__main__':
    main()
