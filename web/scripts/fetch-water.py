"""Reacquire exact pinned, openly licensed files and verify publisher hashes."""
from pathlib import Path
from urllib.request import Request,urlopen
import hashlib,json
root=Path(__file__).resolve().parents[1]/'research/water'
for metadata_name,filename,output_name in [('dhaka-metadata.json','Water quality.csv','Water quality.csv'),('basis-metadata.json','BASIS_Framework_WaterQuality_Hydraulics_Dataset_V2.xlsx','basis-v2.xlsx')]:
 metadata=json.loads((root/metadata_name).read_text(encoding='utf-8'));file=next(f for f in metadata['files'] if f['filename']==filename);details=file['content_details'];target=root/output_name
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==details['sha256_hash']:
  print('Verified existing',output_name);continue
 data=urlopen(Request(details['download_url'],headers={'User-Agent':'Mozilla/5.0','Accept':'application/octet-stream'}),timeout=60).read()
 if hashlib.sha256(data).hexdigest()!=details['sha256_hash']:raise RuntimeError('Publisher checksum mismatch: '+filename)
 target.write_bytes(data);print('Downloaded and verified',output_name)
