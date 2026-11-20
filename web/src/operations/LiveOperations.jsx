import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Download,
  Radio,
  Square,
  Play,
  Route,
  AlertTriangle,
  Link,
  Check,
} from 'lucide-react';
import { api } from './api-client.mjs';
import { useOperationsResource } from './use-operations.mjs';
import { describeFix, startDeviceTracking } from './device-gps.mjs';
import {
  rememberInvitation,
  readInvitation,
  consumeInvitation,
  tabStorage,
} from './invitation-handoff.mjs';
import { OperationMap } from './OperationMap.jsx';
import './operations.css';

export function OperationsAccess({ children }) {
  const me = useOperationsResource('/me');
  if (me.loading)
    return (
      <section className="op-panel" role="status">
        Connecting to your private operations…
      </section>
    );
  if (!me.data)
    return (
      <section className="op-panel">
        <h2>Private operations need a signed-in account.</h2>
        <p>{me.error}</p>
        <p>
          Trips, device locations and investigations are stored in the database and visible only to
          their members. Public historical evidence remains available in Data library & GIS.
        </p>
        <a
          className="primary op-link"
          href="/signin-with-chatgpt?return_to=/"
          target="_top"
          onClick={() => rememberInvitation(location.hash, tabStorage(window))}
        >
          Sign in to operations <Navigation size={16} />
        </a>
        <button className="quiet" onClick={me.reload}>
          Retry connection
        </button>
        <p className="op-muted">
          Local development uses the starter’s loopback-only test identity. Hosted access uses the
          Site’s normal sign-in.
        </p>
        {location.hash.startsWith('#join=') && (
          <p className="op-muted">
            This tab holds the invitation for up to ten minutes during sign-in and clears it when
            loaded. If tab storage is blocked, reopen the original invitation link after signing in.
          </p>
        )}
      </section>
    );
  return (
    <>
      <div className="op-account">
        <span>
          <Check size={15} /> Signed in as {me.data.actor.displayName || me.data.actor.email}
        </span>
        <a href="/signout-with-chatgpt?return_to=/" target="_top">
          Sign out
        </a>
      </div>
      {children}
    </>
  );
}
export async function exportOperations() {
  const value = await api('/export');
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = 'climateplus-private-operations.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const time = (value) => (value ? new Date(value).toLocaleString() : 'Not received');
const field = (event, set) => set(event.target.value);

function Endpoint({ label, value, onChange, assets }) {
  return (
    <fieldset className="op-endpoint">
      <legend>{label}</legend>
      <label>
        Choose a starting template
        <select
          value={value.id || ''}
          onChange={(e) => {
            const p = assets.find((a) => a.id === e.target.value);
            if (p)
              onChange({ ...p, label: p.name, provenance: 'representational supplied GIS asset' });
          }}
        >
          <option value="">Enter coordinates, or choose a GIS example</option>
          {assets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · representational
            </option>
          ))}
        </select>
      </label>
      <label>
        Location label
        <input
          required
          maxLength={120}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
      </label>
      <div className="op-two">
        <label>
          Latitude
          <input
            required
            type="number"
            step="any"
            min="-90"
            max="90"
            value={value.latitude}
            onChange={(e) =>
              onChange({
                ...value,
                id: '',
                latitude: e.target.value,
                provenance: 'operator-entered coordinates; unverified',
              })
            }
          />
        </label>
        <label>
          Longitude
          <input
            required
            type="number"
            step="any"
            min="-180"
            max="180"
            value={value.longitude}
            onChange={(e) =>
              onChange({
                ...value,
                id: '',
                longitude: e.target.value,
                provenance: 'operator-entered coordinates; unverified',
              })
            }
          />
        </label>
      </div>
      <p className="op-muted">
        {value.provenance ||
          'No location selected. Coordinate entry does not verify a supplier or drinking-water quality.'}
      </p>
    </fieldset>
  );
}
function CreateTrip({ assets, regions = [], onCreated, onError, busy, run }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [mode, setMode] = useState('operational'),
    [speed, setSpeed] = useState(25),
    [regionId, setRegionId] = useState(
      new URLSearchParams(location.search).get('region') || 'dacope',
    );
  const empty = { label: '', latitude: '', longitude: '', provenance: '' };
  const [origin, setOrigin] = useState(empty),
    [destination, setDestination] = useState(empty);
  const regionAssets = regions.find((r) => r.id === regionId)?.assets || assets;
  return (
    <>
      <button className="primary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Plus size={17} /> New trip
      </button>
      {open && (
        <form
          className="op-panel op-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const endpoint = (p) => ({
                label: p.label,
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
                provenance: p.provenance,
              });
              const r = await api('/trips', {
                method: 'POST',
                body: {
                  name,
                  regionId,
                  mode,
                  origin: endpoint(origin),
                  destination: endpoint(destination),
                  assumedSpeedKmh: Number(speed),
                  profile: 'road',
                },
              });
              onCreated(r.trip);
              setOpen(false);
            }).catch(onError);
          }}
        >
          <h2>Create a delivery trip</h2>
          {regions.length > 0 && (
            <label>
              Road region
              <select
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  setOrigin(empty);
                  setDestination(empty);
                }}
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="op-two">
            <label>
              Trip name
              <input
                required
                maxLength={120}
                placeholder="e.g. Reserve delivery · morning shift"
                value={name}
                onChange={(e) => field(e, setName)}
              />
            </label>
            <label>
              Trip mode
              <select value={mode} onChange={(e) => field(e, setMode)}>
                <option value="operational">Operational · opt-in real device GPS</option>
                <option value="replay">Representational replay · no real GPS</option>
              </select>
            </label>
          </div>
          <p className="op-muted">
            Road coverage is limited to the selected region's frozen OSM snapshot. Coordinates
            outside coverage return “off graph”; no road or ETA is invented.
          </p>
          <div className="op-two">
            <Endpoint
              label="Supplier / vehicle departure"
              value={origin}
              onChange={setOrigin}
              assets={regionAssets}
            />
            <Endpoint
              label="Reserve / recipient destination"
              value={destination}
              onChange={setDestination}
              assets={regionAssets}
            />
          </div>
          <label>
            Assumed vehicle speed (km/h)
            <input
              required
              type="number"
              min="1"
              max="80"
              value={speed}
              onChange={(e) => field(e, setSpeed)}
            />
          </label>
          <p className="op-muted">
            Road-type speed caps also apply. Traffic, flooding, bridge loading and physical access
            are unverified.
          </p>
          <button className="primary" disabled={busy}>
            Save trip to database
          </button>
        </form>
      )}
    </>
  );
}

