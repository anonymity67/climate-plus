import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { count } from './shared.jsx';
import { DoneNote } from './guide.jsx';
import { rainHubAccessIndex } from './water-model.mjs';
import './hub-planner.css';

// "Plan hubs": the Bayesian rainwater-hub model (R-INLA, run in R) shown on the platform.
// The page only DISPLAYS /data/rainhub-model.json (written by export_platform() in the R project)
// and recomputes the Water Access Index (WAI) with the same formula the R code uses:
//   A_i = (1 - E_i) + E_i * C_i      WAI = sum(pop_i * A_i) / sum(pop_i)

const ramp = (e) => (e < 0.34 ? '#458078' : e < 0.5 ? '#c9a23a' : e < 0.7 ? '#d47a38' : '#a5402a');
const pct = (v) => Math.round(v * 100) + '%';

function useModel() {
  const [s, set] = useState({ data: null, error: '' });
  useEffect(() => {
    const ctl = new AbortController();
    fetch('/data/rainhub-model.json', { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw Error('missing');
        return r.json();
      })
      .then((data) => set({ data, error: '' }))
      .catch((e) => {
        if (!ctl.signal.aborted)
          set({
            data: null,
            error:
              'Model results not found. In the R project run run_real.R, then copy outputs/rainhub-model.json into public/data/.',
          });
      });
    return () => ctl.abort();
  }, []);
  return s;
}

const siteColor = (v, tau) => (v < tau - 0.1 ? '#458078' : v < tau ? '#c9a23a' : '#a5402a');

function ModelMap({ m, layers, ways, onPick }) {
  const host = useRef(null),
    map = useRef(null),
    group = useRef(null),
    pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    const inst = L.map(host.current, { preferCanvas: true, scrollWheelZoom: false });
    map.current = inst;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(inst);
    group.current = L.featureGroup().addTo(inst);
    const pts = [...m.hubs, ...m.cleanup_zones, ...m.cells.filter((c) => c.e >= 0.5)].map((c) => [
      c.lat,
      c.lon,
    ]);
    inst.invalidateSize();
    inst.fitBounds(L.latLngBounds(pts), { padding: [10, 10], animate: false });
    const ro = new ResizeObserver(() => inst.invalidateSize());
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      inst.remove();
    };
  }, [m]);
  useEffect(() => {
    const g = group.current;
    g.clearLayers();
    if (layers.severity)
      m.cells.forEach((c) =>
        L.circleMarker([c.lat, c.lon], {
          radius: 9,
          stroke: false,
          fillColor: ramp(c.e),
          fillOpacity: 0.5,
        })
          .bindTooltip('Chance the river is severely polluted here: ' + pct(c.e))
          .on('click', () => pick.current({ type: 'cell', v: c }))
          .addTo(g),
      );
    if (layers.rivers && ways)
      ways.forEach((w) =>
        L.polyline(
          w.geometry.coordinates.map(([x, y]) => [y, x]),
          { color: '#2d7ea3', weight: w.kind === 'river' ? 2 : 1, opacity: 0.8 },
        )
          .bindTooltip(
            Object.assign(document.createElement('span'), {
              textContent: (w.name || 'Unnamed') + ' · mapped ' + w.kind,
            }),
          )
          .addTo(g),
      );
    if (layers.cleanup)
      m.cleanup_zones.forEach((z) =>
        L.circle([z.lat, z.lon], {
          radius: m.meta.exposure_km * 1000,
          color: '#5367a1',
          weight: 1.5,
          dashArray: '5 4',
          fillOpacity: 0.06,
        })
          .bindTooltip('Cleanup zone · ' + count(z.people) + ' people within reach')
          .on('click', () => pick.current({ type: 'zone', v: z }))
          .addTo(g),
      );
    if (layers.blocks)
      m.blocks
        .filter((b) => b.c > 0)
        .forEach((b) =>
          L.circleMarker([b.lat, b.lon], {
            radius: 4,
            color: '#fff',
            weight: 1,
            fillColor: '#173d34',
            fillOpacity: 0.95,
          })
            .bindTooltip('Area assigned to a proposed tank · ' + count(b.pop) + ' people live here')
            .on('click', () => pick.current({ type: 'block', v: b }))
            .addTo(g),
        );
    if (layers.sites)
      m.sites.forEach((p) =>
        L.circleMarker([p.lat, p.lon], {
          radius: 6,
          color: '#222',
          weight: 1.5,
          fillColor: siteColor(p.s, m.meta.tau),
          fillOpacity: 1,
        })
          .bindTooltip('Measured river site · ' + p.n + ' samples')
          .on('click', () => pick.current({ type: 'site', v: p }))
          .addTo(g),
      );
    if (layers.hubs)
      m.hubs.forEach((h) =>
        L.circleMarker([h.lat, h.lon], {
          radius: 9,
          color: '#fff',
          weight: 2.5,
          fillColor: '#2f6cb0',
          fillOpacity: 1,
        })
          .bindTooltip('Rain hub ' + h.id + ' · reliability ' + pct(h.reliability))
          .on('click', () => pick.current({ type: 'hub', v: h }))
          .addTo(g),
      );
  }, [m, layers, ways]);
  return (
    <div className="water-map-frame">
      <div
        ref={host}
        className="water-atlas"
        role="group"
        aria-label="Map of river pollution, rain hubs and cleanup zones. The panel beside it lists the same numbers."
      />
      <p className="water-map-note">
        © OpenStreetMap contributors · model estimates, not measurements
      </p>
    </div>
  );
}

