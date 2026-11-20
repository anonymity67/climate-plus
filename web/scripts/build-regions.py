#!/usr/bin/env python3
"""Deterministic offline V3 regional graph/scenario build (stdlib only).

Acquire separately with acquire-regions.py. OSM raw bytes, exact queries and
retrieval provenance are frozen under research/gis/regions-v3. No road geometry
or Dacope source coordinates are translated to another region.
"""
from pathlib import Path
from collections import defaultdict
import argparse
import hashlib
import heapq
import importlib.util
import json

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('road_builder', ROOT / 'scripts/build-road-graph.py')
road = importlib.util.module_from_spec(spec)
spec.loader.exec_module(road)
canonical = road.canonical
REGIONS = ['dacope', 'ukhia', 'chattogram', 'khulna', 'tongi']

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical(value) + b'\n')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def bounded_rows(raw, bounds):
    west, south, east, north = bounds
    rows, excluded = [], defaultdict(int)
    for way in sorted(raw['elements'], key=lambda item:item['id']):
        if way['type'] != 'way':
            continue
        tags = way.get('tags', {})
        if tags.get('highway') not in road.PROFILE_ROADS:
            excluded['unsupportedHighway'] += 1
            continue
        if any(tags.get(key) in ('no','private') for key in ('access','vehicle','motor_vehicle','motorcar')):
            excluded['explicitAccessRestriction'] += 1
            continue
        pieces, piece = [], []
        for point in way.get('geometry', []):
            if west <= point['lon'] <= east and south <= point['lat'] <= north:
                piece.append([point['lon'], point['lat']])
            else:
                if len(piece) >= 2:
                    pieces.append(piece)
                piece = []
        if len(piece) >= 2:
            pieces.append(piece)
        for part, geometry in enumerate(pieces):
            # Unique deterministic source fid: preserve original way id separately.
            rows.append({**tags, 'fid':f'{way["id"]}p{part}', 'id':f'way/{way["id"]}', 'oneway':tags.get('oneway', 'yes' if tags.get('junction') == 'roundabout' else None), '_geometry':{'type':'LineString','coordinates':geometry}})
    return rows, dict(excluded)

def adjacency(graph):
    adj = defaultdict(list)
    for edge in graph['edges']:
        if edge['highway'] not in road.PROFILE_ROADS:
            continue
        adj[edge['from']].append((edge['to'],edge['lengthM'],edge['id']))
        if edge.get('bidirectional',True):
            adj[edge['to']].append((edge['from'],edge['lengthM'],edge['id']))
    return adj

def shortest(adj, origin, destination=None, blocked=frozenset()):
    distances, previous, queue = {origin:0}, {}, [(0, origin)]
    while queue:
        distance, node = heapq.heappop(queue)
        if distance != distances[node]:
            continue
        if node == destination:
            path = []
            while node != origin:
                node, edge = previous[node]
                path.append(edge)
            return distance, path[::-1]
        for target, length, edge in adj[node]:
            candidate = distance + length
            if edge not in blocked and candidate < distances.get(target,float('inf')):
                distances[target] = candidate
                previous[target] = (node,edge)
                heapq.heappush(queue,(candidate,target))
    return distances if destination is None else None

def choose_assets(graph, center):
    """Select actual local connected road nodes with a nontrivial replacement path."""
    adj = adjacency(graph)
    nodes = {node['id']:node['coordinates'] for node in graph['nodes']}
    ordered = sorted(adj, key=lambda node:(road.metres(nodes[node],center),node))
    for origin in ordered[:80]:
        distances = shortest(adj,origin)
        candidates = sorted((node for node,d in distances.items() if 500 <= d <= 2500), key=lambda node:(abs(distances[node]-1200),node))
        for destination in candidates[:80]:
            baseline = shortest(adj,origin,destination)
            for edge in baseline[1][1:-1] or baseline[1]:
                detour = shortest(adj,origin,destination,{edge})
                if detour and detour[0] > baseline[0] + 25 and detour[0] < baseline[0] * 6:
                    reachable = sorted(distances, key=lambda node:(distances[node],node))
                    extras = []
                    for node in sorted(reachable, key=lambda node:(abs(distances[node]-800),node)):
                        if node not in (origin,destination) and all(road.metres(nodes[node],nodes[old]) >= 80 for old in [origin,destination,*extras]):
                            extras.append(node)
                        if len(extras) == 4:
                            break
                    if len(extras) < 4:
                        continue
                    return [nodes[node] for node in [origin,destination,*extras]], [edge], {'baselineDistanceM':round(baseline[0],3),'closureDistanceM':round(detour[0],3),'originNodeId':origin,'destinationNodeId':destination}
    raise ValueError('No suitable real connected cycle and six spaced local role points')

