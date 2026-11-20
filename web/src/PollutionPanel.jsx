import React, { useEffect, useMemo, useState } from 'react';
import { ResearchMap } from './components/ResearchMap.jsx';
import {
  MapPin,
  FlaskConical,
  ShieldCheck,
  Download,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Check,
  Layers,
  Leaf,
} from 'lucide-react';
import {
  screenWater,
  mixLoad,
  inferDO,
  validateObservation,
  OBJECTIVE_PROFILE,
} from './water-engine.mjs';
import { receipt } from './engine.mjs';
import './pollution.css';

const num = (v, d = 2) =>
  v == null ? 'Not measured' : v.toLocaleString('en-US', { maximumFractionDigits: d });
const pc = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');
function save(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PollutionPanel({ initialMode = 'map' } = {}) {
  const [traceOverride, setTraceOverride] = useState(null),
    [traceText, setTraceText] = useState(''),
    [traceError, setTraceError] = useState('');
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [mode, setMode] = useState(initialMode),
    [river, setRiver] = useState('All rivers'),
    [year, setYear] = useState('2021'),
    [layer, setLayer] = useState('quality'),
    [selected, setSelected] = useState(null),
    [surveySelected, setSurveySelected] = useState(null),
    [hydroId, setHydroId] = useState('KC1'),
    [reduction, setReduction] = useState(0.5),
    [tolerance, setTolerance] = useState(0.2),
    [caseStatus, setCaseStatus] = useState(''),
    [custom, setCustom] = useState({}),
    [importText, setImportText] = useState(''),
    [importError, setImportError] = useState(''),
    [imported, setImported] = useState(null),
    [caseCount, setCaseCount] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem('climate-investigations') || '[]').length;
      } catch {
        return 0;
      }
    });
  useEffect(() => {
    fetch('/data/water-evidence.json')
      .then((r) => {
        if (!r.ok) throw Error('Dataset unavailable');
        return r.json();
      })
      .then(setData)
      .catch(() =>
        setError(
          'The evidence file could not load. Reload the page or run the local build with public/data/water-evidence.json.',
        ),
      );
  }, []);
  const rivers = useMemo(
    () => (data ? ['All rivers', ...new Set(data.observations.map((r) => r.river))].sort() : []),
    [data],
  );
  const locations = useMemo(() => {
    if (!data) return [];
    const records = data.observations
      .filter(
        (r) =>
          (river === 'All rivers' || r.river === river) &&
          (year === 'All years' || r.date.startsWith(year)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const sites = new Map();
    records.forEach((r) => {
      if (!sites.has(r.site)) sites.set(r.site, r);
    });
    return [...sites.values()].sort((a, b) => a.site.localeCompare(b.site));
  }, [data, river, year]);
  useEffect(() => {
    setSelected(locations[0] || null);
    setCustom({});
    setImported(null);
    setCaseStatus('');
  }, [locations]);
  const active = imported || selected,
    screen = active ? screenWater(active) : null;
  const hydro =
    traceOverride || data?.hydraulics.find((h) => h.id === hydroId) || data?.hydraulics[0];
  const mixture = hydro ? mixLoad(hydro, reduction, tolerance) : null;
  const modelInputs = useMemo(() => {
    if (!active) return null;
    const read = (key, fallback) => {
      const raw = custom[key] ?? fallback;
      return raw === null || raw === undefined || raw === '' ? null : Number(raw);
    };
    const month = read('month', active.date.slice(5, 7)),
      turbidity = read('turbidity', active.turbidity),
      validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
    return {
      temp: read('temp', active.temp),
      ph: read('ph', active.ph),
      cod: read('cod', active.cod),
      rainfall: read('rainfall', active.rainfall),
      logTurbidity:
        turbidity !== null && Number.isFinite(turbidity) && turbidity >= 0
          ? Math.log1p(turbidity)
          : null,
      monthSin: validMonth ? Math.sin((2 * Math.PI * month) / 12) : null,
      monthCos: validMonth ? Math.cos((2 * Math.PI * month) / 12) : null,
    };
  }, [active, custom]);
  const estimate = data && modelInputs ? inferDO(data.model, modelInputs) : null;
  async function exportCase() {
    if (!active) return;
    const draft = {
      schema: 'climate-plus/investigation-v1',
      createdAt: new Date().toISOString(),
      status: 'unverified investigation draft',
      observation: active,
      screening: screen,
      sourceHypothesis: 'Unassigned. Sampling location does not establish an emitter.',
      nextSteps: [
        'Confirm instrument/laboratory QA and current conditions',
        'Collect authorized paired upstream, outfall and downstream samples with flow and custody records',
        'Investigate sewage, industrial and runoff pathways; do not infer cause from proximity',
      ],
      sources: imported ? [] : data.sources,
      objectiveProfile: OBJECTIVE_PROFILE,
    };
    const r = await receipt(draft);
    save('climate-plus-investigation-' + active.id + '.json', r);
    try {
      const old = JSON.parse(localStorage.getItem('climate-investigations') || '[]');
      const next = [
        { id: active.id, date: active.date, digest: r.digest, createdAt: draft.createdAt },
        ...old.filter((x) => x.id !== active.id),
      ].slice(0, 100);
      localStorage.setItem('climate-investigations', JSON.stringify(next));
      setCaseCount(next.length);
      setCaseStatus('Investigation receipt exported. Draft summary saved only in this browser.');
    } catch {
      setCaseStatus('Receipt exported. Browser storage is unavailable.');
    }
  }
  function importRecord() {
    try {
      const r = JSON.parse(importText);
      const check = validateObservation(r);
      if (!check.valid) {
        setImportError(check.errors.join(' '));
        return;
      }
      setImported({
        ...r,
        id: 'USER-' + Date.now(),
        site: 'User observation',
        location: r.location || 'User-entered sampling location',
        river: r.river || 'Unspecified',
        provenance: 'user supplied; not independently verified',
      });
      setImportError('');
      setLayer('quality');
      setMode('map');
      setCaseStatus('User observation loaded; keep the source and custody record with it.');
    } catch {
      setImportError('Use valid JSON matching the sample format.');
    }
  }
  if (error)
    return (
      <div className="panel explanation" role="alert">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="panel explanation" role="status">
        Loading attributed water-quality measurements and validation results…
      </div>
    );
  return (
    <div className="pollution">
      <div className="water-intro">
        <div>
          <h2>From a water sample to a defensible investigation.</h2>
          <p>
            {imported
              ? 'User-entered observation. Explicit objectives. No automated polluter accusations.'
              : 'Published Bangladesh measurements. Explicit objectives. No automated polluter accusations.'}
          </p>
        </div>
        <span className="data-stamp">
          {imported ? 'User-entered · unverified' : 'Historical data · 2017–2025'}
        </span>
      </div>
      <div className="water-tabs" role="tablist" aria-label="Water evidence views">
        {[
          ['map', 'Pollution & GIS'],
          ['trace', 'Source investigation'],
          ['model', 'Model validation'],
          ['input', 'Enter an observation'],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={mode === id}
            className={mode === id ? 'selected' : ''}
            key={id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'map' && (
        <>
          <div className="water-filters">
            <label>
              Map layer
              <select value={layer} onChange={(e) => setLayer(e.target.value)}>
                <option value="quality">Dhaka water measurements</option>
                <option value="survey">Sylhet velocity survey</option>
              </select>
            </label>
            {layer === 'quality' && (
              <>
                <label>
                  River
                  <select value={river} onChange={(e) => setRiver(e.target.value)}>
                    {rivers.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Observation year
                  <select value={year} onChange={(e) => setYear(e.target.value)}>
                    {['2021', '2020', '2019', '2018', '2017', 'All years'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="station-select">
                  Sampling location
                  <select
                    value={selected?.id || ''}
                    onChange={(e) => {
                      setSelected(locations.find((r) => r.id === e.target.value));
                      setImported(null);
                      setCustom({});
                      setCaseStatus('');
                    }}
                  >
                    {locations.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.location} · {r.river}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="water-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>
                  {layer === 'quality'
                    ? imported
                      ? 'User-entered sampling location'
                      : 'Measured water-quality locations'
                    : 'Measured velocity survey'}
                </h2>
                <span>
                  {layer === 'quality'
                    ? imported
                      ? '1 user-entered location'
                      : locations.length + ' selected published samples'
                    : '40 published survey locations'}
                </span>
              </div>
              <ResearchMap
                rows={layer === 'quality' ? (imported ? [imported] : locations) : data.survey}
                layer={layer}
                selected={layer === 'quality' ? active : surveySelected}
                onSelect={(r) =>
                  layer === 'quality'
                    ? (imported ? setImported(r) : setSelected(r), setCustom({}))
                    : setSurveySelected(r)
                }
              />
              <p className="map-caption">
                {layer === 'quality'
                  ? imported
                    ? 'Coordinates and measurements were supplied by the user and have not been independently verified. No repository author is the source of this observation.'
                    : 'Each marker uses the latest published sample within the selected year. Dates differ between locations; this is not a simultaneous or current pollution map.'
                  : 'May 16, 2025 velocity-survey coordinates. These are not the differently named February pollution stations; no unverified spatial join is made.'}
              </p>
              <div className="water-source">
                {imported && layer === 'quality' ? (
                  <span>User supplied · unverified · no publisher attribution</span>
                ) : (
                  <>
                    <a
                      href={layer === 'quality' ? data.sources[0].url : data.sources[1].url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {layer === 'quality'
                        ? 'Sinha et al. · Dhaka dataset'
                        : 'Banik et al. · BASIS v2'}{' '}
                      <ExternalLink size={13} />
                    </a>
                    <span>CC BY 4.0 · transformed with attribution</span>
                  </>
                )}
              </div>
            </section>
            <aside className="panel water-inspector">
              {layer === 'survey' ? (
                <>
                  <h2>{surveySelected?.id || 'Select a survey marker'}</h2>
                  <p>Published hydraulic context, separate from pollution measurements.</p>
                  {surveySelected && (
                    <dl>
                      <div>
                        <dt>Survey date</dt>
                        <dd>{surveySelected.date}</dd>
                      </div>
                      <div>
                        <dt>Mean velocity</dt>
                        <dd>{num(surveySelected.velocity, 3)} m/s</dd>
                      </div>
                      <div>
                        <dt>Chainage</dt>
                        <dd>{num(surveySelected.chainage)} m</dd>
                      </div>
                      <div>
                        <dt>Coordinates</dt>
                        <dd>
                          {surveySelected.latitude}, {surveySelected.longitude}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p className="water-caution">
                    The workbook lacks coordinates for its 62 water-quality stations. Assigning
                    those measurements to these survey points would be unsupported.
                  </p>
                </>
              ) : active ? (
                <>
                  <div className="sample-title">
                    <MapPin size={20} />
                    <h2>{active.location}</h2>
                  </div>
                  <p>
                    {active.river} · sampled {active.date}
                  </p>
                  <div className="screen-index">
                    <strong style={{ color: screen.failed ? '#9c4035' : '#52675f' }}>
                      {screen.index == null ? '—' : Math.round(screen.index)}
                      <span>/100</span>
                    </strong>
                    <div>
                      <b>Objective exceedance index</b>
                      <small>
                        {screen.failed} of {screen.tested} valid tested parameters exceed the
                        selected objectives.
                      </small>
                    </div>
                  </div>
                  <p className="partial-note">
                    Partial screen: {screen.tested}/12 listed parameters. A zero score would not
                    establish clean or safe water.
                  </p>
                  <div className="parameter-list">
                    {screen.tests.map((t) => (
                      <div key={t.key}>
                        <div>
                          <strong>{t.name}</strong>
                          <small>
                            {t.min !== undefined ? '≥ ' + t.min : ''}
                            {t.min !== undefined && t.max !== undefined ? ' and ' : ''}
                            {t.max !== undefined ? '≤ ' + t.max : ''} {t.unit}
                          </small>
                        </div>
                        <b className={t.failed ? 'exceeded' : 'within'}>
                          {num(t.value)} {t.key === 'ph' ? '' : 'mg/L'}
                          <small>
                            {t.failed ? 'Objective exceeded' : 'Within selected objective'}
                          </small>
                        </b>
                      </div>
                    ))}
                  </div>
                  {screen.excluded.length > 0 && (
                    <p className="water-caution">
                      Excluded:{' '}
                      {screen.excluded.map((x) => x.key + ' (' + x.reason + ')').join(', ')}.
                    </p>
                  )}
                  <details>
                    <summary>Method, missing evidence and standards</summary>
                    <p>
                      Index = 100 × failed valid tests ÷ valid tests. It is a transparent exceedance
                      percentage, not a validated all-pollutant risk score. The standard CCME index
                      is withheld because only three parameters have unambiguous matched objectives.
                    </p>
                    <p>
                      Bangladesh ECR 2023, Schedule 2, inland fisheries row: pH 6–9, DO ≥5 mg/L, COD
                      ≤50 mg/L. This retrospective comparison is not a historical legal-compliance
                      ruling or drinking-water assessment.
                    </p>
                    <p>
                      Nitrate/phosphate chemical forms, microbiology and metals remain unresolved or
                      unmeasured. Lab custody and original QA are not supplied by the repository.
                    </p>
                    <a href={OBJECTIVE_PROFILE.source} target="_blank" rel="noreferrer">
                      Official Gazette, PDF page 53
                    </a>
                  </details>
                  <button className="primary full" onClick={exportCase}>
                    Create investigation receipt <Download size={16} />
                  </button>
                  {caseStatus && (
                    <p className="case-status" role="status">
                      {caseStatus}
                    </p>
                  )}
                </>
              ) : (
                <p>No observations match this filter.</p>
              )}
            </aside>
          </div>
          {layer === 'quality' && active && (
            <section className="panel mitigation">
              <div className="panel-head">
                <h2>Mitigation starts with the right evidence.</h2>
                <span>Actions for a responsible field team</span>
              </div>
              <div className="mitigation-grid">
                <div>
                  <FlaskConical size={22} />
                  <h3>Confirm the impairment</h3>
                  <p>
                    {typeof active.do !== 'number'
                      ? 'Dissolved oxygen is not measured. Obtain a calibrated DO reading before assessing oxygen stress.'
                      : active.do < 5
                        ? 'Low dissolved oxygen warrants repeat calibrated DO measurements and investigation of oxygen demand.'
                        : 'Repeat sampling to establish whether these selected objectives remain met.'}{' '}
                    Measure BOD, relevant nutrients, microbes and sector-specific chemicals where
                    indicated.
                  </p>
                </div>
                <div>
                  <MapPin size={22} />
                  <h3>Trace the pathway</h3>
                  <p>
                    Sample upstream, suspected outfall and a well-mixed downstream section with
                    concurrent flow measurements. Record custody and operating conditions. Facility
                    proximity alone is not attribution.
                  </p>
                </div>
                <div>
                  <Leaf size={22} />
                  <h3>Verify the response</h3>
                  <p>
                    After an authorized source intervention, repeat the same measurements under
                    comparable flow. Track pollutant load as well as concentration, energy,
                    sludge/brine disposal and service effects.
                  </p>
                </div>
              </div>
              <button className="text-link" onClick={() => setMode('trace')}>
                Test a measured drain contribution <ArrowRight size={16} />
              </button>
            </section>
          )}
        </>
      )}
      {mode === 'trace' && hydro && (
        <>
          <div className="signal neutral">
            <ShieldCheck size={23} />
            <div>
              <strong>Measured drainage contribution, not a named polluter.</strong>
              <p>
                BASIS v2 provides six drain/upstream/downstream hydraulic groups. No industrial
                facility attribution is established.
              </p>
            </div>
          </div>
          <div className="water-filters">
            <label>
              Published hydraulic group
              <select
                value={traceOverride ? 'custom' : hydro.id}
                onChange={(e) => {
                  setHydroId(e.target.value);
                  setTraceOverride(null);
                  setTraceError('');
                }}
              >
                {traceOverride && <option value="custom">User-supplied paired measurements</option>}
                {data.hydraulics.map((h) => (
                  <option value={h.id} key={h.id}>
                    {h.id} · {h.channel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assumed source concentration reduction<strong>{Math.round(reduction * 100)}%</strong>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={reduction * 100}
                onChange={(e) => setReduction(+e.target.value / 100)}
              />
            </label>
            <label>
              Analyst closure tolerance<strong>{Math.round(tolerance * 100)}%</strong>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={tolerance * 100}
                onChange={(e) => setTolerance(+e.target.value / 100)}
              />
            </label>
          </div>
          <div className="two-column">
            <section className="panel explanation">
              <h2>Can the measured inputs explain the downstream sample?</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Flow m³/s</th>
                      <th>{hydro.units.concentration}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Upstream', 'qu', 'cu'],
                      ['Drain', 'qs', 'cs'],
                      ['Downstream', 'qd', 'cd'],
                    ].map(([label, q, c]) => (
                      <tr key={label}>
                        <th>{label}</th>
                        <td>{num(hydro[q], 4)}</td>
                        <td>{num(hydro[c], 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {traceOverride
                  ? 'User-supplied paired measurements. Laboratory method, timing and flow comparability require review.'
                  : 'Published concentration means were multiplied by 10⁵ to restore CFU/100 mL. Replicates are not separate independent sites. Timestamp and coordinates are absent from this worksheet.'}
              </p>
              <div className="formula">
                Ĉ downstream = (Q upstream × C upstream + Q drain × C drain) / (Q upstream + Q
                drain)
              </div>
              <dl className="trace-metrics">
                <div>
                  <dt>Predicted downstream concentration</dt>
                  <dd>
                    {num(mixture.predicted)} {hydro.units.concentration}
                  </dd>
                </div>
                <div>
                  <dt>Measured downstream concentration</dt>
                  <dd>
                    {num(hydro.cd)} {hydro.units.concentration}
                  </dd>
                </div>
                <div>
                  <dt>Flow closure discrepancy</dt>
                  <dd>{pc(Math.abs(mixture.flowClosure))}</dd>
                </div>
                <div>
                  <dt>Load closure discrepancy</dt>
                  <dd>{pc(mixture.loadClosure == null ? null : Math.abs(mixture.loadClosure))}</dd>
                </div>
              </dl>
              <div
                className={'verification ' + (mixture.status === 'closure-failed' ? 'failed' : '')}
              >
                {mixture.status === 'closure-failed'
                  ? 'Closure failed: investigate unmeasured flows, mixing, timing and measurement error before drawing source conclusions.'
                  : 'Within the selected diagnostic tolerance. This supports further investigation, not source confirmation.'}
              </div>
              <p className="micro">
                Tolerance is an analyst diagnostic setting, not an established regulatory or
                statistically validated acceptance threshold.
              </p>
            </section>
            <section className="panel explanation">
              <h2>What would a source intervention change?</h2>
              <p>
                Assume {Math.round(reduction * 100)}% lower measured-pollutant concentration at the
                measured drain, unchanged flow and upstream conditions.
              </p>
              <div className="scenario-result">
                <span>Conditional predicted downstream concentration</span>
                <strong>{num(mixture.after, 0)}</strong>
                <span>{hydro.units.concentration}</span>
              </div>
              <dl className="trace-metrics">
                <div>
                  <dt>Drain share of measured incoming load</dt>
                  <dd>{pc(mixture.sourceShare)}</dd>
                </div>
                <div>
                  <dt>Predicted change from model baseline</dt>
                  <dd>{pc(mixture.predicted ? 1 - mixture.after / mixture.predicted : 0)}</dd>
                </div>
              </dl>
              <p className="water-caution">
                This is a what-if calculation, not a treatment-performance claim. Fecal coliform
                does not uniquely identify human sewage. Decay, settling, tidal reversal and unmixed
                plumes can invalidate the model.
              </p>
              <details>
                <summary>Use your own paired measurements</summary>
                <p>
                  Enter the same pollutant and units at all three locations. Flows are m³/s. This
                  enables an industrial or other source investigation without assuming a named
                  emitter.
                </p>
                <textarea
                  className="trace-json"
                  aria-label="Paired measurement JSON"
                  rows="8"
                  value={traceText}
                  onChange={(e) => setTraceText(e.target.value)}
                  placeholder={
                    '{"qu":1,"qs":0.1,"qd":1.1,"cu":10,"cs":100,"cd":20,"units":{"flow":"m3/s","concentration":"mg/L"},"pollutant":"COD"}'
                  }
                />
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      const h = JSON.parse(traceText);
                      if (
                        h.units?.flow !== 'm3/s' ||
                        !['mg/L', 'CFU/100mL'].includes(h.units?.concentration) ||
                        typeof h.pollutant !== 'string' ||
                        !h.pollutant.trim()
                      )
                        throw Error(
                          'Declare pollutant, flow m3/s and concentration mg/L or CFU/100mL.',
                        );
                      mixLoad(h, reduction, tolerance);
                      setTraceOverride({
                        ...h,
                        id: 'custom',
                        channel: 'User supplied; unverified',
                        provenance: 'user supplied',
                      });
                      setTraceError('');
                    } catch (e) {
                      setTraceError(e.message);
                    }
                  }}
                >
                  Validate paired inputs
                </button>
                {traceError && (
                  <p className="verification failed" role="alert">
                    {traceError}
                  </p>
                )}
              </details>
              <h3>For suspected industrial waste</h3>
              <p>
                Document the permitted discharge point and drainage connection; request
                sector-relevant laboratory tests and effluent-treatment records through an
                authorized investigator. Do not treat microbial or COD results as a chemical
                fingerprint of a particular factory.
              </p>
              <button
                className="secondary"
                onClick={() =>
                  save('climate-plus-source-investigation.json', {
                    source: traceOverride ? 'user supplied; unverified' : data.sources[1],
                    hydraulicInput: hydro,
                    reduction,
                    tolerance,
                    result: mixture,
                    status: 'conditional research scenario; no confirmed emitter',
                  })
                }
              >
                Export source scenario <Download size={16} />
              </button>
            </section>
          </div>
        </>
      )}
      {mode === 'model' && (
        <>
          <div className="signal neutral">
            <FlaskConical size={23} />
            <div>
              <strong>A trained model predicts measured DO, not a recycled pollution label.</strong>
              <p>
                Frozen temporal test. WQI and Pollution_Label are excluded. Estimates never replace
                measurements in the pollution index.
              </p>
            </div>
          </div>
          <div className="two-column">
            <section className="panel explanation">
              <h2>Held-out performance</h2>
              <p>{data.evaluation.selected} · target: dissolved oxygen in mg/L</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>2021 test</th>
                      <th>Trained model</th>
                      <th>Monthly median baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['MAE (mg/L)', 'mae'],
                      ['RMSE (mg/L)', 'rmse'],
                      ['R²', 'r2'],
                      ['Bias (mg/L)', 'bias'],
                    ].map(([label, key]) => (
                      <tr key={key}>
                        <th>{label}</th>
                        <td>{num(data.evaluation.model[key], 3)}</td>
                        <td>{num(data.evaluation.baseline[key], 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="trace-metrics">
                {Object.entries(data.evaluation.splits).map(([name, s]) => (
                  <div key={name}>
                    <dt>
                      {name} · {s.period}
                    </dt>
                    <dd>{s.rows} records</dd>
                  </div>
                ))}
                <div>
                  <dt>Nominal 90% interval · actual test coverage</dt>
                  <dd>{pc(data.evaluation.interval.testCoverage)}</dd>
                </div>
                <div>
                  <dt>Test inputs outside numeric training range</dt>
                  <dd>{data.evaluation.testOutsideDomain}</dd>
                </div>
              </dl>
              <p>
                Model choice uses early 2020 only; later 2020 calibrates residual intervals.
                Stations may recur across years. This is not unseen-basin or prospective validation.
              </p>
              <a className="text-link" href="/data/water-validation.json" target="_blank">
                Inspect every test prediction <ExternalLink size={15} />
              </a>
            </section>
            <section className="panel explanation">
              <h2>Run the frozen model</h2>
              <p>
                Context: {active?.location || 'select a Dhaka station'} · {active?.date}. Edit
                inputs for a research estimate.
              </p>
              <div className="model-inputs">
                {[
                  ['temp', 'Temperature °C'],
                  ['ph', 'pH'],
                  ['cod', 'COD mg/L'],
                  ['turbidity', 'Turbidity NTU'],
                  ['rainfall', 'Rainfall mm'],
                  ['month', 'Month 1–12'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      step={key === 'month' ? '1' : 'any'}
                      min={key === 'month' ? '1' : undefined}
                      max={key === 'month' ? '12' : undefined}
                      value={
                        custom[key] ??
                        (key === 'month'
                          ? +(active?.date?.slice(5, 7) || 1)
                          : (active?.[key] ?? ''))
                      }
                      onChange={(e) => setCustom({ ...custom, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              {estimate?.status === 'outside-domain' ? (
                <p className="water-caution">
                  Model abstains: missing or out-of-training-range inputs (
                  {estimate.fields.join(', ')}). Obtain a field measurement.
                </p>
              ) : (
                estimate && (
                  <div className="model-estimate">
                    <strong>{num(estimate.value)} mg/L</strong>
                    <span>Research DO estimate</span>
                    <p>
                      Approximate interval: {num(estimate.lower)}–{num(estimate.upper)} mg/L
                    </p>
                    <small>Historical measured DO at this sample: {num(active?.do)} mg/L</small>
                  </div>
                )
              )}
              <p className="micro">
                The model uses contemporaneous measurements, not future weather. Dataset QA is
                incomplete; no automated safety, compliance or enforcement action should depend on
                this estimate.
              </p>
            </section>
          </div>
        </>
      )}
      {mode === 'input' && (
        <section className="panel explanation">
          <h2>Bring a measured observation</h2>
          <p>
            Explicit units and WGS84 coordinates are required. User-supplied records remain
            unverified. A missing parameter stays missing.
          </p>
          <label className="json-label" htmlFor="water-json">
            Observation JSON
            <textarea
              id="water-json"
              rows="12"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                '{\n  "date": "2026-10-20",\n  "location": "Your sampling station",\n  "latitude": 23.8,\n  "longitude": 90.4,\n  "ph": 7.2,\n  "do": 4.1,\n  "cod": 65,\n  "units": {"do": "mg/L", "cod": "mg/L"}\n}'
              }
            />
          </label>
          <button className="primary" onClick={importRecord}>
            Validate and screen observation <Check size={16} />
          </button>
          {importError && (
            <p className="verification failed" role="alert">
              {importError}
            </p>
          )}
          <p className="micro">
            This loads the observation into this browser session only. Attach instrument
            calibration, laboratory method, sample custody and reviewer approval in a real
            deployment.
          </p>
        </section>
      )}
      <div className="water-footer">
        <span>
          {data.observations.length} source records · {data.qualityAudit.locations} Dhaka locations
          · {caseCount} local investigation drafts
        </span>
        <a href="/data/water-stations.geojson" target="_blank">
          GeoJSON export <Download size={14} />
        </a>
      </div>
      <details className="data-audit">
        <summary>Dataset quality and provenance audit</summary>
        <p>
          {data.qualityAudit.invalidCells.length} source rows contain invalid numeric values
          excluded from relevant calculations; {data.qualityAudit.excludedModelRows} rows excluded
          from model training/evaluation. Original files remain unchanged.
        </p>
        <p>
          {data.qualityAudit.labelWarning} {data.qualityAudit.chemicalFormWarning}
        </p>
        <p>{data.qualityAudit.coordinateWarning}</p>
        {data.sources.map((s) => (
          <p key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.authors} · {s.doi}
            </a>{' '}
            · {s.license}
            <br />
            <code>SHA-256: {s.sha256}</code>
          </p>
        ))}
        <p>
          Adapted and normalized by Climate++. Original contributors do not endorse this product.
          Historical samples do not establish present-day conditions.
        </p>
      </details>
    </div>
  );
}