function Detail({ pick, m }) {
  if (!pick)
    return (
      <p className="hub-hint">
        Select a hub, a measured site, a served area, a cleanup zone or a coloured patch of river on
        the map.
      </p>
    );
  const { type, v } = pick;
  if (type === 'hub')
    return (
      <div>
        <h3>Rain hub {v.id}</h3>
        <p>
          A community cistern of {count(v.tank_m3)} m³. In the simulated rainfall years it supplies
          its {count(m.meta.hub_capacity_people)} people on every day in{' '}
          <strong>{pct(v.reliability)}</strong> of years.
        </p>
        <p className="hub-small">People assigned: {count(v.served)}</p>
      </div>
    );
  if (type === 'block')
    return (
      <div>
        <h3>Area assigned to a proposed tank</h3>
        <p>
          {count(v.pop)} people live in this 2 km block. The river there has a{' '}
          <strong>{pct(v.e)}</strong> chance of being severely polluted. A hub covers them with
          chance {pct(v.c)} (hub {v.hub}).
        </p>
      </div>
    );
  if (type === 'site')
    return (
      <div>
        <h3>Measured river site</h3>
        <p>
          {v.n} water samples (2017–2021) here average a pollution score of{' '}
          <strong>{v.s.toFixed(2)}</strong>. The “severe” line is {m.meta.tau}. This is a measured
          value; the colours on the map are the model's estimate between such sites.
        </p>
      </div>
    );
  if (type === 'zone')
    return (
      <div>
        <h3>Cleanup zone</h3>
        <p>
          One of the {m.cleanup_zones.length} highest-priority spots to clean: mean pollution
          severity {v.severity.toFixed(2)} and {count(v.people)} people within {m.meta.exposure_km}{' '}
          km.
        </p>
      </div>
    );
  return (
    <div>
      <h3>River condition here</h3>
      <p>
        Pollution severity {v.s.toFixed(2)} (0 = within every limit, 1 = at the worst limit). Chance
        it is above the “severe” line ({m.meta.tau}): <strong>{pct(v.e)}</strong>.
      </p>
    </div>
  );
}

