from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/PollutionPanel.jsx';s=p.read_text(encoding='utf-8')
def edit(a,b):
 global s
 if a not in s:raise ValueError(a[:80])
 s=s.replace(a,b)
edit('sources:data.sources,objectiveProfile:OBJECTIVE_PROFILE','sources:imported?[]:data.sources,objectiveProfile:OBJECTIVE_PROFILE')
edit('Published Bangladesh measurements. Explicit objectives. No automated polluter accusations.',"{imported?'User-entered observation. Explicit objectives. No automated polluter accusations.':'Published Bangladesh measurements. Explicit objectives. No automated polluter accusations.'}")
edit('Historical data · 2017–2025</span>',"{imported?'User-entered · unverified':'Historical data · 2017–2025'}</span>")
edit("{layer==='quality'?'Measured water-quality locations':'Measured velocity survey'}", "{layer==='quality'?(imported?'User-entered sampling location':'Measured water-quality locations'):'Measured velocity survey'}")
edit("{layer==='quality'?locations.length:40} published locations", "{layer==='quality'?(imported?'1 user-entered location':locations.length+' selected published samples'):'40 published survey locations'}")
edit("{layer==='quality'?'Each marker uses the latest published sample within the selected year. Dates differ between locations; this is not a simultaneous or current pollution map.':", "{layer==='quality'?(imported?'Coordinates and measurements were supplied by the user and have not been independently verified. No repository author is the source of this observation.':'Each marker uses the latest published sample within the selected year. Dates differ between locations; this is not a simultaneous or current pollution map.'):")
edit('<div className="water-source"><a href=', '<div className="water-source">{imported&&layer===\'quality\'?<span>User supplied · unverified · no publisher attribution</span>:<><a href=')
edit('CC BY 4.0 · transformed with attribution</span></div>', 'CC BY 4.0 · transformed with attribution</span></>}</div>')
edit("{active.do<5?'Low dissolved oxygen warrants repeat calibrated DO measurements and investigation of oxygen demand.':'Repeat sampling to establish whether these selected objectives remain met.'}", "{typeof active.do!=='number'?'Dissolved oxygen is not measured. Obtain a calibrated DO reading before assessing oxygen stress.':active.do<5?'Low dissolved oxygen warrants repeat calibrated DO measurements and investigation of oxygen demand.':'Repeat sampling to establish whether these selected objectives remain met.'}")
p.write_text(s,encoding='utf-8')
app=p.parent/'App.jsx';a=app.read_text(encoding='utf-8').replace("'Historical research data · no live alerts'","'Research workspace · no live alerts'").replace("'Published historical samples. Current conditions require fresh measurements.'","'Research screening. Current conditions require verified measurements.'");app.write_text(a,encoding='utf-8')
print('Fixed provenance and missing-measurement guidance.')