def polygon(coordinate, half_width, region_id, label):
    x,y = coordinate
    return {'type':'Feature','properties':{'id':f'{region_id}-{label}', 'scenario':label, 'provenance':'representational','sourceLabel':'Declared demonstration polygon; not measured inundation or salinity'}, 'geometry':{'type':'Polygon','coordinates':[[[x-half_width,y-half_width],[x+half_width,y-half_width],[x+half_width,y+half_width],[x-half_width,y+half_width],[x-half_width,y-half_width]]]}}

def dacope():
    evidence = ROOT / 'research/gis/antar-v2'
    source = load(evidence / 'source.json')
    for item in source['files']:
        if sha(evidence / item['file']) != item['sha256']:
            raise ValueError(f'Antar source hash mismatch: {item["file"]}')
    graph = load(ROOT / 'public/data/dacope-road-graph.json')
    if graph['metadata']['sourceSha256'] != sha(ROOT / 'research/gis/v1/climate_gis.gpkg'):
        raise ValueError('Canonical Dacope graph does not match supplied source GeoPackage')
    network = load(evidence / 'gis-network.json')
    features = load(evidence / 'gis-network.geojson')['features']
    assets = [{'id':node['id'],'role':node['type'],'name':node['name'],'latitude':node['lat'],'longitude':node['lon'],'provenance':'representational','sourceLabel':'Antar supplied fictional Dacope service point; original coordinates preserved'} for node in network['nodes']]
    hazards = {f['properties']['id']:f for f in features if f['properties'].get('kind') == 'hazard'}
    for feature in hazards.values():
        feature['properties'].update({'provenance':'representational','sourceLabel':'Antar supplied fictional hazard geometry; not an official warning or measured extent'})
    # Respect fixed Antar assets; derive an explicit testable edge closure using
    # the same production engine in a bounded Node subprocess, not polygon claims.
    import subprocess
    script = "import fs from 'node:fs';import {createRoutingEngine} from './routing/engine.mjs';const g=JSON.parse(fs.readFileSync('public/data/dacope-road-graph.json'));const e=createRoutingEngine(g);const input="+json.dumps({'origin':next(a for a in assets if a['role']=='supplier'),'destination':next(a for a in assets if a['role']=='reserve')})+";const before=e.route(input);for(const id of before.routes[0].edgeIds){const after=e.route({...input,closures:[{edgeIds:[id]}]});if(after.status==='ok'&&after.routes[0].distanceM>before.routes[0].distanceM+25){console.log(JSON.stringify({edgeIds:[id],baselineDistanceM:before.routes[0].distanceM,closureDistanceM:after.routes[0].distanceM}));break;}}"
    result = subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,check=True,capture_output=True,text=True)
    proof = json.loads(result.stdout)
    bounds = graph['metadata']['bounds']
    return graph, assets, {'storm':{'moderate':hazards['storm-1'],'severe':hazards['storm-3']},'salinity':hazards['salinity-1']}, proof.pop('edgeIds'), proof, {'id':'dacope','name':'Dacope','bounds':bounds,'center':{'latitude':(bounds[1]+bounds[3])/2,'longitude':(bounds[0]+bounds[2])/2},'source':source}

