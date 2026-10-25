import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FlaskConical, Download, MapPin, Trash2, Upload } from 'lucide-react';
import { useMapData } from './use-map-data.mjs';
import {
  CLASS_ORDER,
  CLASS_COLOURS,
  COVERAGE_LIMIT_M,
  RADII_M,
  assessLocation,
  customersCsv,
  parseCustomers,
} from './pollution-exposure.mjs';
import './map-mvp.css';

const classes = [...CLASS_ORDER, 'Unclassified'];
const km = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fix = (n) => n.toFixed(5);

function Result({ a }) {
  if (!a) return null;
  if (a.status === 'outside_coverage')
    return (
      <p className="pm-note">
        Outside the published grid
        {a.nearestDistanceM != null ? ` (nearest grid point ${km(a.nearestDistanceM)} away)` : ''}.
        The grid says nothing about this place; it is not “clean”.
      </p>
    );
  return (
    <dl className="pm-result">
      <div>
        <dt>Nearest grid point</dt>
        <dd>
          <i style={{ background: CLASS_COLOURS[a.nearest.cls] }} />
          {a.nearest.cls} · {km(a.nearest.distanceM)} away
        </dd>
      </div>
      <div>
        <dt>Worst class within {km(a.radiusM)}</dt>
        <dd>
          <i style={{ background: CLASS_COLOURS[a.worstClass] }} />
          {a.worstClass} ({a.count} grid points)
        </dd>
      </div>
      <div>
        <dt>High or Very High share</dt>
        <dd>{a.shareHighOrWorse}%</dd>
      </div>
      <div>
        <dt>Mean publisher score</dt>
        <dd>{a.meanValue} (no unit)</dd>
      </div>
    </dl>
  );
}

