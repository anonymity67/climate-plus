from pathlib import Path
from urllib.request import Request,urlopen
import re
root=Path(__file__).resolve().parents[1]
req=Request('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap',headers={'User-Agent':'Mozilla/5.0'})
css=urlopen(req,timeout=30).read().decode()
urls=re.findall(r'url\((https://[^)]+)\)',css)
data=urlopen(urls[-1],timeout=30).read()
out=root/'public/fonts';out.mkdir(parents=True,exist_ok=True)
(out/'manrope-latin.woff2').write_bytes(data)
(out/'SOURCE.txt').write_text('Manrope, Google Fonts. SIL Open Font License. CSS source: '+req.full_url+'\nAsset source: '+urls[-1]+'\n',encoding='utf-8')
print('Font downloaded:',len(data),'bytes')