def build(out):
    regions, report = [], {}
    for region_id in REGIONS:
        if region_id == 'dacope':
            graph, assets, hazards, blocked, proof, region = dacope()
        else:
            directory = ROOT / 'research/gis/regions-v3' / region_id
            source = load(directory / 'source.json')
            if sha(directory / 'roads.overpass.json') != source['sourceSha256']:
                raise ValueError(f'{region_id} raw response hash mismatch')
            raw = load(directory / 'roads.overpass.json')
            rows, excluded = bounded_rows(raw,source['bounds'])
            graph = road.build_topology(rows)
            graph['metadata'].update({'graphVersion':f'{region_id}-osm-shared-vertex-v3','regionId':region_id,'sourceFile':f'research/gis/regions-v3/{region_id}/roads.overpass.json','sourceSha256':source['sourceSha256'],'sourceTimestamp':source['osmBaseTimestamp'],'acquiredAt':source['acquiredAt'],'roadsSha256':road.digest(rows),'attribution':'© OpenStreetMap contributors, ODbL 1.0','sourceQueryBounds':source['bounds'],'excludedSourceWayCounts':excluded})
            graph['metadata']['limitations'] = [item for item in graph['metadata']['limitations'] if not item.startswith('All supplied one-way')]
            graph['metadata']['limitations'].extend(['OSM oneway tags are preserved; implicit roundabout one-way is applied. Missing direction is inferred bidirectional. Turn restrictions, conditional access, barriers, road suitability and traffic are not modelled.', 'Ways with explicit no/private access, vehicle, motor_vehicle or motorcar tags are excluded. Unspecified access is unverified.', 'Only contiguous source vertices inside the query extent are retained, without boundary interpolation or invented connecting roads. This bounded demonstration excludes primary/secondary/trunk roads and may fragment their adjoining streets.'])
            west,south,east,north = source['bounds']
            center = [(west+east)/2,(south+north)/2]
            positions, blocked, proof = choose_assets(graph,center)
            roles = ['supplier','reserve','pump','pond','school','crew']
            assets = [{'id':f'{region_id}-{role}','role':role,'name':f'{source["name"]} scenario {role}','latitude':point[1],'longitude':point[0],'provenance':'representational','sourceLabel':'Scenario role on a real local OSM road node; not an actual surveyed facility'} for role,point in zip(roles,positions)]
            blocked_edge = next(edge for edge in graph['edges'] if edge['id']==blocked[0])
            point = blocked_edge['coordinates'][len(blocked_edge['coordinates'])//2]
            hazards = {'storm':{'moderate':polygon(point,0.0010,region_id,'storm-moderate'),'severe':polygon(point,0.0018,region_id,'storm-severe')},'salinity':polygon(positions[3],0.0007,region_id,'salinity')}
            region = {'id':region_id,'name':source['name'],'bounds':source['bounds'],'center':{'latitude':center[1],'longitude':center[0]},'source':{key:source[key] for key in ('sourceSha256','acquiredAt','osmBaseTimestamp','endpoint','attribution','licence','licenceUrl','copyrightUrl')}}
            region['source']['evidencePath'] = f'research/gis/regions-v3/{region_id}/source.json'
        source = region['source']
        scenario = {'schema':'climate-plus/region-scenario-v1','regionId':region_id,'assets':assets,'hazards':hazards,'closures':{'storm':{severity:{'edgeIds':blocked,'provenance':'representational','sourceLabel':'Declared edge blockage to demonstrate a real network detour; not derived flood impact'} for severity in ('moderate','severe')}},'source':{'provenance':'representational','roadSource':source,'assetPlacement':'Original Antar coordinates' if region_id=='dacope' else 'Six local connected OSM road nodes selected deterministically; supplier/reserve chosen to demonstrate a cycle detour','hazardMeaning':'Fictional scenario polygons. Moderate and severe reuse one declared edge blockage; polygon size does not predict road closures.','routeVerification':proof}}
        for prefix in ('public/data/regions','backend/data/regions'):
            write(out / prefix / f'{region_id}-graph.json',graph)
        write(out / 'public/data/regions' / f'{region_id}-scenario.json',scenario)
        region.update({'graphUrl':f'/data/regions/{region_id}-graph.json','scenarioUrl':f'/data/regions/{region_id}-scenario.json'})
        regions.append(region)
        report[region_id] = {'nodes':len(graph['nodes']),'edges':len(graph['edges']),**proof}
    write(out / 'public/data/regions/index.json',{'schema':'climate-plus/region-index-v1','regions':regions})
    print(json.dumps(report,indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=ROOT)
    build(parser.parse_args().out)