export function LiveOperations({ onOpenLibrary }) {
  const trips = useOperationsResource('/trips', { interval: 5000 }),
    catalogue = useOperationsResource('/catalogue');
  const [id, setId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [token, setToken] = useState(() => readInvitation(location.hash, tabStorage(window)));
  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      return await action();
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const act = (action) => run(action).catch(() => {});
  useEffect(() => {
    consumeInvitation('', tabStorage(window));
    if (location.hash.startsWith('#join='))
      history.replaceState(null, '', location.pathname + location.search);
  }, []);
  const all = trips.data?.trips || [];
  const active = id || all[0]?.id || '';
  return (
    <div className="operations">
      <div className="op-intro">
        <div>
          <h2>Track a trip. Respond to a blocked road.</h2>
          <p>
            Create a shared trip, opt in to GPS on each device, and compare mapped routes with
            explicit assumptions.
          </p>
        </div>
        <button className="quiet" onClick={onOpenLibrary}>
          <MapPin size={16} /> Public water evidence
        </button>
      </div>
      <div className="op-notice">
        <AlertTriangle size={19} />
        <p>
          No current drinking-water clearance is available. Preset wells, reserves and suppliers are{' '}
          <strong>representational</strong>. A route is not confirmation of road access or safe
          water.
        </p>
      </div>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="op-success" role="status">
          {notice}
        </p>
      )}
      <div className="op-toolbar">
        <label>
          Saved trips
          <select
            aria-label="Select saved trip"
            value={active}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="" disabled>
              Select a trip
            </option>
            {all.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.mode} · {t.membershipRole}
              </option>
            ))}
          </select>
        </label>
        <button className="quiet" onClick={trips.reload}>
          <RefreshCw size={16} /> Refresh
        </button>
        <button className="quiet" onClick={() => act(exportOperations)} disabled={busy}>
          <Download size={16} /> My data
        </button>
      </div>
      {trips.error && (
        <p className="op-error" role="alert">
          {trips.error} Last loaded records may be outdated.
        </p>
      )}
      <CreateTrip
        assets={catalogue.data?.assets || []}
        regions={catalogue.data?.regions || []}
        busy={busy}
        run={run}
        onError={() => {}}
        onCreated={(trip) => {
          setId(trip.id);
          trips.reload();
          setNotice('Trip saved. It will survive a browser or server restart.');
        }}
      />
      {!active && !trips.loading && (
        <div className="op-empty">
          <Route size={30} />
          <h2>Your first delivery starts here.</h2>
          <p>
            Create an operational trip for real GPS, or select replay mode to demonstrate the
            routing workflow.
          </p>
        </div>
      )}
      <details className="op-panel" open={Boolean(token)}>
        <summary>
          <Link size={16} /> Join a collaborator’s trip
        </summary>
        <form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const r = await api('/invites/accept', { method: 'POST', body: { token } });
              setId(r.trip.id);
              setToken('');
              trips.reload();
              setNotice('Trip membership added.');
            });
          }}
        >
          <label>
            One-time invitation token
            <input
              required
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => field(e, setToken)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Join trip
          </button>
          <p className="op-muted">
            A signed-in account and permission to access this Site are still required.
          </p>
        </form>
      </details>
      {active && <Trip key={active} id={active} onError={setError} />}
    </div>
  );
}

