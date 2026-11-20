import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Waves,
  Play,
  Pause,
  RotateCcw,
  CloudLightning,
  Droplets,
  Sun,
  FlaskConical,
  Info,
  Download,
  MapPin,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import { createRoutingEngine } from '../../routing/engine.mjs';
import {
  initialScenarioState,
  scenarioReducer,
  calculateScenario,
  enteredPointsCollection,
} from './scenario-model.mjs';
import { useMapData } from './use-map-data.mjs';
import { useServerPlan } from './use-server-plan.mjs';
import { buildPublishedVectors, observationsToFeatures } from './pollution-vectors.mjs';
import { MVPMap } from './MVPMap.jsx';
import { PollutionInput, emptyObservationDraft } from './PollutionInput.jsx';
import { PointDetails } from './PointDetails.jsx';
import { api } from '../operations/api-client.mjs';
import { useOperationsResource } from '../operations/use-operations.mjs';
import { describeFix, startDeviceTracking } from '../operations/device-gps.mjs';
import './map-mvp.css';

const roleName = {
  supplier: 'Supplier',
  reserve: 'Reserve',
  pump: 'Pump',
  pond: 'Pond',
  school: 'School',
  crew: 'Crew base',
};
const inBounds = (f, b) => {
  const [x, y] = f.geometry.coordinates;
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
};
function exportJSON(name, value) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/geo+json' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function MapMVP({ signInPath }) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [state, dispatch] = useReducer(scenarioReducer, null, () =>
    initialScenarioState(params.get('region') || 'dacope', { hazard: params.get('hazard') }),
  );
  const index = useMapData('/data/regions/index.json');
  const region = index.data?.regions.find((r) => r.id === state.regionId);
  const graph = useMapData(region?.graphUrl),
    scenario = useMapData(region?.scenarioUrl);
  const [pollutionOn, setPollutionOn] = useState(false),
    [showInput, setShowInput] = useState(false),
    [showGuide, setShowGuide] = useState(false),
    [selection, setSelection] = useState(null),
    [selectedEdge, setSelectedEdge] = useState(''),
    [localEntries, setLocalEntries] = useState([]),
    [saving, setSaving] = useState(false),
    [saveStatus, setSaveStatus] = useState(''),
    [error, setError] = useState(''),
    [observationDraft, setObservationDraft] = useState(() => ({ ...emptyObservationDraft })),
    [picking, setPicking] = useState(false),
    [fitKey, setFitKey] = useState(0),
    [deviceFix, setDeviceFix] = useState(null),
    [gpsActive, setGpsActive] = useState(false),
    [gpsMessage, setGpsMessage] = useState(''),
    [gpsConsent, setGpsConsent] = useState(false),
    [now, setNow] = useState(Date.now());
  const gpsTracker = useRef(null),
    mounted = useRef(true);
  const measured = useMapData('/data/water-evidence.json', pollutionOn),
    context = useMapData('/data/river-pollution-context.json', pollutionOn);
  const me = useOperationsResource('/me');
  const saved = useOperationsResource('/observations', {
    enabled: pollutionOn && !!me.data,
    interval: 10000,
  });
  const engine = useMemo(() => (graph.data ? createRoutingEngine(graph.data) : null), [graph.data]);
  const localResult = useMemo(
    () =>
      engine && scenario.data?.regionId === state.regionId
        ? calculateScenario(engine, scenario.data, state)
        : null,
    [
      engine,
      scenario.data,
      state.regionId,
      state.hazard,
      state.severity,
      state.destinationRole,
      state.blockedEdgeIds,
    ],
  );
  const scenarioRequest = useMemo(
    () => ({
      regionId: state.regionId,
      hazard: state.hazard,
      severity: state.severity,
      destinationRole: state.destinationRole,
      blockedEdgeIds: state.blockedEdgeIds,
    }),
    [state.regionId, state.hazard, state.severity, state.destinationRole, state.blockedEdgeIds],
  );
  const serverPlan = useServerPlan(
    scenarioRequest,
    graph.data?.metadata?.graphSha256,
    !!localResult,
  );
  const result = serverPlan.data || localResult;
  const chosen =
    result?.routes?.find((r) => r.id === state.chosenRouteId) || result?.routes?.[0] || null;
  const playback = useMemo(
    () => (engine && chosen ? engine.pointAlongRoute(chosen, state.distanceM) : null),
    [engine, chosen, state.distanceM],
  );
  const published = useMemo(
    () =>
      region && pollutionOn
        ? buildPublishedVectors(measured.data, context.data, region.bounds)
        : { features: [], counts: {} },
    [region, pollutionOn, measured.data, context.data],
  );
  const privateFeatures = useMemo(
    () =>
      region && saved.data ? observationsToFeatures(saved.data.observations, region.bounds) : [],
    [region, saved.data],
  );
  const pollution = useMemo(() => {
    if (!region || !pollutionOn) return [];
    return [
      ...new Map(
        [
          ...published.features,
          ...privateFeatures,
          ...localEntries.map((e) => e.feature).filter((f) => inBounds(f, region.bounds)),
        ].map((f) => [f.properties.id, f]),
      ).values(),
    ];
  }, [region, pollutionOn, published, privateFeatures, localEntries]);
  const activeFeature =
    selection?.kind === 'pollution'
      ? pollution.find((f) => f.properties.id === selection.id)
      : null;
  const activeAsset =
    scenario.data?.assets.find((a) => a.id === selection?.id) ||
    (!activeFeature ? result?.destination : null);
  const pending = localEntries.filter((e) => !e.saved);
  useEffect(() => {
    if (index.data && !region) dispatch({ type: 'REGION', regionId: index.data.regions[0].id });
  }, [index.data, region]);
  useEffect(() => {
    setSelection(null);
    setSelectedEdge('');
    setPicking(false);
    setError('');
  }, [state.regionId]);
  useEffect(() => {
    const next = new URL(location.href);
    next.searchParams.set('region', state.regionId);
    if (state.hazard === 'clear') next.searchParams.delete('hazard');
    else next.searchParams.set('hazard', state.hazard);
    history.replaceState(null, '', next.pathname + next.search);
  }, [state.regionId, state.hazard]);
  useEffect(() => {
    if (!state.playing || !chosen) return;
    let frame,
      last = 0;
    const tick = (t) => {
      if (last && t - last >= 120) {
        const seconds = Math.min(1, (t - last) / 1000);
        dispatch({
          type: 'ADVANCE',
          deltaM: (chosen.distanceM / Math.max(1, chosen.durationS)) * seconds * 20,
          totalM: chosen.distanceM,
        });
        last = t;
      } else if (!last) last = t;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing, chosen]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      gpsTracker.current?.stop();
    };
  }, []);
  function selectPoint(p) {
    setSelection(p);
    setShowInput(false);
    if (p.kind === 'asset') {
      const a = scenario.data.assets.find((a) => a.id === p.id);
      if (a && a.role !== 'supplier') dispatch({ type: 'DESTINATION', role: a.role });
    }
  }
  function setHazard(hazard) {
    dispatch({ type: 'HAZARD', hazard });
    setSelectedEdge('');
  }
  function stage(parsed) {
    if (localEntries.length + parsed.features.length > 1000)
      throw Error(
        'This page supports up to1000 entered points. Export/save these points before starting a new page.',
      );
    const entries = parsed.features.map((f, i) => {
      const id = 'local-' + crypto.randomUUID();
      return {
        id,
        feature: { ...f, id, properties: { ...f.properties, id } },
        observation: parsed.observations[i],
        saved: false,
      };
    });
    setLocalEntries((old) => [...old, ...entries]);
    setPollutionOn(true);
    setPicking(false);
    const within = entries.filter((e) => inBounds(e.feature, region.bounds));
    setSelection(within[0] ? { kind: 'pollution', id: within[0].id } : null);
    setSaveStatus(
      `${entries.length} point${entries.length === 1 ? '' : 's'} added; ${within.length} within ${region.name}. ${within.length < entries.length ? 'Other coordinates remain unchanged outside this region.' : ''}`,
    );
  }
  async function savePoints() {
    setSaving(true);
    setError('');
    let count = 0;
    try {
      for (const entry of pending) {
        const response = await api('/observations', { method: 'POST', body: entry.observation });
        const f = observationsToFeatures([response.observation])[0];
        if (!mounted.current) return;
        setLocalEntries((old) =>
          old.map((e) => (e.id === entry.id ? { ...e, feature: f, saved: true } : e)),
        );
        setSelection((old) =>
          old?.id === entry.id ? { kind: 'pollution', id: f.properties.id } : old,
        );
        count++;
        setSaveStatus(`Saved ${count} of ${pending.length} points to the database.`);
      }
      saved.reload();
    } catch (e) {
      setError(
        `Saved ${count} of ${pending.length}. Remaining points are still in this page for retry: ${e.message}`,
      );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  function startGPS() {
    try {
      setGpsMessage('Waiting for device permission and a fix…');
      gpsTracker.current = startDeviceTracking({
        geolocation: navigator.geolocation,
        role: 'supplier',
        publish: async (fix) => {
          if (mounted.current) setDeviceFix(fix);
        },
        onState: (s) => {
          if (mounted.current)
            setGpsMessage(
              s.message || (s.status === 'shared' ? 'Device position received locally' : s.status),
            );
        },
      });
      setGpsActive(true);
    } catch (e) {
      setGpsMessage(e.message);
    }
  }
  function stopGPS() {
    gpsTracker.current?.stop();
    gpsTracker.current = null;
    setGpsActive(false);
    setDeviceFix(null);
    setGpsMessage('Device watch stopped; local position cleared.');
  }
  function download() {
    exportJSON(`climateplus-${state.regionId}-map.geojson`, {
      type: 'FeatureCollection',
      properties: {
        region: region.name,
        scenario: state.hazard,
        qualification:
          'Scenario assets/hazards; road geometry snapshot; pollution keeps original source meaning. Device GPS is excluded.',
      },
      features: [
        ...scenario.data.assets.map((a) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
          properties: { ...a, kind: 'scenario-asset' },
        })),
        ...(result.activeHazard ? [result.activeHazard] : []),
        ...(chosen
          ? [
              {
                type: 'Feature',
                geometry: chosen.geometry,
                properties: {
                  kind: 'scenario-route',
                  distanceM: chosen.distanceM,
                  durationS: chosen.durationS,
                  assumedSpeedKmh: 25,
                },
              },
            ]
          : []),
        ...pollution,
      ],
    });
  }
  const problem = index.error || graph.error || scenario.error;
  const gpsDescription = describeFix(deviceFix, now);
  return (
    <div className="mvp">
      <header className="mvp-header">
        <a className="mvp-brand" href="/" aria-label="Aquavelle response map">
          <Waves size={25} />
          <span>
            climate<span>++</span>
          </span>
        </a>
        <div className="mvp-header-title">
          <h1>Water response map</h1>
          <span>V3</span>
        </div>
        <button
          className="mvp-secondary"
          aria-expanded={showGuide}
          onClick={() => setShowGuide((v) => !v)}
        >
          <Info size={16} />
          Guide & evidence
        </button>
      </header>
      <main className="mvp-main">
        <div className="mvp-toolbar">
          <label className="mvp-region">
            Region
            <select
              value={state.regionId}
              onChange={(e) => dispatch({ type: 'REGION', regionId: e.target.value })}
            >
              {index.data?.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mvp-conditions" role="group" aria-label="Calamity scenario">
            {[
              ['clear', 'Normal', Sun],
              ['storm', 'Storm', CloudLightning],
              ['salinity', 'Salinity', Droplets],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                className={state.hazard === id ? 'is-active' : ''}
                aria-pressed={state.hazard === id}
                onClick={() => setHazard(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <label className="mvp-layer-toggle">
            <input
              type="checkbox"
              checked={pollutionOn}
              onChange={(e) => {
                setPollutionOn(e.target.checked);
                if (!e.target.checked && selection?.kind === 'pollution') setSelection(null);
              }}
            />
            <FlaskConical size={16} />
            Pollution points
          </label>
          <button
            className="mvp-secondary"
            onClick={() => {
              setShowInput((v) => !v);
              setPollutionOn(true);
            }}
          >
            <MapPin size={16} />
            Add points
          </button>
        </div>
        {problem ? (
          <section className="mvp-data-state" role="alert">
            <h2>The region data could not load.</h2>
            <p>{problem}</p>
            <button
              className="mvp-primary"
              onClick={() => {
                index.retry();
                graph.retry();
                scenario.retry();
              }}
            >
              Retry local datasets
            </button>
          </section>
        ) : !result || !region ? (
          <section className="mvp-data-state" role="status">
            Loading regional roads and scenario vectors…
          </section>
        ) : (
          <>
            <div className="mvp-region-context">
              <p>
                <strong>{region.name}</strong> · six scenario service points on sourced roads
              </p>
              <span>
                {state.hazard === 'storm'
                  ? 'Scenario storm area + declared road closure'
                  : state.hazard === 'salinity'
                    ? `${result.heldAssetIds.length} source point held in the salinity scenario`
                    : 'Choose a calamity to see the response change'}
              </span>
            </div>
            {error && (
              <p className="mvp-error" role="alert">
                {error}
              </p>
            )}
            <div className="mvp-workspace">
              <section className="mvp-map-column">
                <MVPMap
                  region={region}
                  graph={graph.data}
                  scenario={scenario.data}
                  result={result}
                  selectedRoute={chosen}
                  selectedId={selection?.id || result.destination.id}
                  selectedEdge={selectedEdge}
                  onSelect={selectPoint}
                  onEdge={(id) => {
                    setSelectedEdge(id);
                    dispatch({ type: 'PAUSE' });
                  }}
                  playback={playback}
                  deviceFix={deviceFix}
                  pollution={pollution}
                  pickPoint={picking}
                  onPickPoint={(p) => {
                    setObservationDraft((old) => ({
                      ...old,
                      latitude: p.latitude.toFixed(6),
                      longitude: p.longitude.toFixed(6),
                    }));
                    setPicking(false);
                    setShowInput(true);
                  }}
                  fitKey={fitKey}
                />
                <div className="mvp-playback">
                  <button
                    className="mvp-primary"
                    disabled={!chosen || chosen.distanceM <= 0}
                    onClick={() => {
                      if (state.distanceM >= chosen.distanceM) dispatch({ type: 'RESTART' });
                      dispatch({ type: 'PLAY' });
                    }}
                  >
                    {state.playing ? <Pause size={17} /> : <Play size={17} />}{' '}
                    {state.playing ? 'Pause delivery' : 'Play delivery'}
                  </button>
                  <div className="mvp-playback-progress">
                    <span>Scenario playback ·20× · not device GPS</span>
                    <progress
                      aria-label="Delivery playback progress"
                      value={state.distanceM}
                      max={chosen?.distanceM || 1}
                    />
                  </div>
                  <button
                    className="mvp-icon-button"
                    aria-label="Restart delivery playback"
                    onClick={() => dispatch({ type: 'RESTART' })}
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button className="mvp-text-button" onClick={() => setFitKey((n) => n + 1)}>
                    Fit map
                  </button>
                </div>
              </section>
              <aside className="mvp-side" aria-label="Delivery and point details">
                {showInput ? (
                  <PollutionInput
                    region={region}
                    scenario={scenario.data}
                    draft={observationDraft}
                    onDraftChange={setObservationDraft}
                    picking={picking}
                    onPick={() => setPicking((v) => !v)}
                    onStage={stage}
                    pendingCount={pending.length}
                    onSave={savePoints}
                    saving={saving}
                    saveStatus={saveStatus}
                    authenticated={!!me.data}
                    signInPath={signInPath}
                    onClose={() => {
                      setShowInput(false);
                      setPicking(false);
                    }}
                  />
                ) : (
                  <>
                    <section className="mvp-delivery">
                      <h2>Delivery from supplier</h2>
                      <p className="mvp-calculation-state" role="status">
                        {serverPlan.data
                          ? 'Server-calculated route'
                          : serverPlan.loading
                            ? 'Checking server route…'
                            : 'Local snapshot calculation · server unavailable'}
                      </p>
                      <label>
                        Destination
                        <select
                          value={state.destinationRole}
                          onChange={(e) => {
                            dispatch({ type: 'DESTINATION', role: e.target.value });
                            setSelection({
                              kind: 'asset',
                              id: scenario.data.assets.find((a) => a.role === e.target.value).id,
                            });
                            setSelectedEdge('');
                          }}
                        >
                          {scenario.data.assets
                            .filter((a) => a.role !== 'supplier')
                            .map((a) => (
                              <option key={a.id} value={a.role}>
                                {roleName[a.role]}
                              </option>
                            ))}
                        </select>
                      </label>
                      {chosen ? (
                        <>
                          <div className="mvp-route-summary">
                            <div>
                              <strong>
                                {(chosen.distanceM / 1000).toFixed(2)}
                                <small>km</small>
                              </strong>
                              <span>Road distance</span>
                            </div>
                            <div>
                              <strong>
                                {(chosen.durationS / 60).toFixed(1)}
                                <small>min</small>
                              </strong>
                              <span>Modelled time</span>
                            </div>
                          </div>
                          <p className="mvp-help">
                            25 km/h assumption with road caps. Access gaps excluded; current
                            traffic/access unknown.
                          </p>
                          <div className="mvp-route-options" role="group" aria-label="Choose route">
                            {result.routes.map((r, i) => (
                              <button
                                key={r.id}
                                className={chosen.id === r.id ? 'is-active' : ''}
                                aria-pressed={chosen.id === r.id}
                                onClick={() => {
                                  dispatch({ type: 'ROUTE', id: r.id });
                                  setSelectedEdge('');
                                }}
                              >
                                {i ? 'Alternative' : 'Shortest'} · {(r.distanceM / 1000).toFixed(2)}
                                km
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mvp-small-warning">
                          No supported road route: {result.status.replaceAll('_', ' ')}. Clear
                          manual blocks or change the scenario; no route is invented.
                        </p>
                      )}
                      {(result.snap?.origin?.distanceM > 50 ||
                        result.snap?.destination?.distanceM > 50) && (
                        <p className="mvp-small-warning">
                          An endpoint is more than50 m from its road. This connector is unverified
                          and excluded from time/distance.
                        </p>
                      )}
                      <div className="mvp-road-actions">
                        <details>
                          <summary>Choose a road by name</summary>
                          <label>
                            Route segment
                            <select
                              value={selectedEdge}
                              onChange={(e) => {
                                setSelectedEdge(e.target.value);
                                dispatch({ type: 'PAUSE' });
                              }}
                            >
                              <option value="">Select a road segment</option>
                              {chosen?.edges.map((e, i) => (
                                <option key={`${e.id}-${i}`} value={e.id}>
                                  {e.name} · {e.id}
                                </option>
                              ))}
                            </select>
                          </label>
                        </details>
                        {selectedEdge ? (
                          <>
                            <span className="mvp-help">
                              Selected road: <code>{selectedEdge}</code>
                            </span>
                            <button
                              className="mvp-secondary"
                              onClick={() => {
                                dispatch({ type: 'BLOCK', id: selectedEdge });
                                setSelectedEdge('');
                              }}
                            >
                              Block selected road
                            </button>
                          </>
                        ) : (
                          <p className="mvp-help">
                            Click a route segment to add a scenario blockage.
                          </p>
                        )}
                        {state.blockedEdgeIds.length > 0 && (
                          <button
                            className="mvp-text-button"
                            onClick={() => {
                              dispatch({ type: 'CLEAR_BLOCKS' });
                              setSelectedEdge('');
                            }}
                          >
                            Clear {state.blockedEdgeIds.length} manual block
                            {state.blockedEdgeIds.length === 1 ? '' : 's'}
                          </button>
                        )}
                      </div>
                    </section>
                    <PointDetails
                      asset={activeFeature ? null : activeAsset}
                      feature={activeFeature}
                      held={activeAsset && result.heldAssetIds.includes(activeAsset.id)}
                    />
                    {pollutionOn && (
                      <section className="mvp-pollution-summary">
                        <div className="mvp-section-line">
                          <h2>Pollution layer</h2>
                          <button className="mvp-text-button" onClick={() => setShowInput(true)}>
                            Add data
                          </button>
                        </div>
                        {measured.loading || context.loading ? (
                          <p className="mvp-help">Loading published point records…</p>
                        ) : (
                          <p className="mvp-help">
                            {published.counts.measuredShown || 0} historical measurement sites ·{' '}
                            {published.counts.contextShown || 0} publisher context points ·{' '}
                            {privateFeatures.length} saved entries in this region.
                          </p>
                        )}
                        {!pollution.length && !measured.loading && !context.loading && (
                          <p className="mvp-help">
                            No source points in this extent. Add/import local observations; points
                            from another region are not relocated.
                          </p>
                        )}
                        {(measured.error || context.error) && (
                          <p className="mvp-small-warning">
                            Published layer unavailable.{' '}
                            <button
                              onClick={() => {
                                measured.retry();
                                context.retry();
                              }}
                            >
                              Retry
                            </button>
                          </p>
                        )}
                        {pollution.length > 0 && (
                          <label>
                            Inspect observation
                            <select
                              value={activeFeature?.properties.id || ''}
                              onChange={(e) =>
                                setSelection({ kind: 'pollution', id: e.target.value })
                              }
                            >
                              <option value="">Choose a point</option>
                              {pollution.map((f) => (
                                <option key={f.properties.id} value={f.properties.id}>
                                  {f.properties.date || 'Undated'} · {f.properties.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {published.counts.omittedByCap > 0 && (
                          <p className="mvp-help">
                            {published.counts.omittedByCap} additional source points omitted by
                            the1500-feature display cap.
                          </p>
                        )}
                      </section>
                    )}
                  </>
                )}
              </aside>
            </div>
            <div className="mvp-under-map">
              <div className="mvp-legend">
                <span>
                  <i className="route" />
                  Selected route
                </span>
                <span>
                  <i className="alternative" />
                  Alternative
                </span>
                <span>
                  <i className="block" />
                  Scenario closure
                </span>
                <span>
                  <i className="replay" />
                  Delivery replay
                </span>
                {pollutionOn && (
                  <span>
                    <i className="sample" />
                    Attributed pollution point
                  </span>
                )}
              </div>
              <button className="mvp-text-button" onClick={download}>
                <Download size={15} />
                Export region GeoJSON
              </button>
              {localEntries.length > 0 && (
                <button
                  className="mvp-text-button"
                  onClick={() =>
                    exportJSON(
                      'climateplus-all-entered-pollution-points.geojson',
                      enteredPointsCollection(localEntries),
                    )
                  }
                >
                  <Download size={15} />
                  Export all entered points ({localEntries.length})
                </button>
              )}
            </div>
            <p className="mvp-truth">
              <ShieldCheck size={15} />
              Scenario assets and hazards are representational. No point or route certifies safe
              drinking water or safe travel.
            </p>
            <details className="mvp-gps">
              <summary>
                <Navigation size={16} />
                Device GPS & shared operations
              </summary>
              <div className="mvp-gps-content">
                <p>
                  Actual device location is optional and stays on this device in this view. It is
                  separate from the replay and is not a scenario ETA input.
                </p>
                <label className="mvp-consent">
                  <input
                    type="checkbox"
                    checked={gpsConsent}
                    disabled={gpsActive}
                    onChange={(e) => setGpsConsent(e.target.checked)}
                  />
                  Allow this page to show my device location.
                </label>
                <div className="mvp-button-row">
                  <button
                    className="mvp-secondary"
                    disabled={!gpsConsent || gpsActive}
                    onClick={startGPS}
                  >
                    Show device GPS
                  </button>
                  <button
                    className="mvp-secondary"
                    disabled={!gpsActive && !deviceFix}
                    onClick={stopGPS}
                  >
                    Stop & clear GPS
                  </button>
                  <a href={`/?workspace=advanced&region=${region.id}`} className="mvp-text-button">
                    Open private live-delivery workspace
                  </a>
                </div>
                <p className="mvp-help" role="status">
                  {gpsMessage}
                  {deviceFix
                    ? ` · ${gpsDescription.label} · ±${Math.round(deviceFix.accuracyM)}m · captured ${new Date(deviceFix.capturedAt).toLocaleTimeString()}`
                    : ''}
                </p>
              </div>
            </details>
          </>
        )}
        {showGuide && (
          <section className="mvp-guide">
            <div className="mvp-section-line">
              <h2>One workflow, repeatable by region</h2>
              <button className="mvp-text-button" onClick={() => setShowGuide(false)}>
                Close guide
              </button>
            </div>
            <ol>
              <li>
                Select a region. The local road graph and all six service-point roles change
                together.
              </li>
              <li>
                Choose Storm or Salinity. Inspect the fictional area and the declared scenario
                response.
              </li>
              <li>
                Play a delivery or select a road segment to block; compare the resulting road
                alternative.
              </li>
              <li>
                Enable pollution points or add/import an attributed measurement at its original
                coordinate.
              </li>
            </ol>
            <p>
              Based on Antar’s Dacope calamity GIS handoff. Other regions repeat the role template
              on locally sourced OpenStreetMap roads, using fictional assets rather than invented
              real facilities. Storm polygons and road closures are independent declared scenario
              assumptions, not a calibrated flood model.
            </p>
            <p>
              Measured pH/DO/COD screen only three inland-fisheries objectives; publisher
              classifications are separate unverified context. Neither is a drinking-water or health
              rating. No current water clearance, industrial-emitter attribution or affected-area
              plume is inferred.
            </p>
            <div className="mvp-source-links">
              <a href="/data/regions/index.json" target="_blank" rel="noreferrer">
                Region bounds & road sources
              </a>
              <a href="/data/source-register.json" target="_blank" rel="noreferrer">
                Complete dataset register
              </a>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OSM attribution & licence
              </a>
            </div>
            {region && (
              <details>
                <summary>Current road and routing assumptions</summary>
                <p>
                  {region.name} · {engine?.metadata.edgeCount || '—'} graph edges ·{' '}
                  {region.source.osmBaseTimestamp
                    ? `OSM snapshot ${region.source.osmBaseTimestamp}`
                    : 'Supplied Dacope road snapshot'}
                </p>
                <code>Source SHA-256: {engine?.metadata.sourceSha256}</code>
                {serverPlan.error && (
                  <p className="mvp-small-warning">
                    {serverPlan.error} The map is using its labelled local snapshot fallback.{' '}
                    <button className="mvp-text-button" onClick={serverPlan.retry}>
                      Retry server
                    </button>
                  </p>
                )}
                <ul>
                  {result?.warnings?.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mvp-help">
              This is an expandable prototype, not a verified emergency dispatch service. Public raw
              sources, deterministic builders, input validation and database migrations are included
              in the collaborator kit. The optional advanced tools remain outside the primary map.
            </p>
          </section>
        )}
      </main>
      <footer className="mvp-footer">
        <span>climate++ V3</span>
        <span>Explore a response. Inspect the evidence. Add the next region.</span>
      </footer>
    </div>
  );
}