export function HubPlanner({ bn }) {
  const { data: m, error } = useModel();
  const [layers, setLayers] = useState({
    severity: true,
    hubs: true,
    blocks: true,
    cleanup: false,
    sites: true,
    rivers: false,
  });
  const [hubsOn, setHubsOn] = useState(false);
  const [cleanOn, setCleanOn] = useState(false);
  const [effect, setEffect] = useState(0.5);
  const [pick, setPick] = useState(null);
  const [ways, setWays] = useState(null);
  useEffect(() => {
    if (!layers.rivers || ways) return;
    fetch('/data/streams/dhaka.json')
      .then((r) => r.json())
      .then((d) => setWays(d.ways))
      .catch(() => setWays([]));
  }, [layers.rivers, ways]);
  useEffect(() => {
    if (cleanOn) setLayers((l) => ({ ...l, cleanup: true }));
  }, [cleanOn]);
  const base = useMemo(
    () => (m ? rainHubAccessIndex(m.blocks, { hubs: false, cleanup: false, effect: 0 }) : 0),
    [m],
  );
  const now = useMemo(
    () => (m ? rainHubAccessIndex(m.blocks, { hubs: hubsOn, cleanup: cleanOn, effect }) : 0),
    [m, hubsOn, cleanOn, effect],
  );
  const total = m ? m.meta.population : 0;
  const gainPeople = (now - base) * total;
  const chosen = [
    hubsOn && 'test ' + (m ? m.hubs.length : '') + ' proposed rain tanks',
    cleanOn && 'test cleanup in ' + (m ? m.cleanup_zones.length : '') + ' modelled zones',
  ].filter(Boolean);
  const rel = m && m.meta.hubs_reliability;
  const relText = rel ? pct(rel[0]) + '–' + pct(rel[1]) : '';
  const hubPeople = m ? m.hubs.reduce((a, h) => a + h.served, 0) : 0;
  return (
    <div className="water-workspace hub-planner">
      <div className="water-task-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {bn ? 'রেইন হাব পরিকল্পনা' : 'Plan rain hubs'}
          </h1>
          <p>
            Explore proposed sites for shared rain tanks in the Dhaka study area and estimate how
            often each tank could meet its dry-season target.
          </p>
        </div>
      </div>
      {error && (
        <div className="water-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {!m && !error && <div className="water-pending">Loading model results…</div>}
      {m && (
        <>
          <section className="hub-step">
            <h2>
              <span className="hub-num">1</span> Explore the Dhaka model
            </h2>
            <p className="hub-small">
              Colours show estimates from historical samples and the model’s river score. The sites
              and results need field checks before a building decision.
            </p>
            <div className="hub-layout">
              <div>
                <div className="hub-layers" role="group" aria-label="Map layers">
                  {[
                    ['severity', 'River pollution'],
                    ['sites', 'Measured sites'],
                    ['rivers', 'Rivers & canals'],
                    ['hubs', 'Rain tanks'],
                    ['blocks', 'Modelled service areas'],
                    ['cleanup', 'Cleanup zones'],
                  ].map(([k, label]) => (
                    <label key={k} className="water-checkbox">
                      <input
                        type="checkbox"
                        checked={layers[k]}
                        onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <ModelMap m={m} layers={layers} ways={ways} onPick={setPick} />
                <p className="hub-key">
                  <span style={{ background: ramp(0.2) }} /> unlikely{' '}
                  <span style={{ background: ramp(0.45) }} /> possible{' '}
                  <span style={{ background: ramp(0.6) }} /> likely{' '}
                  <span style={{ background: ramp(0.8) }} /> very likely severely polluted · dots
                  with a dark ring are measured sites · blue dots are rain tanks
                </p>
              </div>
              <aside className="water-inspector" aria-live="polite">
                <Detail pick={pick} m={m} />
              </aside>
            </div>
          </section>

          <div className="hub-pair">
            <section className="hub-step">
              <h2>
                <span className="hub-num">2</span> Choose what to do
              </h2>
              <label className={'hub-choice' + (hubsOn ? ' on' : '')}>
                <input
                  type="checkbox"
                  checked={hubsOn}
                  onChange={(e) => setHubsOn(e.target.checked)}
                />
                <span>
                  <strong>Model {m.hubs.length} shared rain tanks</strong>
                  <small>
                    Each proposed tank holds {count(m.meta.hub_tank_m3)} m³, with a target of{' '}
                    {count(m.meta.hub_capacity_people)} people. The model met the dry-season target
                    in {relText} of simulated years.
                  </small>
                </span>
              </label>
              <label className={'hub-choice' + (cleanOn ? ' on' : '')}>
                <input
                  type="checkbox"
                  checked={cleanOn}
                  onChange={(e) => setCleanOn(e.target.checked)}
                />
                <span>
                  <strong>Test cleanup in {m.cleanup_zones.length} priority zones</strong>
                  <small>
                    Dashed circles show where a cleanup scenario changes the model most.
                  </small>
                </span>
              </label>
              <label className={'hub-slider' + (cleanOn ? '' : ' off')}>
                <span>
                  How much does cleanup help? <strong>{pct(effect)}</strong> less severe pollution
                </span>
                <input
                  type="range"
                  min="0.25"
                  max="1"
                  step="0.05"
                  value={effect}
                  disabled={!cleanOn}
                  onChange={(e) => setEffect(Number(e.target.value))}
                />
                <small>This is an estimate. Move it to see a cautious or a hopeful case.</small>
              </label>
            </section>

            <section className="hub-step hub-result" aria-live="polite">
              <h2>
                <span className="hub-num">3</span> Your result
              </h2>
              {hubsOn && (
                <>
                  <strong className="hub-big">{count(hubPeople)}</strong>
                  <p className="hub-result-line">
                    people assigned to {m.hubs.length} proposed tanks. Individual tanks met their
                    daily target throughout the dry season in {relText} of simulated years.
                  </p>
                </>
              )}
              <p className={hubsOn ? 'hub-small' : 'hub-result-line'}>
                {!hubsOn && <strong className="hub-big">{pct(now)}</strong>}
                {hubsOn ? pct(now) : ''} on the model’s water access measure for the study area.
              </p>
              {chosen.length ? (
                <DoneNote
                  did={'chose to ' + chosen.join(' and ') + '.'}
                  means={
                    cleanOn
                      ? 'The selected scenario moves the modelled water access measure from ' +
                        pct(base) +
                        ' to ' +
                        pct(now) +
                        '. This represents a probability-weighted change equivalent to ' +
                        count(gainPeople) +
                        ' people within the model.'
                      : 'Each proposed tank is sized for up to ' +
                        count(m.meta.hub_capacity_people) +
                        ' people under the model inputs.'
                  }
                  next={
                    cleanOn
                      ? 'Move the cleanup estimate to test a cautious and a hopeful case.'
                      : 'Check roof area, demand and other sources with local teams before choosing a site.'
                  }
                />
              ) : (
                <p className="hub-small">
                  The starting case uses the historical inputs. Select a proposed action to compare
                  the estimates.
                </p>
              )}
              <p className="hub-small">Water Access Index: {now.toFixed(3)}</p>
            </section>
          </div>

          <details className="hub-more">
            <summary>How we calculate this</summary>
            <p>
              For every 2 km block we estimate the chance its river is severely polluted, and the
              share of its population assigned to a rain tank. The index weights those results by
              population. Actual water use, access and drinking-water quality require separate field
              evidence.
            </p>
            <div className="water-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Choice</th>
                    <th>Estimated index</th>
                    <th>Population-weighted estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {m.wai.map((r) => (
                    <tr key={r.scenario}>
                      <td>{r.scenario}</td>
                      <td>{pct(r.wai)}</td>
                      <td>{count(r.people_not_exposed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              River pollution combines seven measurements, each scored from 0 (within the limit) to
              1 (at the worst limit). “Severe” means the average is above {m.meta.tau}.
            </p>
            <div className="water-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Measurement</th>
                    <th>Good value</th>
                    <th>Worst value</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {m.params.map((p) => (
                    <tr key={p.name}>
                      <td>{p.column}</td>
                      <td>
                        {Array.isArray(p.good)
                          ? p.good.join('–')
                          : (p.direction === 'low_is_bad' ? '≥ ' : '≤ ') + p.good}
                      </td>
                      <td>{p.bad}</td>
                      <td>{pct(p.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hub-small">
              Sources: {m.meta.source}. Results generated {m.meta.generated}. This counts river
              exposure and rain-tank cover only; it does not know about piped water or wells and is
              not a drinking-water test. Tank size, the “severe” line and the cleanup effect are
              estimates to confirm with field data.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
