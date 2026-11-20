from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/PollutionPanel.jsx';s=p.read_text(encoding='utf-8')
def edit(a,b):
 global s
 if a not in s:raise ValueError(a[:80])
 s=s.replace(a,b)
edit("const [data,setData]", "const [traceOverride,setTraceOverride]=useState(null),[traceText,setTraceText]=useState(''),[traceError,setTraceError]=useState('');\n const [data,setData]")
edit("const hydro=data?.hydraulics.find(h=>h.id===hydroId)||data?.hydraulics[0];", "const hydro=traceOverride||(data?.hydraulics.find(h=>h.id===hydroId)||data?.hydraulics[0]);")
start=s.index(' const modelInputs=useMemo(');end=s.index('\n const estimate=',start)
s=s[:start]+''' const modelInputs=useMemo(()=>{
  if(!active)return null;
  const read=(key,fallback)=>{const raw=custom[key]??fallback;return raw===null||raw===undefined||raw===''?null:Number(raw)};
  const month=read('month',active.date.slice(5,7)),turbidity=read('turbidity',active.turbidity),validMonth=Number.isInteger(month)&&month>=1&&month<=12;
  return {temp:read('temp',active.temp),ph:read('ph',active.ph),cod:read('cod',active.cod),rainfall:read('rainfall',active.rainfall),logTurbidity:turbidity!==null&&Number.isFinite(turbidity)&&turbidity>=0?Math.log1p(turbidity):null,monthSin:validMonth?Math.sin(2*Math.PI*month/12):null,monthCos:validMonth?Math.cos(2*Math.PI*month/12):null};
 },[active,custom]);'''+s[end:]
edit("value={hydro.id} onChange={e=>setHydroId(e.target.value)}", "value={traceOverride?'custom':hydro.id} onChange={e=>{setHydroId(e.target.value);setTraceOverride(null);setTraceError('')}}")
edit("{data.hydraulics.map(h=><option", "{traceOverride&&<option value=\"custom\">User-supplied paired measurements</option>}{data.hydraulics.map(h=><option")
edit('<th>FC CFU/100 mL</th>', '<th>{hydro.units.concentration}</th>')
edit('<dt>Predicted downstream FC</dt><dd>{num(mixture.predicted,0)} CFU/100 mL</dd>', '<dt>Predicted downstream concentration</dt><dd>{num(mixture.predicted)} {hydro.units.concentration}</dd>')
edit('<dt>Measured downstream FC</dt><dd>{num(hydro.cd,0)} CFU/100 mL</dd>', '<dt>Measured downstream concentration</dt><dd>{num(hydro.cd)} {hydro.units.concentration}</dd>')
edit('<p>Published concentration means were multiplied by 10⁵ to restore CFU/100 mL. Replicates are not separate independent sites. Timestamp and coordinates are absent from this worksheet.</p>', '<p>{traceOverride?\'User-supplied paired measurements. Laboratory method, timing and flow comparability require review.\':\'Published concentration means were multiplied by 10⁵ to restore CFU/100 mL. Replicates are not separate independent sites. Timestamp and coordinates are absent from this worksheet.\'}</p>')
edit('Assume {Math.round(reduction*100)}% lower fecal-coliform concentration', 'Assume {Math.round(reduction*100)}% lower measured-pollutant concentration')
edit('Conditional predicted downstream FC', 'Conditional predicted downstream concentration')
edit('<span>CFU / 100 mL</span>', '<span>{hydro.units.concentration}</span>')
anchor='<h3>For suspected industrial waste</h3>'
replacement='''<details><summary>Use your own paired measurements</summary><p>Enter the same pollutant and units at all three locations. Flows are m³/s. This enables an industrial or other source investigation without assuming a named emitter.</p><textarea className="trace-json" aria-label="Paired measurement JSON" rows="8" value={traceText} onChange={e=>setTraceText(e.target.value)} placeholder={'{"qu":1,"qs":0.1,"qd":1.1,"cu":10,"cs":100,"cd":20,"units":{"flow":"m3/s","concentration":"mg/L"},"pollutant":"COD"}'}/><button className="secondary" onClick={()=>{try{const h=JSON.parse(traceText);if(h.units?.flow!=='m3/s'||!['mg/L','CFU/100mL'].includes(h.units?.concentration)||typeof h.pollutant!=='string'||!h.pollutant.trim())throw Error('Declare pollutant, flow m3/s and concentration mg/L or CFU/100mL.');mixLoad(h,reduction,tolerance);setTraceOverride({...h,id:'custom',channel:'User supplied; unverified',provenance:'user supplied'});setTraceError('');}catch(e){setTraceError(e.message)}}}>Validate paired inputs</button>{traceError&&<p className="verification failed" role="alert">{traceError}</p>}</details>'''+anchor
edit(anchor,replacement)
edit("source:data.sources[1],hydraulicInput:hydro", "source:traceOverride?'user supplied; unverified':data.sources[1],hydraulicInput:hydro")
edit("type=\"number\" step=\"any\" value={custom[key]", "type=\"number\" step={key==='month'?'1':'any'} min={key==='month'?'1':undefined} max={key==='month'?'12':undefined} value={custom[key]")
p.write_text(s,encoding='utf-8')
css=p.parent/'pollution.css';css.write_text(css.read_text()+'\n.trace-json{width:100%;padding:12px;border:1px solid #becfc2;border-radius:6px;font:12px/1.6 monospace;color:#183b35;margin:10px 0;resize:vertical}\n',encoding='utf-8')
print('Added validated industrial paired-input workflow and strict model blank handling.')
