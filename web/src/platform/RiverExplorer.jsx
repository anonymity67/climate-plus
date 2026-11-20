import React, { useMemo, useState } from 'react';
import { Search, ArrowRight, Plus, Check, ChevronDown } from 'lucide-react';
import { useWaterQuery } from './use-water-query.mjs';
import { AtlasMap } from './AtlasMap.jsx';
import { State, Source, Export, decimal, count, download } from './shared.jsx';
import { MeasurementEntry } from './MeasurementEntry.jsx';
import { useMapData } from '../mvp/use-map-data.mjs';
import { useOperationsResource } from '../operations/use-operations.mjs';
import { DoneNote } from './guide.jsx';

export function RiverExplorer({ meta, initialSite, onSource, bn, authenticated, signIn }) {
  const [filter, setFilter] = useState({ river: initialSite ? '' : 'Tongi Khal', query: '' }),
    [draft, setDraft] = useState(filter),
    [selected, setSelected] = useState(initialSite || null),
    [area, setArea] = useState('dhaka'),
    [showEntry, setShowEntry] = useState(false),
    [showSurvey, setShowSurvey] = useState(false),
    [showAllHistory, setShowAllHistory] = useState(false);
  const [showContext, setShowContext] = useState(false),
    [contextId, setContextId] = useState(null);
  const [showOwn, setShowOwn] = useState(false),
    [enteredId, setEnteredId] = useState(null);
  const own = useOperationsResource('/observations', { enabled: showOwn && authenticated });
  const ownPoints = useMemo(
    () =>
      showOwn
        ? (own.data?.observations || []).map((p) => ({
            ...p,
            kind: 'private-observation',
            name: p.location || p.river || 'Entered measurement',
          }))
        : [],
    [own.data, showOwn],
  );
  const entered = showOwn ? ownPoints.find((p) => p.id === enteredId) : null;
  const sites = useWaterQuery('sites?' + new URLSearchParams(filter)),
    stream = useWaterQuery('streams?area=' + area),
    survey = useWaterQuery(showSurvey ? 'survey' : null);
  const publisher = useMapData('/data/river-pollution-context.json', showContext);
  const contextPoints = useMemo(() => {
    if (!publisher.data || !stream.data) return [];
    const b = stream.data.source.bounds;
    return publisher.data.rows
      .map((row) => Object.fromEntries(publisher.data.fields.map((key, i) => [key, row[i]])))
      .filter(
        (p) =>
          p.longitude >= b[0] && p.latitude >= b[1] && p.longitude <= b[2] && p.latitude <= b[3],
      )
      .map((p) => ({
        ...p,
        kind: 'publisher-context',
        name: 'Publisher context ' + p.id + ' · ' + p.publisherClass + ' · date/units unknown',
      }));
  }, [publisher.data, stream.data]);
  const contextPoint = showContext ? contextPoints.find((p) => p.id === contextId) : null;
  const siteId = selected || sites.data?.sites[0]?.id,
    detail = useWaterQuery(siteId ? 'site?id=' + siteId : null);
  const site = detail.data?.site;
  const basePoints = useMemo(
    () =>
      area === 'dhaka'
        ? sites.data?.sites || []
        : showSurvey
          ? (survey.data?.points || []).map((p) => ({
              ...p,
              name: p.channel + ' · velocity ' + decimal(p.velocity) + ' m/s',
              kind: 'velocity',
            }))
          : [],
    [sites.data, survey.data, area, showSurvey],
  );
  const plotted = useMemo(
    () => [
      ...basePoints,
      ...(entered
        ? [entered, ...ownPoints.filter((p) => p.id !== entered.id).slice(0, 499)]
        : ownPoints.slice(0, 500)),
      ...(contextPoint
        ? [contextPoint, ...contextPoints.filter((p) => p.id !== contextPoint.id).slice(0, 299)]
        : contextPoints.slice(0, 300)),
    ],
    [basePoints, contextPoints, contextPoint, ownPoints, entered],
  );
  const history = site?.history || [];
  const rows = showAllHistory ? history.toReversed() : history.slice(-8).toReversed();
  const choose = (p) => {
    if (p.kind === 'private-observation') {
      setEnteredId(p.id);
      setContextId(null);
      return;
    }
    if (p.kind === 'publisher-context') {
      setContextId(p.id);
      return;
    }
    if (p.kind === 'velocity') return;
    setContextId(null);
    setEnteredId(null);
    setSelected(p.id);
    setShowAllHistory(false);
  };
  return (
    <div className="water-workspace">
      <div className="water-task-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {bn ? 'নদীর তথ্য দেখুন' : 'Check rivers and pollution evidence'}
          </h1>
          <p>Follow mapped channels. Compare dated samples. Choose where to check next.</p>
        </div>
        {authenticated ? (
          <button
            type="button"
            className="water-secondary"
            onClick={() => setShowEntry((s) => !s)}
            aria-expanded={showEntry}
          >
            <Plus size={18} aria-hidden="true" />
            Add a measurement
          </button>
        ) : (
          signIn && (
            <a className="aq-inline" href={signIn}>
              Field team sign-in
            </a>
          )
        )}
      </div>
      <search className="water-search">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(draft);
            setSelected(null);
            setArea('dhaka');
          }}
          action="/api/water/sites"
          method="get"
          aria-label="Find river samples"
        >
          <label>
            River or channel
            <select
              name="river"
              value={draft.river}
              onChange={(e) => setDraft((d) => ({ ...d, river: e.target.value }))}
            >
              <option value="">All sampled rivers</option>
              {meta.rivers.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Sampling location
            <input
              type="search"
              name="query"
              maxLength={200}
              value={draft.query}
              onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
              placeholder="For example, Ijtema Field"
            />
          </label>
          <button className="water-primary" type="submit">
            <Search size={18} />
            Find evidence
          </button>
        </form>
      </search>
      {showEntry && authenticated && (
        <MeasurementEntry
          authenticated={authenticated}
          onClose={() => setShowEntry(false)}
          onSaved={(o) => {
            setShowOwn(true);
            setEnteredId(o.id);
            setContextId(null);
            own.reload();
          }}
        />
      )}
      <div className="water-river-layout">
        <section className="water-river-main">
          <div className="water-layer-controls">
            <label>
              Map area
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                {meta.streamAreas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {
                      {
                        dhaka: 'Dhaka rivers',
                        sylhet: 'Sylhet channels',
                        dacope: 'Dacope waterways',
                      }[s.id]
                    }
                  </option>
                ))}
              </select>
            </label>
            <span>
              {stream.data
                ? count(stream.data.ways.length) + ' mapped channel sections'
                : 'Loading mapped channels…'}
            </span>
            <label className="water-checkbox">
              <input
                type="checkbox"
                checked={showContext}
                onChange={(e) => {
                  setShowContext(e.target.checked);
                  setContextId(null);
                }}
              />
              Publisher context · unverified
            </label>
            <label className="water-checkbox">
              <input
                type="checkbox"
                checked={showOwn}
                onChange={(e) => setShowOwn(e.target.checked)}
              />
              My saved measurements
            </label>
            {area === 'sylhet' && (
              <label className="water-checkbox">
                <input
                  type="checkbox"
                  checked={showSurvey}
                  onChange={(e) => setShowSurvey(e.target.checked)}
                />
                Show velocity survey points
              </label>
            )}
          </div>
          <State resource={stream}>
            <AtlasMap
              points={plotted}
              ways={stream.data?.ways || []}
              center={
                entered ||
                contextPoint ||
                (area === 'dhaka' && site
                  ? site
                  : {
                      latitude: area === 'sylhet' ? 24.9 : area === 'dhaka' ? 23.89 : 22.55,
                      longitude: area === 'sylhet' ? 91.87 : area === 'dhaka' ? 90.39 : 89.55,
                    })
              }
              zoom={area === 'dhaka' ? 13 : 12}
              selectedId={entered?.id || contextPoint?.id || siteId}
              onSelect={choose}
              extentKey={area + ':' + (area === 'dhaka' ? siteId : showSurvey)}
              component={
                !entered && !contextPoint && area === 'dhaka' ? site?.channel?.component : null
              }
              label="Mapped waterways and dated observations. Use the sampling-site list below for keyboard selection."
            />
          </State>
          <div className="water-map-key">
            <span className="water-key-stream" />
            Mapped channels <span className="water-key-sample" />
            Historical sample <span>Connections do not prove pollution spread.</span>
          </div>
          {showOwn && (
            <div className="water-entry-summary">
              <p>
                My measurements · {ownPoints.length} saved records. Up to 500 drawn at original
                coordinates; choose any record below. No independent verification is implied.
              </p>
              {own.error && <p className="water-error">{own.error}</p>}
              <label>
                Inspect my measurement
                <select
                  value={enteredId || ''}
                  onChange={(e) => {
                    setEnteredId(e.target.value);
                    setContextId(null);
                  }}
                >
                  <option value="">Choose a saved measurement</option>
                  {ownPoints.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.date} · {o.name}
                    </option>
                  ))}
                </select>
              </label>
              {entered && (
                <dl className="water-record">
                  <div>
                    <dt>Sample / source</dt>
                    <dd>
                      {entered.date} · {entered.metadata.sourceLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>Declared source type</dt>
                    <dd>{entered.metadata.sourceKind}</dd>
                  </div>
                  <div>
                    <dt>Original coordinate</dt>
                    <dd>
                      {entered.latitude}, {entered.longitude}
                    </dd>
                  </div>
                  <div>
                    <dt>pH / oxygen / COD</dt>
                    <dd>
                      {decimal(entered.ph)} / {decimal(entered.do)} mg/L / {decimal(entered.cod)}{' '}
                      mg/L
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
          {showContext && (
            <div className="water-qualification">
              <p>
                {contextPoints.length} publisher-context points in this snapshot area. Up to 300 are
                drawn; dates, units and class validation are unknown. These labels are not measured
                health or water-safety ratings.
              </p>
              {publisher.error && <p role="alert">{publisher.error}</p>}
              <label>
                Inspect a publisher point
                <select value={contextId || ''} onChange={(e) => setContextId(e.target.value)}>
                  <option value="">Choose a context point</option>
                  {contextPoints.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.publisherClass}
                    </option>
                  ))}
                </select>
              </label>
              {contextPoint && (
                <p>
                  {contextPoint.id}: {contextPoint.publisherClass}, publisher value{' '}
                  {contextPoint.publisherValue}; units unknown. Original coordinates{' '}
                  {contextPoint.latitude}, {contextPoint.longitude}. No stream identity is inferred.
                </p>
              )}
              {publisher.data && (
                <>
                  <Source href={publisher.data.url}>Original Kaggle publisher</Source>
                  <Export
                    name={'climateplus-' + area + '-publisher-context.json'}
                    data={{
                      points: contextPoints,
                      source: publisher.data.url,
                      qualification: publisher.data.qualification,
                    }}
                  >
                    Export all context points in this area
                  </Export>
                </>
              )}
            </div>
          )}
          {stream.error && <p className="water-error">{stream.error}</p>}
          {area !== 'dhaka' && (
            <p className="water-qualification">
              {area === 'sylhet'
                ? 'Sylhet quality samples have no verified coordinate crosswalk. Only separately labelled velocity-survey points can be shown.'
                : 'No chemistry coverage is invented for Dacope. The lines show mapped waterways, not a current pollution survey.'}
            </p>
          )}
          {showSurvey && area === 'sylhet' && survey.data && (
            <details>
              <summary>Velocity survey · {survey.data.points.length} locations</summary>
              <p>{survey.data.qualification}</p>
              <div className="water-table-wrap">
                <table>
                  <caption>Surveyed flow speeds · 16 May 2025 · not water quality</caption>
                  <thead>
                    <tr>
                      <th scope="col">Channel / point</th>
                      <th scope="col">Latitude</th>
                      <th scope="col">Longitude</th>
                      <th scope="col">Speed, m/s</th>
                    </tr>
                  </thead>
                  <tbody>
                    {survey.data.points.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">{p.id}</th>
                        <td>{p.latitude}</td>
                        <td>{p.longitude}</td>
                        <td>{decimal(p.velocity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Source href={survey.data.source.url}>BASIS workbook</Source>
            </details>
          )}
          <State resource={sites}>
            <div className="water-section-title">
              <h2>Sampling sites</h2>
              <span>{sites.data?.sites.length || 0} records of places · historical</span>
            </div>
            <div className="water-site-list">
              {sites.data?.sites.length ? (
                sites.data.sites.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={s.id === siteId ? 'selected' : ''}
                    aria-pressed={s.id === siteId}
                    onClick={() => {
                      setArea('dhaka');
                      choose(s);
                    }}
                  >
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.river} · {s.samples} samples · latest {s.latestDate}
                      </small>
                    </span>
                    <span>
                      {s.latest.screening.failed}/{s.latest.screening.tested}
                      <small>fishery checks outside range</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))
              ) : (
                <p className="water-empty">
                  No sample sites match. Clear the name or choose all sampled rivers.
                </p>
              )}
            </div>
          </State>
        </section>
        <aside className="water-inspector water-river-detail">
          <State resource={detail}>
            {area !== 'dhaka' && (
              <>
                <span className="water-tag">Mapped channels · flow unverified</span>
                <h2>{area === 'sylhet' ? 'Sylhet channels' : 'Dacope waterways'}</h2>
                <p>
                  {area === 'sylhet'
                    ? 'The optional points are velocity-survey locations, not quality samples. The workbook does not establish a coordinate crosswalk for its quality stations.'
                    : 'No quality measurements are invented for this area. Use the mapped waterways to scope a field survey and enter newly collected evidence with its actual source.'}
                </p>
                <p className="water-small">
                  {stream.data?.ways.length || 0} mapped sections. Shared nodes show mapped
                  connections, not verified contaminant transport.
                </p>
                {stream.data && (
                  <Source href={stream.data.source.sourceUrl}>
                    OpenStreetMap source and attribution
                  </Source>
                )}
              </>
            )}
            {site && area === 'dhaka' && (
              <>
                <DoneNote
                  did={
                    'opened ' +
                    site.name +
                    ' (' +
                    site.river +
                    '). Latest sample: ' +
                    site.latestDate +
                    '.'
                  }
                  means={
                    site.latest.screening.failed > 0
                      ? site.latest.screening.failed +
                        ' of ' +
                        site.latest.screening.tested +
                        ' checks were outside the safe range for fish, so this water should not be relied on without treatment and testing.'
                      : 'The measured checks were inside the safe range for fish. That is not a drinking-water test.'
                  }
                  next="See the history below, or open “Plan hubs” to see what could replace this water."
                />
                <span className="water-tag water-tag-amber">Historical measurement</span>
                <h2>{site.name}</h2>
                <p className="water-place">
                  {site.river} · {site.latestDate}
                </p>
                <p className="water-small">
                  {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)} · original coordinates
                </p>
                <div className="water-measurements">
                  {site.latest.screening.tests.map((t) => (
                    <div key={t.key}>
                      <span>
                        {
                          {
                            ph: 'pH',
                            do: 'Oxygen in water',
                            cod: 'Oxygen needed to break down chemicals',
                          }[t.key]
                        }
                      </span>
                      <strong>
                        {decimal(t.value)} <small>{t.unit}</small>
                      </strong>
                      <span className={t.failed ? 'water-outside' : ''}>
                        {t.failed ? 'Outside fishery range' : 'Within this tested range'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="water-qualification">
                  {site.latest.screening.failed} of {site.latest.screening.tested} measured fishery
                  checks outside range. This is a partial screen. Drinking-water safety is unknown.
                </p>
                <details>
                  <summary>What the comparison means</summary>
                  <p>
                    pH 6–9, dissolved oxygen at least 5 mg/L, and chemical oxygen demand at most 50
                    mg/L are three of twelve inland-fisheries objectives in the cited 2023
                    Bangladesh gazette. These older samples are screened retrospectively. This is
                    not a complete pollution index, historical legal verdict or drinking-water test.
                  </p>
                  <Source href={site.latest.screening.profile.source}>Gazette · PDF page 53</Source>
                </details>
                <h3>Connected channel context</h3>
                {site.channel ? (
                  <>
                    <p>
                      <strong>{site.channel.name}</strong>
                      <br />
                      Nearest mapped section: {Math.round(site.channel.gapM)} m from the sample.
                    </p>
                    <p className="water-small">
                      Spatial match within 750 m. The connection uses shared map nodes.
                      Sampling-channel identity and present flow still need field checks.
                    </p>
                    <p>
                      {detail.data.connectedSites.length} other sampled places within 5 km on this
                      mapped network.
                    </p>
                    <details>
                      <summary>Inspect connected places</summary>
                      {detail.data.connectedSites.map((s) => (
                        <button
                          className="water-linked-row"
                          key={s.id}
                          type="button"
                          onClick={() => choose(s)}
                        >
                          {s.river} · {s.name}
                          <span>
                            {decimal(s.distanceKm)} km · {s.latestDate}
                          </span>
                        </button>
                      ))}
                    </details>
                  </>
                ) : (
                  <p>
                    No channel match within 750 m. The sample stays at its original position; no
                    connection is invented.
                  </p>
                )}
                <h3>What to do next</h3>
                <ol className="water-checklist">
                  {detail.data.nextSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <Export name={'climateplus-' + site.id + '-sampling-brief.json'} data={detail.data}>
                  Export sampling brief
                </Export>
                {detail.data.nearbyWaterPoints.length > 0 && (
                  <details>
                    <summary>Nearby recorded water points</summary>
                    <p className="water-small">
                      Proximity only. Surface-water samples do not establish contamination of nearby
                      wells.
                    </p>
                    {detail.data.nearbyWaterPoints.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="water-linked-row"
                        onClick={() => onSource(p.id)}
                      >
                        {p.sourceType} · {p.subdistrict}
                        <span>
                          {decimal(p.distanceKm)} km · inventory {p.assessedAt}
                        </span>
                      </button>
                    ))}
                  </details>
                )}
                <h3>Samples over time</h3>
                <p className="water-small">
                  {site.samples} dates/records from {site.firstDate} to {site.latestDate}. No live
                  monitoring is implied.
                </p>
                <div className="water-table-wrap">
                  <table className="water-history-table">
                    <caption>Historical chemistry · original values and units</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">pH</th>
                        <th scope="col">
                          Oxygen
                          <br />
                          mg/L
                        </th>
                        <th scope="col">
                          COD
                          <br />
                          mg/L
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((o) => (
                        <tr key={o.id}>
                          <th scope="row">{o.date}</th>
                          <td>{decimal(o.ph)}</td>
                          <td>{decimal(o.do)}</td>
                          <td>{decimal(o.cod)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {history.length > 8 && (
                  <button
                    type="button"
                    className="water-text-button"
                    onClick={() => setShowAllHistory((s) => !s)}
                  >
                    {showAllHistory ? 'Show latest 8' : 'Show all ' + history.length + ' samples'}
                    <ChevronDown size={15} />
                  </button>
                )}
                <Source href={detail.data.sources[0].url}>Original dataset · CC BY 4.0</Source>
              </>
            )}
          </State>
        </aside>
      </div>
    </div>
  );
}
