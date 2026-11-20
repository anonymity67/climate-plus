from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'src/App.jsx';s=p.read_text(encoding='utf-8');s=s.replace("function confirm(){setClockNow(Date.now());setConfirmed(true);setNoticeTime(new Date().toISOString());", "function confirm(){const now=Date.now();setClockNow(now);setConfirmed(true);setNoticeTime(new Date(now).toISOString());")
local_line="const localEvm=typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname);"
s=s.replace(local_line+'\n ','')
s=s.replace("const Icon=ICONS[scenario];", local_line+"\n const Icon=ICONS[scenario];")
s=s.replace('disabled={!audit||busy} onClick={anchor}', 'disabled={!audit||busy||!localEvm} onClick={anchor}')
s=s.replace('Local EVM anchoring requires the local companion service.', 'Local EVM anchoring is available through the local source package and companion service.')
p.write_text(s,encoding='utf-8')
p=root/'src/PollutionPanel.jsx';s=p.read_text(encoding='utf-8').replace('Interactive map of published measurement coordinates. Use the station selector for keyboard access.','Interactive map of source-labelled measurement coordinates. Use the station selector for keyboard access.');s=s.replace('<div className="screen-index"><strong>', '<div className="screen-index"><strong style={{color:screen.failed?\'#9c4035\':\'#52675f\'}}>');p.write_text(s,encoding='utf-8')
docs=root/'documentation';docs.mkdir(exist_ok=True)
for f in (root.parent/'docs').glob('*.md'):(docs/f.name).write_bytes(f.read_bytes())
print('Release labels, confirmation timestamp and documentation synchronized.')