export function PollutionMonitor() {
  const context = useMapData('/data/river-pollution-context.json');
  const regionsIndex = useMapData('/data/regions/index.json');
  const rows = context.data?.rows;
  const host = useRef(null),
    map = useRef(null),
    layers = useRef({ grid: null, customers: null, probe: null });
  const [hidden, setHidden] = useState([]),
    [radiusM, setRadiusM] = useState(2000),
    [probe, setProbe] = useState(null),
    [customers, setCustomers] = useState([]),
    [name, setName] = useState(''),
    [paste, setPaste] = useState(''),
    [message, setMessage] = useState(''),
    [tilesFailed, setTilesFailed] = useState(false);
  const counts = useMemo(() => {
    const c = Object.fromEntries(classes.map((k) => [k, 0]));
    rows?.forEach((r) => (c[CLASS_ORDER.includes(r[4]) ? r[4] : 'Unclassified'] += 1));
    return c;
  }, [rows]);
  const assessed = useMemo(
    () => customers.map((customer) => ({ customer, a: assessLocation(rows, customer, radiusM) })),
    [customers, rows, radiusM],
  );
  const probeResult = useMemo(
    () => (probe ? assessLocation(rows, probe, radiusM) : null),
    [probe, rows, radiusM],
  );

  useEffect(() => {
    const m = L.map(host.current, { preferCanvas: true, scrollWheelZoom: false }).setView(
      [23.9, 90.65],
      9,
    );
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTilesFailed(true))
      .addTo(m);
    layers.current = {
      grid: L.layerGroup().addTo(m),
      customers: L.layerGroup().addTo(m),
      probe: L.layerGroup().addTo(m),
    };
    m.on('click', (e) => setProbe({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
    };
  }, []);

  useEffect(() => {
    const g = layers.current.grid;
    if (!g || !rows) return;
    g.clearLayers();
    const renderer = L.canvas({ padding: 0.3 });
    for (const r of rows) {
      const cls = CLASS_ORDER.includes(r[4]) ? r[4] : 'Unclassified';
      if (hidden.includes(cls)) continue;
      L.circleMarker([r[1], r[2]], {
        renderer,
        radius: 4,
        weight: 0,
        fillColor: CLASS_COLOURS[cls],
        fillOpacity: 0.82,
      })
        .bindTooltip(`${cls} · score ${r[3]} (publisher, no unit)`)
        .addTo(g);
    }
  }, [rows, hidden]);

  useEffect(() => {
    const c = layers.current.customers,
      p = layers.current.probe;
    if (!c || !p) return;
    c.clearLayers();
    p.clearLayers();
    customers.forEach((x) =>
      L.circleMarker([x.latitude, x.longitude], {
        radius: 8,
        color: '#10231f',
        weight: 3,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(x.name, { permanent: false })
        .addTo(c),
    );
    if (probe) {
      L.circle([probe.latitude, probe.longitude], {
        radius: radiusM,
        color: '#183b35',
        weight: 1.5,
        dashArray: '5 5',
        fill: false,
      }).addTo(p);
      L.circleMarker([probe.latitude, probe.longitude], {
        radius: 6,
        color: '#183b35',
        weight: 2,
        fillColor: '#183b35',
        fillOpacity: 1,
      }).addTo(p);
    }
  }, [customers, probe, radiusM]);

  const fitGrid = () =>
    map.current?.fitBounds(
      [
        [23.4064, 90.011],
        [24.3314, 91.2943],
      ],
      { padding: [12, 12] },
    );
  useEffect(() => {
    if (rows) fitGrid();
  }, [!!rows]);

  const addCustomer = (customer) => setCustomers((list) => [...list, customer]);
  const saveProbe = () => {
    if (!probe) return;
    addCustomer({
      name: name.trim() || `Customer ${customers.length + 1}`,
      latitude: Number(fix(probe.latitude)),
      longitude: Number(fix(probe.longitude)),
    });
    setName('');
  };
  const importPaste = () => {
    const { customers: added, badLines } = parseCustomers(paste);
    if (added.length) setCustomers((list) => [...list, ...added]);
    setMessage(
      `${added.length} customer${added.length === 1 ? '' : 's'} added` +
        (badLines.length
          ? `; skipped line${badLines.length > 1 ? 's' : ''} ${badLines.join(', ')} (need name, latitude, longitude)`
          : '.'),
    );
    if (added.length) setPaste('');
  };
  const loadRegion = async (id) => {
    const r = await fetch(`/data/regions/${id}-scenario.json`).then((x) => x.json());
    const roleLabel = { school: 'School', pump: 'Pump', reserve: 'Reserve', crew: 'Crew' };
    setCustomers((list) => [
      ...list,
      ...r.assets
        .filter((a) => roleLabel[a.role])
        .map((a) => ({
          name: `${a.name || roleLabel[a.role]} (${id})`,
          latitude: a.latitude,
          longitude: a.longitude,
        })),
    ]);
  };
  const download = () => {
    const blob = new Blob([customersCsv(assessed)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customer-pollution-context.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="mvp pm rm-embed">
      <main className="pm-main">
        <section className="pm-mapcol">
          <div className="pm-filters" role="group" aria-label="Pollution intensity class filter">
            {classes
              .filter((c) => counts[c] > 0)
              .map((c) => (
                <button
                  key={c}
                  aria-pressed={!hidden.includes(c)}
                  className={hidden.includes(c) ? 'is-off' : ''}
                  onClick={() =>
                    setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))
                  }
                >
                  <i style={{ background: CLASS_COLOURS[c] }} />
                  {c} <b>{counts[c].toLocaleString()}</b>
                </button>
              ))}
            <button className="pm-fit" onClick={fitGrid}>
              Fit grid
            </button>
          </div>
          <div
            className="pm-map"
            ref={host}
            role="application"
            aria-label="Pollution intensity map"
          />
          <p className="pm-foot">
            {context.loading && 'Loading pollution grid…'}
            {context.error && `${context.error} `}
            {rows && `${rows.length.toLocaleString()} grid points · `}
            {tilesFailed ? 'basemap tiles unavailable · ' : ''}
            Click the map to check a place.
          </p>
        </section>
        <aside className="pm-side">
          <p className="pm-caveat">
            <FlaskConical size={14} /> Publisher “pollution intensity” score from the Kaggle
            Bangladesh river pollution GIS dataset (A.B.M. Mostakim Niloy). It has no sampling date,
            unit or laboratory validation. It is context for prioritising where to look, not a
            drinking-water or health rating, and “Low” does not mean clean.
          </p>
          <label className="pm-radius">
            Look-around radius
            <select value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))}>
              {RADII_M.map((r) => (
                <option key={r} value={r}>
                  {km(r)}
                </option>
              ))}
            </select>
          </label>
          <h2>Checked place</h2>
          {probe ? (
            <>
              <p className="pm-coords">
                <MapPin size={13} /> {fix(probe.latitude)}, {fix(probe.longitude)}
              </p>
              <Result a={probeResult} />
              <div className="pm-save">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name"
                  aria-label="Customer name"
                />
                <button className="mvp-secondary" onClick={saveProbe}>
                  Save as customer
                </button>
              </div>
            </>
          ) : (
            <p className="pm-note">Click anywhere on the map.</p>
          )}
          <h2>Customers ({customers.length})</h2>
          <details className="pm-add">
            <summary>
              <Upload size={14} /> Add many
            </summary>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={4}
              placeholder={'One per line: name, latitude, longitude\nKarim Store, 23.8979, 90.4040'}
              aria-label="Customers as name, latitude, longitude"
            />
            <button className="mvp-secondary" onClick={importPaste} disabled={!paste.trim()}>
              Add customers
            </button>
            {message && <p className="pm-note">{message}</p>}
            <label className="pm-radius">
              Or load a region’s service points
              <select
                value=""
                onChange={(e) => e.target.value && loadRegion(e.target.value)}
                aria-label="Load service points from a region"
              >
                <option value="">Choose region…</option>
                {regionsIndex.data?.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </details>
          {assessed.length > 0 && (
            <>
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Nearby intensity</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {assessed.map(({ customer, a }, i) => (
                    <tr key={i}>
                      <td>
                        {customer.name}
                        <small>
                          {fix(customer.latitude)}, {fix(customer.longitude)}
                        </small>
                      </td>
                      <td>
                        {a?.status === 'covered' ? (
                          <>
                            <i style={{ background: CLASS_COLOURS[a.worstClass] }} />
                            {a.worstClass}
                            <small>
                              nearest {a.nearest.cls}, {km(a.nearest.distanceM)} ·{' '}
                              {a.shareHighOrWorse}% high+
                            </small>
                          </>
                        ) : (
                          <span className="pm-none">
                            Outside grid (&gt; {km(COVERAGE_LIMIT_M)})
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="pm-icon"
                          aria-label={`Remove ${customer.name}`}
                          onClick={() => setCustomers((l) => l.filter((_, k) => k !== i))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="mvp-secondary" onClick={download}>
                <Download size={14} /> Export CSV
              </button>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