function Trip({ id, onError }) {
  const snapshot = useOperationsResource(`/trips/${id}`, { interval: 3000 }),
    routing = useOperationsResource(`/trips/${id}/route`, { interval: 3000 });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [role, setRole] = useState('supplier'),
    [consent, setConsent] = useState(false),
    [gps, setGps] = useState({ status: 'stopped' }),
    [sharing, setSharing] = useState(false),
    [stopping, setStopping] = useState(false),
    [deleteUnconfirmed, setDeleteUnconfirmed] = useState(false),
    [playing, setPlaying] = useState(false),
    [edge, setEdge] = useState(''),
    [reason, setReason] = useState(''),
    [expiry, setExpiry] = useState(60),
    [sourceUrl, setSourceUrl] = useState(''),
    [inviteRole, setInviteRole] = useState('viewer'),
    [invite, setInvite] = useState(null),
    [clock, setClock] = useState(Date.now());
  const tracker = useRef(null),
    replayBusy = useRef(false),
    mounted = useRef(true);
  const data = snapshot.data,
    trip = data?.trip,
    route = routing.data,
    roleAllowed = data && ['owner', role].includes(data.membershipRole),
    canOperate = data && ['owner', 'supplier'].includes(data.membershipRole);
  const refresh = () => {
    snapshot.reload();
    routing.reload();
  };
  async function mutate(action) {
    setBusy(true);
    setMessage('');
    onError('');
    try {
      await action();
      refresh();
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      tracker.current?.stop();
      tracker.current = null;
    };
  }, []);
  // Replay is opt-in and cannot publish a device-source position.
  async function step() {
    if (replayBusy.current) return;
    replayBusy.current = true;
    try {
      await api(`/trips/${id}/replay`, { method: 'POST', body: { advanceSeconds: 10 } });
      if (mounted.current) refresh();
    } catch (error) {
      if (mounted.current) {
        setPlaying(false);
        onError(error.message);
      }
    } finally {
      replayBusy.current = false;
    }
  }
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(step, 2000);
    return () => clearInterval(t);
  }, [playing, id]);
  async function start() {
    try {
      onError('');
      setDeleteUnconfirmed(false);
      setGps({ status: 'waiting', message: 'Waiting for device permission and a fresh fix…' });
      tracker.current = startDeviceTracking({
        geolocation: navigator.geolocation,
        role,
        publish: (fix) => api(`/trips/${id}/fixes`, { method: 'POST', body: fix }),
        onState: (state) => {
          if (mounted.current) {
            setGps(state);
            if (state.status === 'shared') refresh();
          }
        },
      });
      setSharing(true);
    } catch (error) {
      setSharing(false);
      onError(error.message);
    }
  }
  async function stop() {
    setStopping(true);
    setSharing(false);
    const current = tracker.current;
    tracker.current = null;
    await current?.stop();
    try {
      await api(`/trips/${id}/fixes/${role}`, { method: 'DELETE' });
      setDeleteUnconfirmed(false);
      setMessage('Device watch stopped and retained positions deleted by the server.');
      refresh();
    } catch (error) {
      setDeleteUnconfirmed(true);
      onError(`Tracking stopped on this device. Server deletion is unconfirmed: ${error.message}`);
    } finally {
      setStopping(false);
    }
  }
  if (snapshot.loading)
    return (
      <section className="op-panel" role="status">
        Loading saved trip…
      </section>
    );
  if (!trip)
    return (
      <section className="op-panel op-error" role="alert">
        {snapshot.error || 'Trip unavailable.'}
        <button onClick={snapshot.reload}>Retry</button>
      </section>
    );
  const selected = route?.routes?.find((r) => r.id === route.selectedRouteId) || route?.routes?.[0],
    fixes = data.latestFixes || [],
    age = snapshot.syncedAt ? Math.floor((clock - snapshot.syncedAt) / 1000) : null;
  const routeAge = routing.syncedAt ? Math.floor((clock - routing.syncedAt) / 1000) : null;
  const fresh =
    !snapshot.error &&
    !routing.error &&
    age !== null &&
    age < 10 &&
    routeAge !== null &&
    routeAge < 10;
  return (
    <section className="op-trip">
      <div className="op-section-title">
        <div>
          <span className="op-source">
            {trip.mode === 'replay' ? 'REPRESENTATIONAL REPLAY' : 'PRIVATE OPERATIONAL TRIP'} ·{' '}
            {data.membershipRole}
          </span>
          <h2>{trip.name}</h2>
        </div>
        <span className={`op-sync ${fresh ? '' : 'op-stale'}`}>
          <Radio size={15} />
          {fresh ? `Database synced ${age}s ago` : `Updates delayed · ${age ?? '—'}s since receipt`}
        </span>
      </div>
      {(snapshot.error || routing.error) && (
        <p className="op-error" role="alert">
          {snapshot.error || routing.error} Routes and locations below are last received, not
          current.
        </p>
      )}
      <div className="op-metrics">
        <div>
          <span>Selected road distance</span>
          <strong>
            {selected ? `${(selected.distanceM / 1000).toFixed(2)} km` : 'Unavailable'}
          </strong>
          <small>Endpoint gaps excluded</small>
        </div>
        <div>
          <span>Modelled travel time</span>
          <strong>
            {selected ? `${(selected.durationS / 60).toFixed(1)} min` : 'Unavailable'}
          </strong>
          <small>
            {trip.assumedSpeedKmh} km/h assumption + road caps{!fresh ? ' · delayed data' : ''}
          </small>
        </div>
        <div>
          <span>Available mapped routes</span>
          <strong>{route?.routes?.length ?? '—'}</strong>
          <small>
            {route?.status === 'ok'
              ? 'Current active reports excluded'
              : route?.status || 'Calculating'}
          </small>
        </div>
      </div>
      {route?.positionUse && (
        <p className="op-muted">
          Routing endpoints:{' '}
          {Object.entries(route.positionUse)
            .map(
              ([name, use]) =>
                `${name}: ${use.used ? 'recent device GPS supplied' : 'configured coordinates'} (${use.reason})`,
            )
            .join(' · ')}
          . Travel time excludes the endpoint-to-road gaps.
        </p>
      )}
      <OperationMap
        trip={trip}
        route={route}
        fixes={fixes}
        selectedEdge={edge}
        onSelectEdge={setEdge}
      />
      <div className="op-route-choices" aria-label="Route choices">
        {route?.routes?.map((r, i) => (
          <button
            key={r.id}
            className={r.id === selected?.id ? 'op-selected' : 'quiet'}
            disabled={!canOperate || busy || !fresh}
            onClick={() =>
              mutate(async () => {
                await api(`/trips/${id}/preference`, { method: 'POST', body: { routeId: r.id } });
                setMessage('Route preference saved.');
              })
            }
          >
            <Route size={16} />
            {i ? 'Alternative' : 'Shortest'} · {(r.distanceM / 1000).toFixed(2)} km ·{' '}
            {(r.durationS / 60).toFixed(1)} min{r.id === selected?.id ? ' · selected' : ''}
          </button>
        ))}
      </div>
      {route && route.status !== 'ok' && (
        <p className="op-error" role="status">
          No supported road route: {route.status.replaceAll('_', ' ')}. Check endpoint coordinates,
          current reports and the coverage limit. No straight-line ETA is substituted.
        </p>
      )}
      <div className="op-two">
        <section className="op-panel">
          <h3>
            <Navigation size={18} /> Device location
          </h3>
          <p>
            Only this device’s permission can start its GPS watch. Trip members can see shared
            coordinates for up to 24 hours; the server retains at most 100 fixes per role, with
            deletion available below.
          </p>
          {trip.mode === 'replay' ? (
            <div className="op-replay">
              <strong>Replay — not live GPS</strong>
              <p>
                Each step advances 10 modelled travel seconds. Play runs a step every 2 wall-clock
                seconds; speed is deliberately accelerated.
              </p>
              <button
                className="primary"
                disabled={data.membershipRole !== 'owner'}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Square size={15} /> : <Play size={15} />}{' '}
                {playing ? 'Pause replay' : 'Play replay'}
              </button>
              <button
                className="quiet"
                disabled={data.membershipRole !== 'owner' || playing}
                onClick={step}
              >
                Step 10s
              </button>
            </div>
          ) : (
            <>
              <label>
                This device is sharing as
                <select
                  value={role}
                  disabled={sharing || deleteUnconfirmed || stopping}
                  onChange={(e) => field(e, setRole)}
                >
                  <option value="supplier">Supplier / vehicle</option>
                  <option value="recipient">Recipient / person</option>
                </select>
              </label>
              <label className="op-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={sharing}
                />
                I consent to sharing this device’s location with this trip’s members.
              </label>
              <div className="op-actions">
                <button
                  className="primary"
                  onClick={start}
                  disabled={!consent || sharing || stopping || deleteUnconfirmed || !roleAllowed}
                >
                  <Navigation size={16} /> Share device GPS
                </button>
                <button className="quiet" onClick={stop} disabled={stopping || !roleAllowed}>
                  <Square size={15} />
                  {stopping
                    ? 'Deleting retained positions…'
                    : deleteUnconfirmed
                      ? 'Retry server deletion'
                      : 'Stop & delete positions'}
                </button>
              </div>
              <p className="op-muted" role="status">
                {sharing ? `GPS watch: ${gps.status}. ` : 'GPS watch off. '}
                {gps.message || ''} Leaving this screen stops the watch; use Stop & delete to remove
                retained history.
              </p>
            </>
          )}
          {fixes.map((f) => {
            const s = describeFix(f, clock);
            return (
              <div key={f.role} className="op-position">
                <strong>
                  {f.role} · {s.label}
                </strong>
                <span>
                  {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                  {f.accuracyM === null ? '' : ` · ±${Math.round(f.accuracyM)} m`}
                </span>
                <small>
                  Captured {time(f.capturedAt)} · {Math.round((s.ageMs || 0) / 1000)}s old
                </small>
              </div>
            );
          })}
          {!fixes.length && (
            <p className="op-muted">
              No device or replay position received. Route uses explicitly configured endpoints.
            </p>
          )}
        </section>
        <section className="op-panel">
          <h3>
            <AlertTriangle size={18} /> Report a blocked segment
          </h3>
          <p>
            Select a selected-route segment on the map or from the list. Reports exclude real graph
            edges from the next calculation and expire automatically; physical conditions remain
            unverified.
          </p>
          <form
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate(async () => {
                await api(`/trips/${id}/closures`, {
                  method: 'POST',
                  body: {
                    edgeIds: [edge],
                    reason,
                    expiresInMinutes: Number(expiry),
                    ...(sourceUrl ? { sourceUrl } : {}),
                  },
                });
                setReason('');
                setEdge('');
                setMessage(
                  'Blockage report saved. Routes recalculated with this segment excluded.',
                );
              });
            }}
          >
            <label>
              Mapped segment
              <select
                required
                value={edge}
                onChange={(e) => field(e, setEdge)}
                disabled={!canOperate}
              >
                <option value="">Choose a road segment</option>
                {selected?.edges.map((e, i) => (
                  <option key={`${e.id}-${i}`} value={e.id}>
                    {e.name} · {e.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What was observed?
              <input
                required
                maxLength={500}
                value={reason}
                placeholder={
                  trip.mode === 'replay'
                    ? 'Representational demo blockage'
                    : 'Describe the reported condition'
                }
                onChange={(e) => field(e, setReason)}
                disabled={!canOperate}
              />
            </label>
            <div className="op-two">
              <label>
                Expires after (minutes)
                <input
                  type="number"
                  required
                  min="1"
                  max="1440"
                  value={expiry}
                  onChange={(e) => field(e, setExpiry)}
                />
              </label>
              <label>
                Evidence URL (optional)
                <input
                  type="url"
                  maxLength={1000}
                  value={sourceUrl}
                  onChange={(e) => field(e, setSourceUrl)}
                />
              </label>
            </div>
            <button className="primary" disabled={!canOperate || busy || !edge || !fresh}>
              Save report & reroute
            </button>
          </form>
          {data.closures.map((c) => (
            <div className="op-report" key={c.id}>
              <strong>{c.reason}</strong>
              <p>
                {c.sourceKind} · unverified report · {c.active ? 'active' : 'expired / revoked'}
              </p>
              <small>
                {c.edgeIds.join(', ')} · expires {time(c.expiresAt)}
              </small>
              {c.sourceUrl && (
                <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                  Declared evidence
                </a>
              )}
              {c.active && canOperate && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() =>
                    mutate(() => api(`/trips/${id}/closures/${c.id}`, { method: 'DELETE' }))
                  }
                >
                  Revoke report
                </button>
              )}
            </div>
          ))}
        </section>
      </div>
      {message && (
        <p className="op-success" role="status">
          {message}
        </p>
      )}
      <details className="op-panel">
        <summary>
          <Link size={16} /> Share this trip with another signed-in device
        </summary>
        <p>
          Use another device/account for the recipient. Tokens are single use and expire; they do
          not change this Site’s access policy.
        </p>
        {data.membershipRole === 'owner' ? (
          <>
            <div className="op-actions">
              <label>
                Member role
                <select value={inviteRole} onChange={(e) => field(e, setInviteRole)}>
                  <option value="viewer">Viewer</option>
                  <option value="supplier">Supplier</option>
                  <option value="recipient">Recipient</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  mutate(async () =>
                    setInvite(
                      await api(`/trips/${id}/invites`, {
                        method: 'POST',
                        body: { role: inviteRole, expiresInMinutes: 60 },
                      }),
                    ),
                  )
                }
              >
                Create 1-hour invitation
              </button>
            </div>
            {invite && (
              <div className="op-invite">
                <label>
                  Invitation link (copy and share privately)
                  <input
                    readOnly
                    value={`${location.origin}/#join=${encodeURIComponent(invite.token)}`}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p className="op-muted">
                  {invite.role} · expires {time(invite.expiresAt)}. Token is shown only in this
                  browser session.
                </p>
              </div>
            )}
          </>
        ) : (
          <p>Only the trip owner can create invitations.</p>
        )}
      </details>
      <details className="op-panel">
        <summary>Sources, route reasoning & audit trail</summary>
        <p>
          Supplier: {trip.origin.label} ({trip.origin.provenance}). Destination:{' '}
          {trip.destination.label} ({trip.destination.provenance}).
        </p>
        {route?.positionUse &&
          Object.entries(route.positionUse).map(([r, u]) => (
            <p key={r}>
              <strong>{r} endpoint:</strong>{' '}
              {u.used ? 'Device fix supplied for routing' : 'Configured coordinates used'} ·{' '}
              {u.reason}
            </p>
          ))}
        <ul>
          {route?.warnings?.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p>
          Origin snap gap: {route?.snap?.origin?.distanceM ?? '—'} m. Destination snap gap:{' '}
          {route?.snap?.destination?.distanceM ?? '—'} m.
        </p>
        <p className="op-mono">
          Graph source: {route?.source?.sourceFile || 'Supplied GeoPackage roads_dacope'}
          <br />
          Source SHA-256:{' '}
          {route?.source?.sourceSha256 ||
            '033646cae59e23c55655668323a72bca7219e257d21050b05fa2ca96de2ced65'}
        </p>
        <a href="/data/source-register.json" target="_blank" rel="noreferrer">
          Open dataset source register
        </a>
        <p className="op-muted">
          No marker certifies water as drinkable. Coordinates reported by a browser are not
          tamper-proof attestation. A field operator must verify vehicle access and water supply
          before dispatch.
        </p>
        <div className="op-audit">
          {data.events.slice(0, 20).map((e) => (
            <p key={e.id}>
              <time>{time(e.createdAt)}</time> · {e.type}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
