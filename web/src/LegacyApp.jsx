import React, { useMemo, useState } from 'react';
import {
  Waves,
  LayoutDashboard,
  GitCompareArrows,
  ClipboardCheck,
  ShieldCheck,
  Users,
  CloudLightning,
  Droplets,
  Sun,
  ArrowUpRight,
  ArrowRight,
  Check,
  Download,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  MapPin,
  Truck,
  Clock,
  FileCheck2,
  FlaskConical,
  Menu,
} from 'lucide-react';
import { WaterGISWorkspace } from './gis/WaterGISWorkspace.jsx';
import { LiveOperations, OperationsAccess } from './operations/LiveOperations.jsx';
import { PollutionMonitoring } from './operations/PollutionMonitoring.jsx';
import { applyGISScenario } from './gis-scenario.mjs';
import { isNoticeCurrent } from './notice.mjs';
import {
  SCENARIOS,
  scenarioConfig,
  plan,
  baseline,
  simulate,
  inspect,
  receipt,
  verifyReceipt,
  ENGINE_VERSION,
} from './engine.mjs';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (n) => (100 * n).toFixed(1) + '%';
const ICONS = { storm: CloudLightning, salinity: Droplets, dry: Sun };
const NAV = [
  ['operations', 'Live deliveries', Truck],
  ['monitoring', 'Pollution monitoring', FlaskConical],
  ['pollution', 'Data library & GIS', MapPin],
  ['desk', 'Continuity desk', LayoutDashboard],
  ['compare', 'Compare responses', GitCompareArrows],
  ['tasks', 'Action register', ClipboardCheck],
  ['residents', 'Resident notice', Users],
  ['evidence', 'Evidence & trust', ShieldCheck],
];
export function Network({ scenario = 'salinity', active = false, multiplier = 1 }) {
  const s = scenarioConfig(scenario);
  return (
    <svg
      className="network"
      viewBox="0 0 740 330"
      role="img"
      aria-label="Illustrative service network: three water points, two household catchments, a school and refill supplier. Not a geographic map."
    >
      <defs>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#c9d6ce" />
        </pattern>
      </defs>
      <rect width="740" height="330" fill="#f0f4ed" />
      <rect width="740" height="330" fill="url(#dots)" />
      <path
        d="M380 -30 C300 90 440 100 345 220 S270 330 350 370"
        stroke="#d1e4e6"
        strokeWidth="55"
        fill="none"
      />
      <text x="321" y="294" fill="#476c75" fontSize="12" transform="rotate(-24 321 294)">
        service boundary
      </text>
      <g strokeWidth="3" fill="none">
        <path
          d="M191 90 L290 90 L290 133"
          stroke={scenario === 'storm' ? '#b66b35' : active ? '#3e8f68' : '#a9bbb0'}
          strokeDasharray={scenario === 'storm' ? '5 5' : '0'}
        />
        <path
          d="M195 245 L290 245 L290 197"
          stroke={scenario === 'salinity' ? '#b66b35' : active ? '#3e8f68' : '#a9bbb0'}
          strokeDasharray={scenario === 'salinity' ? '5 5' : '0'}
        />
        <path
          d="M362 160 L487 65 M362 160 L487 180 M362 160 L487 285"
          stroke={active ? '#3e8f68' : '#a9bbb0'}
          strokeDasharray={active ? '0' : '7 5'}
        />
      </g>
      <g fontFamily="Manrope, sans-serif" fontSize="12" fill="#183b35">
        <rect x="36" y="52" width="155" height="73" rx="10" fill="white" stroke="#b9cec0" />
        <circle cx="57" cy="74" r="5" fill={scenario === 'storm' ? '#b66b35' : '#2c8058'} />
        <text x="70" y="79" fontWeight="700">
          Pump station
        </text>
        <text x="52" y="104" fill="#60736d">
          {scenario === 'storm' ? 'Offline · inspect' : 'Available in scenario'}
        </text>
        <rect
          x="32"
          y="211"
          width="163"
          height="73"
          rx="10"
          fill="white"
          stroke={scenario === 'salinity' ? '#c48960' : '#b9cec0'}
        />
        <circle cx="53" cy="233" r="5" fill={scenario === 'salinity' ? '#b66b35' : '#2c8058'} />
        <text x="66" y="238" fontWeight="700">
          Pond storage
        </text>
        <text x="48" y="263" fill="#60736d">
          {scenario === 'salinity' ? 'Held · quality review' : 'Available in scenario'}
        </text>
        <rect x="225" y="133" width="137" height="64" rx="10" fill="#183b35" />
        <text x="244" y="159" fill="white" fontWeight="700">
          Shared reserve
        </text>
        <text x="244" y="180" fill="#d8eadc">
          {fmt(s.initial)} L at start
        </text>
        <rect x="487" y="32" width="183" height="65" rx="10" fill="white" stroke="#b9cec0" />
        <text x="503" y="58" fontWeight="700">
          East catchment
        </text>
        <text x="503" y="79" fill="#60736d">
          {fmt(1200 * multiplier)} L / day
        </text>
        <rect x="487" y="148" width="183" height="65" rx="10" fill="white" stroke="#b9cec0" />
        <text x="503" y="174" fontWeight="700">
          West catchment
        </text>
        <text x="503" y="195" fill="#60736d">
          {fmt(800 * multiplier)} L / day
        </text>
        <rect x="487" y="253" width="183" height="65" rx="10" fill="#e1efd9" stroke="#a6c59c" />
        <text x="503" y="279" fontWeight="700">
          Community school
        </text>
        <text x="503" y="300" fill="#4e6855">
          {fmt(300 * multiplier)} L / day · priority floor
        </text>
      </g>
    </svg>
  );
}
export function Coverage({ result, reference }) {
  return (
    <div className="coverage">
      {['East catchment', 'West catchment', 'School'].map((label, i) => (
        <div className="coverage-row" key={label}>
          <div className="between">
            <span>{label}</span>
            <strong>{pct(result.coverage[i])}</strong>
          </div>
          <div className="track">
            <span className="bar-muted" style={{ width: pct(reference.coverage[i]) }} />
            <span className="bar-live" style={{ width: pct(result.coverage[i]) }} />
          </div>
          <small>Reference {pct(reference.coverage[i])}</small>
        </div>
      ))}
    </div>
  );
}
export function StockChart({ result, reference }) {
  const max = Math.max(
    ...result.rows.map((r) => r.open),
    ...reference.rows.map((r) => r.open),
    1000,
  );
  const points = (p) =>
    p.rows.map((r, i) => `${40 + i * 80},${140 - (110 * r.close) / max}`).join(' ');
  return (
    <svg
      viewBox="0 0 570 175"
      className="stock-chart"
      role="img"
      aria-label="Seven-day end-of-day usable stock, planned response versus reference"
    >
      <g fill="#52675f" fontSize="10">
        <text x="2" y="34">
          {fmt(max)}
        </text>
        <text x="2" y="89">
          {fmt(max / 2)}
        </text>
        <text x="15" y="144">
          0
        </text>
      </g>
      <g stroke="#e1e7df">
        {[30, 85, 140].map((y) => (
          <line key={y} x1="40" x2="530" y1={y} y2={y} />
        ))}
      </g>
      <polyline
        points={points(reference)}
        stroke="#b3bdb0"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray="5 5"
      />
      <polyline points={points(result)} stroke="#176b4c" fill="none" strokeWidth="3" />
      {result.rows.map((r, i) => (
        <g key={i}>
          <circle cx={40 + i * 80} cy={140 - (110 * r.close) / max} r="4" fill="#176b4c" />
          <text x={40 + i * 80} y="165" fontSize="11" fill="#52675f" textAnchor="middle">
            Day {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
function download(name, value) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 500);
}
export function App({ presentation = null }) {
  const [scenario, setScenario] = useState(presentation?.scenario || 'salinity'),
    [view, setView] = useState(presentation?.view || 'operations'),
    [budget, setBudget] = useState(2400),
    [multiplier, setMultiplier] = useState(1),
    [floor, setFloor] = useState(0.8),
    [computed, setComputed] = useState(Boolean(presentation?.computed)),
    [confirmed, setConfirmed] = useState(false),
    [noticeTime, setNoticeTime] = useState(null),
    [bn, setBn] = useState(false),
    [completed, setCompleted] = useState([]),
    [audit, setAudit] = useState(null),
    [verification, setVerification] = useState(''),
    [chain, setChain] = useState(null),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [climate, setClimate] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [gisNetwork, setGisNetwork] = useState(null);
  const [gisError, setGisError] = useState('');
  React.useEffect(() => {
    let active = true;
    fetch('/data/gis-network.json')
      .then((response) => {
        if (!response.ok) throw Error('GIS unavailable');
        return response.json();
      })
      .then((network) => {
        for (const id of Object.keys(SCENARIOS)) applyGISScenario(scenarioConfig(id), network);
        if (active) {
          setGisNetwork(network);
          invalidate();
        }
      })
      .catch(() => {
        if (active)
          setGisError(
            'GIS route assumptions could not load. The standalone synthetic continuity scenario remains available; no GIS-derived access claim is made.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const [clockNow, setClockNow] = useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const noticeValid = confirmed && isNoticeCurrent(noticeTime, clockNow);
  const config = useMemo(
    () =>
      gisNetwork
        ? applyGISScenario(scenarioConfig(scenario), gisNetwork)
        : scenarioConfig(scenario),
    [scenario, gisNetwork],
  );
  const opts = useMemo(
    () => ({ budget, demandMultiplier: multiplier, schoolFloor: floor }),
    [budget, multiplier, floor],
  );
  const optimized = useMemo(() => plan(config, opts), [config, opts]);
  const reference = useMemo(() => baseline(config, opts, 'threshold'), [config, opts]);
  const fixed = useMemo(() => baseline(config, opts), [config, opts]);
  const result = computed ? optimized : reference;
  React.useEffect(() => {
    if (view === 'evidence' && !climate)
      fetch('/data/climate-analysis.json')
        .then((r) => (r.ok ? r.json() : null))
        .then(setClimate)
        .catch(() => {});
  }, [view, climate]);
  function invalidate() {
    setComputed(false);
    setConfirmed(false);
    setNoticeTime(null);
    setCompleted([]);
    setAudit(null);
    setChain(null);
    setVerification('');
  }
  function choose(id) {
    invalidate();
    setScenario(id);
  }
  function update(fn, value) {
    invalidate();
    fn(value);
  }
  const jobs = [
    { id: 'inspection', name: config.action, hours: 2, priority: 8, accessible: true },
    {
      id: 'reserve',
      name: 'Reconcile reserve stock and supplier commitment.',
      hours: 1,
      priority: 5,
      accessible: true,
    },
    {
      id: 'access',
      name: 'Inspect the restricted access route after clearance.',
      hours: 2,
      priority: 6,
      accessible: scenario !== 'storm',
    },
  ];
  const selected = inspect(jobs, 3);
  async function makeReceipt() {
    setBusy(true);
    try {
      const r = await receipt({
        schema: 'climate-plus/receipt-v1',
        engine: ENGINE_VERSION,
        createdAt: new Date().toISOString(),
        scenario,
        inputs: config,
        options: opts,
        plan: optimized,
        confirmedAt: noticeTime,
        completedTasks: completed,
        provenance: 'synthetic scenario / operator interaction in demo',
      });
      setAudit(r);
      setVerification('Record intact');
      setChain(null);
    } finally {
      setBusy(false);
    }
  }
  async function anchor() {
    setBusy(true);
    try {
      const response = await fetch('/chain/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest: audit.digest }),
      });
      if (!response.ok) throw Error('Unavailable');
      const data = await response.json();
      setChain(data);
    } catch {
      setVerification(
        'Local EVM service unavailable. Run npm run chain to enable anchoring. The hash receipt remains usable.',
      );
    } finally {
      setBusy(false);
    }
  }
  function confirm() {
    const now = Date.now();
    setClockNow(now);
    setConfirmed(true);
    setNoticeTime(new Date(now).toISOString());
    setAudit(null);
    setChain(null);
  }
  const localEvm =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const Icon = ICONS[scenario];
  return (
    <div className={'app ' + (presentation ? 'presentation' : '')}>
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('operations');
          }}
        >
          <span className="brandmark">
            <Waves size={25} />
          </span>
          climate<span className="plus">++</span>
        </a>
        <div className="workspace">
          <span className="workspace-dot" /> Bangladesh<small>Water operations & evidence</small>
        </div>
        <nav aria-label="Main navigation">
          {NAV.map(([id, label, I]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => {
                setView(id);
                setMenu(false);
              }}
            >
              <I size={19} />
              {label}
              {view === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-network">
            <span />
            <span />
            <span />
          </div>
          <strong>From signal to service.</strong>
          <p>
            One accountable response,
            <br />
            from evidence to outcome.
          </p>
          <a href="https://ieee-climatechain-hack.devpost.com/" target="_blank" rel="noreferrer">
            IEEE ClimateChain <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            {['pollution', 'monitoring'].includes(view) ? 'Water evidence' : 'Coastal operations'}{' '}
            <ChevronRight size={14} /> <strong>{NAV.find((x) => x[0] === view)[1]}</strong>
          </div>
          <span className="demo-badge">
            <span />{' '}
            {['operations', 'monitoring'].includes(view)
              ? 'Persistent operations · evidence labelled'
              : view === 'pollution'
                ? 'Public data · no live safety clearance'
                : 'Scenario demo · no live alerts'}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>
                {view === 'operations'
                  ? 'Coordinate water. Keep people informed.'
                  : view === 'monitoring'
                    ? 'Follow a sample through to action.'
                    : view === 'pollution'
                      ? 'Find water. Understand the evidence.'
                      : view === 'desk'
                        ? 'Keep essential water flowing.'
                        : view === 'compare'
                          ? 'Show the trade-off.'
                          : view === 'tasks'
                            ? 'Make the plan accountable.'
                            : view === 'residents'
                              ? 'Clear information. Fewer uncertain trips.'
                              : 'Every decision has a record.'}
              </h1>
              <p>
                {view === 'operations'
                  ? 'Private device GPS, mapped road alternatives and accountable delivery reports.'
                  : view === 'monitoring'
                    ? 'Save attributed measurements, screen environmental objectives, and track follow-up.'
                    : view === 'pollution'
                      ? 'Public locations, source dates and practical precautions.'
                      : view === 'desk'
                        ? 'Climate disruption → feasible response → confirmed service.'
                        : view === 'compare'
                          ? 'Same water. Same budget. Explicit priorities.'
                          : view === 'tasks'
                            ? 'Confirm responsibilities and record what actually happened.'
                            : view === 'residents'
                              ? 'A printable service notice, confirmed by the operator.'
                              : 'Inspect the assumptions, reproduce the result, verify the receipt.'}
              </p>
            </div>
            {!['operations', 'monitoring'].includes(view) && (
              <button
                className="quiet reset"
                onClick={() => {
                  invalidate();
                  setBudget(2400);
                  setMultiplier(1);
                  setFloor(0.8);
                  setResetKey((k) => k + 1);
                }}
              >
                <RotateCcw size={16} /> Reset demo
              </button>
            )}
          </div>
          {!['pollution', 'operations', 'monitoring'].includes(view) && (
            <div className="scenario-switch" aria-label="Select hazard scenario">
              {Object.entries(SCENARIOS).map(([id, s]) => {
                const I = ICONS[id];
                return (
                  <button
                    key={id}
                    aria-pressed={scenario === id}
                    className={scenario === id ? 'selected' : ''}
                    onClick={() => choose(id)}
                  >
                    <I size={18} />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {view === 'operations' && (
            <OperationsAccess>
              <LiveOperations onOpenLibrary={() => setView('pollution')} />
            </OperationsAccess>
          )}
          {view === 'monitoring' && (
            <OperationsAccess>
              <PollutionMonitoring onOpenLibrary={() => setView('pollution')} />
            </OperationsAccess>
          )}
          {view === 'pollution' && (
            <WaterGISWorkspace
              key={resetKey}
              onPlan={(id) => {
                choose(id);
                setView('desk');
              }}
            />
          )}
          {gisError && view === 'desk' && (
            <p className="verification failed" role="status">
              {gisError}
            </p>
          )}
          {view === 'desk' && (
            <>
              <div className="signal">
                <Icon size={22} />
                <div>
                  <strong>{config.signal}</strong>
                  <p>{config.evidence}</p>
                </div>
                <a
                  href={config.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Read scenario background"
                >
                  <ExternalLink size={18} />
                </a>
              </div>
              <div className="desk-layout">
                <section className="operation">
                  <div className="panel network-panel">
                    <div className="panel-head">
                      <div>
                        <h2>Service network</h2>
                        <span>
                          Dacope context · fictional assets{' '}
                          {gisNetwork ? '· GIS access assumptions loaded' : ''}
                        </span>
                      </div>
                      <span className="status-tag">
                        {computed ? 'Response calculated' : 'Reference response'}
                      </span>
                    </div>
                    <Network scenario={scenario} active={computed} multiplier={multiplier} />
                    <div className="network-mobile">
                      <strong>Pooled usable reserve: {fmt(config.initial)} L</strong>
                      <span>
                        Pump:{' '}
                        {scenario === 'storm' ? 'offline / excluded' : 'available in scenario'}
                      </span>
                      <span>
                        Pond:{' '}
                        {scenario === 'salinity' ? 'held / excluded' : 'available in scenario'}
                      </span>
                      {config.areas.map((a, i) => (
                        <span key={a}>
                          {a}: {fmt(config.demands[i] * multiplier)} L / day
                        </span>
                      ))}
                    </div>
                    <div className="legend">
                      <span>
                        <i className="dot green" />
                        Usable in scenario
                      </span>
                      <span>
                        <i className="dot amber" />
                        Restricted / review
                      </span>
                      <span>Schematic · not geographic</span>
                    </div>
                  </div>
                  <div className="controls panel">
                    <div className="control">
                      <label htmlFor="budget">
                        Response budget <strong>৳ {fmt(budget)}</strong>
                      </label>
                      <input
                        id="budget"
                        type="range"
                        min="0"
                        max="4000"
                        step="800"
                        value={budget}
                        onChange={(e) => update(setBudget, +e.target.value)}
                      />
                      <small>৳800 per 2,000 L refill</small>
                    </div>
                    <div className="control">
                      <label htmlFor="demand">
                        Demand assumption <strong>{multiplier.toFixed(1)}×</strong>
                      </label>
                      <input
                        id="demand"
                        type="range"
                        min="0.8"
                        max="1.4"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => update(setMultiplier, +e.target.value)}
                      />
                      <small>Stress-test entered demand</small>
                    </div>
                    <div className="control">
                      <label htmlFor="floor">
                        School daily floor <strong>{Math.round(floor * 100)}%</strong>
                      </label>
                      <input
                        id="floor"
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={floor * 100}
                        onChange={(e) => update(setFloor, +e.target.value / 100)}
                      />
                      <small>Illustrative operator priority</small>
                    </div>
                  </div>
                  <div className="action-line">
                    <p>
                      <Clock size={16} /> Seven-day horizon · known-input simulation
                    </p>
                    <button className="primary" onClick={() => setComputed(true)}>
                      {computed ? <Check size={17} /> : <GitCompareArrows size={17} />}{' '}
                      {computed ? 'Response calculated' : 'Calculate fair response'}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <section className="panel stock-panel">
                    <div className="panel-head">
                      <h2>Usable reserve over seven days</h2>
                      <span>End-of-day litres</span>
                    </div>
                    <StockChart result={result} reference={reference} />
                    <div className="legend">
                      <span>
                        <i className="line green" />
                        Selected response
                      </span>
                      <span>
                        <i className="line gray" />
                        Stock-threshold reference
                      </span>
                    </div>
                  </section>
                </section>
                <aside className="outcomes">
                  <div className="outcome-head">
                    <h2>Essential service coverage</h2>
                    <p>Share of seven-day entered demand</p>
                  </div>
                  <Coverage result={result} reference={reference} />
                  <div className="deficit">
                    <AlertTriangle size={19} />
                    <div>
                      <strong>{fmt(result.unmet)} L still unmet</strong>
                      <p>
                        {result.unmet > 0
                          ? 'Escalate the remaining deficit. Planning cannot create water.'
                          : 'All entered essential demand is covered in this scenario.'}
                      </p>
                    </div>
                  </div>
                  <dl className="summary">
                    <div>
                      <dt>Response cost</dt>
                      <dd>৳ {fmt(result.cost)}</dd>
                    </div>
                    <div>
                      <dt>Planned refills</dt>
                      <dd>{result.schedule.length} × 2,000 L</dd>
                    </div>
                    <div>
                      <dt>Closing reserve</dt>
                      <dd>{fmt(result.terminalStock)} L</dd>
                    </div>
                    <div>
                      <dt>Supply provenance</dt>
                      <dd>Simulated</dd>
                    </div>
                  </dl>
                  <button
                    className="secondary full"
                    disabled={!computed}
                    onClick={() => setView('compare')}
                  >
                    Inspect the comparison <ArrowRight size={16} />
                  </button>
                  <button
                    className="primary full"
                    disabled={!computed}
                    onClick={() => {
                      confirm();
                      setView('tasks');
                    }}
                  >
                    {confirmed ? 'Review confirmed plan' : 'Confirm demo plan'}
                    <Check size={16} />
                  </button>
                  <p className="micro">
                    Confirmation is local to this demonstration. No real dispatch occurs.
                  </p>
                </aside>
              </div>
            </>
          )}
          {view === 'compare' && (
            <>
              <section className="panel comparison">
                <div className="panel-head">
                  <h2>Allocation is a choice. Make it visible.</h2>
                  <span>All results simulated</span>
                </div>
                <p className="intro">
                  Compare resources and outcomes before choosing a response. The ablation uses the
                  optimized delivery schedule with first-arrival allocation, isolating the
                  allocation effect.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Policy</th>
                        <th>Unmet litres</th>
                        <th>Worst household</th>
                        <th>School coverage</th>
                        <th>Cost</th>
                        <th>Closing stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Fixed refill schedule', fixed],
                        ['Stock-threshold reference', reference],
                        [
                          'Same schedule · first-arrival',
                          simulate(config, optimized.schedule, {
                            ...opts,
                            allocation: 'first-arrival',
                          }),
                        ],
                        ['Climate++ fair response', optimized],
                      ].map(([name, r], i) => (
                        <tr key={name} className={i === 3 ? 'highlight' : ''}>
                          <th>{name}</th>
                          <td>{fmt(r.unmet)}</td>
                          <td>{pct(r.worstCoverage)}</td>
                          <td>{pct(r.coverage[2])}</td>
                          <td>৳{fmt(r.cost)}</td>
                          <td>{fmt(r.terminalStock)} L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="comparison-note">
                  <FlaskConical size={20} />
                  <p>
                    The planner searches up to 128 refill schedules. All policies share initial
                    stock, inflows, demand, delivery capacity and budget. Different closing stock is
                    disclosed. These are known-input scenarios, not measured community outcomes.
                  </p>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>The seven-day response</h2>
                  <button
                    className="quiet"
                    onClick={() => download('climate-plus-plan.json', optimized)}
                  >
                    <Download size={16} /> Export plan
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Opening L</th>
                        <th>Inflow L</th>
                        <th>Refill L</th>
                        <th>Served L</th>
                        <th>Unmet L</th>
                        <th>Closing L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimized.rows.map((r) => (
                        <tr key={r.day}>
                          <th>Day {r.day + 1}</th>
                          {['open', 'inflow', 'delivery', 'served', 'unmet', 'close'].map((k) => (
                            <td key={k}>{fmt(r[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="action-line">
                <a className="text-link" href="/data/benchmark.json" target="_blank">
                  Open 144-run benchmark <ExternalLink size={15} />
                </a>
                <button
                  className="primary"
                  onClick={() => {
                    setComputed(true);
                    confirm();
                    setView('tasks');
                  }}
                >
                  Confirm demo response <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {view === 'tasks' && (
            <>
              <div className="signal neutral">
                <ClipboardCheck size={22} />
                <div>
                  <strong>
                    {confirmed
                      ? 'Demo plan confirmed'
                      : 'Confirm the proposed plan before publishing a notice'}
                  </strong>
                  <p>
                    Inspection capacity: 3 crew-hours. Confirmations and execution entries are
                    demonstration records.
                  </p>
                </div>
                {!confirmed && (
                  <button
                    className="primary"
                    onClick={() => {
                      setComputed(true);
                      confirm();
                    }}
                  >
                    Confirm plan
                  </button>
                )}
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>Assigned actions</h2>
                  <span>{completed.length} completed in demo</span>
                </div>
                {[
                  ...selected.map((j) => ({
                    id: j.id,
                    name: j.name,
                    detail: `Field operator · ${j.hours} crew-hour${j.hours > 1 ? 's' : ''}`,
                  })),
                  ...optimized.schedule.map((d) => ({
                    id: 'refill-' + d,
                    name: `Confirm 2,000 L replenishment for day ${d + 1}.`,
                    detail: 'Supplier coordinator · ৳800 · timing requires confirmation',
                  })),
                ].map((t) => (
                  <div className="task-row" key={t.id}>
                    <span className={'task-icon ' + (completed.includes(t.id) ? 'done' : '')}>
                      <ClipboardCheck size={20} />
                    </span>
                    <div>
                      <strong>{t.name}</strong>
                      <p>{t.detail}</p>
                    </div>
                    <button
                      className="secondary"
                      disabled={!confirmed || completed.includes(t.id)}
                      onClick={() => {
                        setCompleted([...completed, t.id]);
                        setAudit(null);
                        setChain(null);
                      }}
                    >
                      {completed.includes(t.id) ? 'Recorded complete' : 'Record demo completion'}
                    </button>
                  </div>
                ))}
              </section>
              <div className="two-column">
                <div className="panel explanation">
                  <h2>Completion is a separate claim.</h2>
                  <p>
                    A checked task records an operator entry. It does not independently prove water
                    delivery, repair success, or water quality. Field pilots require measurements
                    and responsible verification.
                  </p>
                </div>
                <div className="panel explanation">
                  <h2>Keep the public message current.</h2>
                  <p>
                    Only confirmed plans generate notices. Changing a scenario or constraint
                    invalidates the old confirmation.
                  </p>
                  <button
                    className="primary"
                    disabled={!confirmed}
                    onClick={() => setView('residents')}
                  >
                    Open resident notice <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {view === 'residents' && (
            <section className="notice-layout">
              <div className="panel resident-notice">
                <div className="panel-head">
                  <span className="brand-mini">
                    <Waves size={24} /> climate++
                  </span>
                  <button className="secondary" onClick={() => setBn(!bn)}>
                    {bn ? 'English' : 'বাংলা'}
                  </button>
                </div>
                <span className="notice-demo">
                  {bn
                    ? 'নমুনা বিজ্ঞপ্তি · বাস্তব সেবার তথ্য নয়'
                    : 'DEMONSTRATION NOTICE · NOT REAL SERVICE INFORMATION'}
                </span>
                <h2>{bn ? 'পানির সেবার খবর' : 'Water service update'}</h2>
                <p>
                  {bn
                    ? 'উপকূলীয় সেবা · কাল্পনিক কমিউনিটি'
                    : 'Coastal service · fictional community'}
                </p>
                {noticeValid ? (
                  <>
                    <div className="notice-state">
                      <Check size={20} />
                      {bn
                        ? 'অপারেটর নমুনা পরিকল্পনা নিশ্চিত করেছেন'
                        : 'Operator confirmed the demonstration plan'}
                    </div>
                    <dl>
                      <div>
                        <dt>{bn ? 'সেবার সময়' : 'Illustrative collection window'}</dt>
                        <dd>08:00–10:00</dd>
                      </div>
                      <div>
                        <dt>{bn ? 'স্থান' : 'Collection point'}</dt>
                        <dd>{bn ? 'কমিউনিটি বিতরণ কেন্দ্র' : 'Community distribution point'}</dd>
                      </div>
                      <div>
                        <dt>{bn ? 'মূল্য' : 'Illustrative price'}</dt>
                        <dd>৳ 0 / L · {bn ? 'নমুনা তথ্য' : 'demo assumption'}</dd>
                      </div>
                      <div>
                        <dt>{bn ? 'অবশিষ্ট ঘাটতি' : 'Remaining seven-day shortage'}</dt>
                        <dd>{fmt(optimized.unmet)} L</dd>
                      </div>
                    </dl>
                    <p className="notice-warning">
                      {bn
                        ? 'যাত্রার আগে স্থানীয় অপারেটরের সাথে সেবার তথ্য যাচাই করুন। এই নমুনা পানির নিরাপত্তা নিশ্চিত করে না।'
                        : 'In real use, confirm availability with the local operator before travelling. This demonstration does not certify drinking-water safety.'}
                    </p>
                    <small>
                      {bn ? 'নমুনা নিশ্চিতকরণের সময়' : 'Demo confirmed'}:{' '}
                      {new Date(noticeTime).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })} BDT
                      <br />
                      {bn ? 'মেয়াদ' : 'Expires'}:{' '}
                      {new Date(new Date(noticeTime).getTime() + 86400000).toLocaleString('en-GB', {
                        timeZone: 'Asia/Dhaka',
                      })}{' '}
                      BDT
                    </small>
                  </>
                ) : (
                  <div className="empty-state">
                    <Clock size={32} />
                    <h3>
                      {confirmed
                        ? bn
                          ? 'বিজ্ঞপ্তির মেয়াদ শেষ'
                          : 'Notice expired'
                        : bn
                          ? 'এখনও নিশ্চিত করা হয়নি'
                          : 'No confirmed notice yet'}
                    </h3>
                    <p>
                      {bn
                        ? 'পরিকল্পনা নিশ্চিত হলে এখানে বিজ্ঞপ্তি দেখাবে।'
                        : 'Confirm a demonstration plan in the Action register to generate this notice.'}
                    </p>
                    <button className="primary" onClick={() => setView('tasks')}>
                      Review plan <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <aside className="notice-help">
                <h2>Useful without an app.</h2>
                <p>
                  Print this notice for a community board. Switch to Bangla for residents. Keep the
                  publication time and expiry visible.
                </p>
                <button className="primary" disabled={!noticeValid} onClick={() => window.print()}>
                  Print notice <Download size={16} />
                </button>
                <p className="micro">
                  For this prototype, notices stay in the browser. SMS and public distribution
                  require an operating partner.
                </p>
              </aside>
            </section>
          )}
          {view === 'evidence' && (
            <>
              <div className="evidence-grid">
                <section className="panel explanation">
                  <div className="icon-title">
                    <ShieldCheck size={23} />
                    <h2>A receipt anyone can check.</h2>
                  </div>
                  <p>
                    Commit to the exact input, plan and demo execution record. Alter one value and
                    verification fails.
                  </p>
                  <div className="receipt-state">
                    <FileCheck2 size={32} />
                    <div>
                      <strong>{audit ? 'Receipt generated' : 'No receipt yet'}</strong>
                      <span>{audit?.digest || 'SHA-256 · canonical JSON · versioned engine'}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    <button className="primary" disabled={!computed || busy} onClick={makeReceipt}>
                      Create receipt
                    </button>
                    <button
                      className="secondary"
                      disabled={!audit || busy}
                      onClick={async () =>
                        setVerification(
                          (await verifyReceipt(audit))
                            ? 'Record intact'
                            : 'Tampering detected — digest does not match',
                        )
                      }
                    >
                      Verify
                    </button>
                    <button
                      className="secondary"
                      disabled={!audit || busy}
                      onClick={async () => {
                        const changed = structuredClone(audit);
                        changed.manifest.plan.served += 100;
                        setVerification(
                          (await verifyReceipt(changed))
                            ? 'Record intact'
                            : 'Tampering detected — changed water volume fails verification',
                        );
                      }}
                    >
                      Test tampering
                    </button>
                  </div>
                  {verification && (
                    <p
                      className={
                        'verification ' + (verification.startsWith('Tampering') ? 'failed' : '')
                      }
                      role="status"
                    >
                      {verification}
                    </p>
                  )}
                  <div className="button-row">
                    <button
                      className="quiet"
                      disabled={!audit}
                      onClick={() => download('climate-plus-receipt.json', audit)}
                    >
                      <Download size={16} /> Download receipt
                    </button>
                    <button
                      className="quiet"
                      disabled={!audit || busy || !localEvm}
                      onClick={anchor}
                    >
                      Anchor to local EVM <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {chain && (
                    <div className="chain-result">
                      <strong>Anchored on local development chain</strong>
                      <code>{chain.transactionHash}</code>
                      <small>
                        Chain {chain.chainId} · block {chain.blockNumber}. Local test only; no
                        public-chain claim.
                      </small>
                    </div>
                  )}
                  <p className="micro">
                    A hash proves integrity, not truth. Field observations need independent
                    verification. Local EVM anchoring is available through the local source package
                    and companion service.
                  </p>
                </section>
                <section className="panel explanation">
                  <div className="icon-title">
                    <FlaskConical size={23} />
                    <h2>Evidence, with its limits.</h2>
                  </div>
                  <ul className="evidence-list">
                    <li>
                      <strong>Operational outcomes</strong>
                      <span>
                        36 synthetic cases × 4 policies. Identical constraints; scheduling and
                        allocation ablations.
                      </span>
                    </li>
                    <li>
                      <strong>Climate analysis</strong>
                      <span>
                        {climate
                          ? climate.summary
                          : 'Historical rainfall / ENSO analysis is a separate research exhibit. It does not forecast a local storm or certify source quality.'}
                      </span>
                    </li>
                    <li>
                      <strong>Community validation</strong>
                      <span>
                        Not yet conducted. Operator interviews, stock measurements and a shadow
                        pilot are required.
                      </span>
                    </li>
                  </ul>
                  <a className="text-link" href="/data/benchmark.json" target="_blank">
                    Download benchmark <ExternalLink size={15} />
                  </a>
                  {climate && (
                    <a className="text-link" href="/data/climate-analysis.json" target="_blank">
                      Open climate experiment <ExternalLink size={15} />
                    </a>
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>Source register</h2>
                  <span>Background evidence, not live operational feeds</span>
                </div>
                {[
                  [
                    'NASA POWER',
                    'Historical gridded weather; model-derived, not local tank observations.',
                    'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
                  ],
                  [
                    'NOAA ENSO / RONI',
                    'Seasonal climate context. No deterministic mapping to local shortages.',
                    'https://www.noaa.gov/understanding-el-nino',
                  ],
                  [
                    'REACH Khulna',
                    'Historical coastal water-access and water-quality evidence.',
                    'https://reachwater.uk/datasets/',
                  ],
                  [
                    'WHO small supplies',
                    'Water-safety responsibilities and sanitary inspection guidance.',
                    'https://www.who.int/publications/i/item/9789240089006',
                  ],
                  [
                    'IEEE ClimateChain',
                    'Track, submission requirements and judging criteria.',
                    'https://ieee-climatechain-hack.devpost.com/',
                  ],
                ].map(([name, note, url]) => (
                  <a className="source-row" href={url} key={name} target="_blank" rel="noreferrer">
                    <strong>{name}</strong>
                    <span>{note}</span>
                    <ExternalLink size={16} />
                  </a>
                ))}
              </section>
            </>
          )}
          <footer>
            <span>climate++ · Water operations v0.4</span>
            <span>
              {['operations', 'monitoring'].includes(view)
                ? 'Recorded inputs and road estimates do not certify water safety or road access.'
                : view === 'pollution'
                  ? 'Research screening. Current conditions require verified measurements.'
                  : 'Fictional service network. Measured claims require a field pilot.'}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
