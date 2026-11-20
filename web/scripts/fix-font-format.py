from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
font=root/'public/fonts/manrope-latin.woff2'
if font.read_bytes()[:4]==b'\x00\x01\x00\x00':
 shutil.copy2(font,font.with_suffix('.ttf'))
 css=root/'src/styles.css';s=css.read_text(encoding='utf-8').replace("manrope-latin.woff2') format('woff2')","manrope-latin.ttf') format('truetype')");css.write_text(s,encoding='utf-8')
 p=root.parent/'video/prepare-assets.py';p.write_text(p.read_text().replace('manrope-latin.woff2','manrope-latin.ttf'))
print('Font container signature and CSS format aligned.')
