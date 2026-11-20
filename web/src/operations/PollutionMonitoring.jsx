import { bangladeshDate } from '../date-context.mjs';
import React, { useMemo, useState } from 'react';
import { FlaskConical, MapPin, Download, ClipboardCheck, Plus, RefreshCw } from 'lucide-react';
import { api } from './api-client.mjs';
import { useOperationsResource } from './use-operations.mjs';
import { exportOperations } from './LiveOperations.jsx';
import { GISMap } from '../gis/GISMap.jsx';
import { OBJECTIVE_PROFILE } from '../water-engine.mjs';
import './operations.css';
import './pollution-operations.css';

const blank = () => ({
  date: '',
  latitude: '',
  longitude: '',
  location: '',
  river: '',
  ph: '',
  do: '',
  cod: '',
  sourceKind: 'field-entry',
  sourceLabel: '',
  method: '',
  evidenceUrl: '',
});
const names = { ph: 'pH', do: 'Dissolved oxygen', cod: 'Chemical oxygen demand' };
const displayDate = (value) => new Date(value).toLocaleString();
export function PollutionMonitoring({ onOpenLibrary }) {
  const records = useOperationsResource('/observations', { interval: 10000 }),
    investigations = useOperationsResource('/cases', { interval: 10000 });
  const [form, setForm] = useState(blank),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [selectedId, setSelectedId] = useState(''),
    [filter, setFilter] = useState('all'),
    [title, setTitle] = useState(''),
    [note, setNote] = useState('');
  const all = records.data?.observations || [],
    observations = all.filter((o) => filter === 'all' || o.metadata.sourceKind === filter),
    selected = observations.find((o) => o.id === selectedId) || observations[0];
  const points = useMemo(
    () =>
      observations.map((o) => ({
        ...o,
        name: `${o.location || o.river || 'Sample'} · ${o.date} · ${o.metadata.sourceKind} · ${o.screening.failed}/${o.screening.tested} tested objectives outside range; potability unknown`,
        color: o.screening.failed ? '#b15b35' : '#647d85',
      })),
    [records.data, filter],
  );
  function change(key) {
    return (e) => setForm((old) => ({ ...old, [key]: e.target.value }));
  }
  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      records.reload();
      investigations.reload();
      return result;
    } catch (e) {
      setError(
        e.message +
          (e.details
            ? ` · ${Array.isArray(e.details) ? e.details.join('; ') : JSON.stringify(e.details)}`
            : ''),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operations pollution-operations">
      <div className="op-intro">
        <div>
          <h2>A traceable water-quality investigation.</h2>
          <p>
            Store attributed results, see the limits of the evidence, and assign the next
            verification step.
          </p>
        </div>
        <button className="quiet" onClick={onOpenLibrary}>
          <MapPin size={16} /> Historical datasets & GIS
        </button>
      </div>
      <div className="op-notice">
        <FlaskConical size={20} />
        <p>
          Screening covers pH, dissolved oxygen and COD for{' '}
          <strong>inland surface-water fisheries</strong>. It does not measure drinking-water
          safety, identify a polluter, or predict a contamination plume. Entered evidence is not
          independently authenticated.
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
          Records to show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All my observations</option>
            <option value="field-entry">Declared field entries</option>
            <option value="representational">Representational examples</option>
          </select>
        </label>
        <button
          className="quiet"
          onClick={() => {
            records.reload();
            investigations.reload();
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
        <button className="quiet" disabled={busy} onClick={() => run(exportOperations)}>
          <Download size={16} /> Export my evidence
        </button>
        <button className="primary" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Plus size={16} /> Record a measurement
        </button>
      </div>
      {open && (
        <form
          className="op-panel op-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const body = {
                date: form.date,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                units: { do: 'mg/L', cod: 'mg/L' },
                metadata: {
                  sourceKind: form.sourceKind,
                  sourceLabel: form.sourceLabel,
                  ...(form.method ? { method: form.method } : {}),
                  ...(form.evidenceUrl ? { evidenceUrl: form.evidenceUrl } : {}),
                },
              };
              for (const key of ['ph', 'do', 'cod'])
                if (form[key] !== '') body[key] = Number(form[key]);
              for (const key of ['location', 'river']) if (form[key]) body[key] = form[key];
              const response = await api('/observations', { method: 'POST', body });
              setSelectedId(response.observation.id);
              setOpen(false);
              setForm(blank());
              setNotice(
                'Measurement saved with an immutable content hash and server-computed environmental screening.',
              );
            });
          }}
        >
          <h2>Record an attributed observation</h2>
          <p>
            Leave unmeasured parameters empty. Correct a mistake by adding a new attributed record;
            saved observations are immutable.
          </p>
          <div className="op-two">
            <label>
              Evidence type
              <select value={form.sourceKind} onChange={change('sourceKind')}>
                <option value="field-entry">Field entry · declared, not authenticated</option>
                <option value="representational">Representational · demonstration only</option>
              </select>
            </label>
            <label>
              Sample date
              <input
                required
                type="date"
                max={bangladeshDate()}
                value={form.date}
                onChange={change('date')}
              />
            </label>
            <label>
              Location label
              <input maxLength={200} value={form.location} onChange={change('location')} />
            </label>
            <label>
              River / waterbody
              <input maxLength={200} value={form.river} onChange={change('river')} />
            </label>
            <label>
              Latitude
              <input
                required
                type="number"
                min="-90"
                max="90"
                step="any"
                value={form.latitude}
                onChange={change('latitude')}
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                min="-180"
                max="180"
                step="any"
                value={form.longitude}
                onChange={change('longitude')}
              />
            </label>
          </div>
          <div className="pollution-parameters">
            {['ph', 'do', 'cod'].map((k) => (
              <label key={k}>
                {names[k]} ({k === 'ph' ? '0–14' : 'mg/L'})
                <input
                  type="number"
                  min="0"
                  max={k === 'ph' ? 14 : k === 'do' ? 30 : undefined}
                  step="any"
                  value={form[k]}
                  onChange={change(k)}
                />
              </label>
            ))}
          </div>
          <label>
            Source / collector / report reference
            <input
              required
              maxLength={500}
              value={form.sourceLabel}
              onChange={change('sourceLabel')}
              placeholder="Identify who or which published report supplied the result"
            />
          </label>
          <label>
            Collection and analytical method (optional)
            <input maxLength={500} value={form.method} onChange={change('method')} />
          </label>
          <label>
            Evidence URL (optional)
            <input
              type="url"
              maxLength={1000}
              value={form.evidenceUrl}
              onChange={change('evidenceUrl')}
            />
          </label>
          <div className="op-actions">
            <button className="primary" disabled={busy}>
              Validate & save observation
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() =>
                setForm({
                  date: bangladeshDate(),
                  latitude: 22.57,
                  longitude: 89.51,
                  location: 'Dacope example — not a measured site',
                  river: '',
                  ph: 7.1,
                  do: 3.2,
                  cod: 65,
                  sourceKind: 'representational',
                  sourceLabel: 'Invented demonstration values; no field or lab evidence',
                  method: 'Representational example',
                  evidenceUrl: '',
                })
              }
            >
              Load labelled demo values
            </button>
          </div>
        </form>
      )}
      {(records.error || investigations.error) && (
        <p className="op-error" role="alert">
          {records.error || investigations.error} Last received data may be outdated.
        </p>
      )}
      <div className="op-two pollution-workspace">
        <section className="op-panel">
          <div className="op-section-title">
            <h3>
              <MapPin size={18} /> My observation locations
            </h3>
            <span className="op-muted">{observations.length} records</span>
          </div>
          {points.length ? (
            <GISMap
              points={points}
              selectedId={selected?.id}
              onSelect={(p) => setSelectedId(p.id)}
              extentKey={`operational-${filter}`}
              label="Entered sample locations; colours indicate partial environmental screening, not drinking-water safety."
            />
          ) : (
            <div className="op-empty">
              <FlaskConical size={30} />
              <h2>No observations yet.</h2>
              <p>
                Record a measurement with a source reference, or load the explicitly
                representational example.
              </p>
            </div>
          )}
          <p className="op-muted">
            Rust: at least one measured fisheries objective failed. Slate: none of the measured
            subset failed. Both have unknown potability. No affected-area radius is inferred.
          </p>
          <label>
            Inspect a saved record
            <select value={selected?.id || ''} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="" disabled>
                Select an observation
              </option>
              {observations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.date} · {o.location || o.river || o.id.slice(0, 8)} · {o.metadata.sourceKind}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="op-panel">
          {selected ? (
            <>
              <span className="op-source">
                {selected.metadata.sourceKind.toUpperCase()} · POTABILITY UNKNOWN
              </span>
              <h3>{selected.location || selected.river || 'Attributed observation'}</h3>
              <p>
                Sample date {selected.date} · saved {displayDate(selected.createdAt)}
                <br />
                {selected.latitude}, {selected.longitude}
              </p>
              <div className="pollution-screen">
                <strong>
                  {selected.screening.failed} / {selected.screening.tested}
                </strong>
                <span>
                  measured objectives outside fisheries range
                  <br />
                  {selected.screening.excluded.length} of the three parameters unmeasured
                </span>
              </div>
              <p className="op-muted">
                This failure proportion is a transparent partial indicator, not a standard overall
                WQI or drinking-water rating. The full fisheries profile lists 12 parameters.
              </p>
              <div
                className="pollution-table-scroll"
                role="region"
                aria-label="Measured parameters and fisheries objectives; scroll horizontally for all columns"
                tabIndex={0}
              >
                <table className="pollution-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Result</th>
                      <th>Objective</th>
                      <th>Screen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.screening.tests.map((t) => (
                      <tr key={t.key}>
                        <td>{t.name}</td>
                        <td>
                          {t.value} {t.unit}
                        </td>
                        <td>
                          {t.min !== undefined ? `≥ ${t.min}` : ''}
                          {t.min !== undefined && t.max !== undefined ? ' & ' : ''}
                          {t.max !== undefined ? `≤ ${t.max}` : ''}
                        </td>
                        <td>{t.failed ? 'Outside range' : 'Within tested range'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Declared source:</strong> {selected.metadata.sourceLabel}
                <br />
                <strong>Method:</strong> {selected.metadata.method || 'Not supplied'}
              </p>
              {selected.metadata.evidenceUrl && (
                <a href={selected.metadata.evidenceUrl} target="_blank" rel="noreferrer">
                  Open declared evidence
                </a>
              )}
              <details>
                <summary>Content integrity & screening source</summary>
                <p className="op-mono">SHA-256: {selected.contentHash}</p>
                <p>
                  A hash detects content changes; it does not prove sample authenticity. Record
                  status: entered result, not authenticated lab evidence.
                </p>
                <a href={OBJECTIVE_PROFILE.source} target="_blank" rel="noreferrer">
                  Bangladesh ECR 2023 · PDF page 53 / gazette 3061
                </a>
              </details>
              <div className="pollution-next">
                <h3>Next verification step</h3>
                <p>
                  {selected.screening.failed
                    ? 'Arrange confirmatory sampling and review possible upstream pressures. Avoid declaring a source responsible from proximity alone.'
                    : 'Complete the missing parameter panel and sampling plan. Passing this subset does not establish overall ecological status or drinking-water safety.'}
                </p>
                <p>
                  For suspected industrial dumping: record time and location, obtain upstream /
                  discharge / downstream samples with flow and laboratory evidence, and contact the
                  relevant environmental authority. Do not enter a suspected contaminated waterbody.
                </p>
              </div>
              <form
                className="op-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api('/cases', {
                      method: 'POST',
                      body: { observationId: selected.id, title, note: note || undefined },
                    });
                    setTitle('');
                    setNote('');
                    setNotice('Investigation created and linked to this observation.');
                  });
                }}
              >
                <h3>
                  <ClipboardCheck size={18} /> Open a follow-up case
                </h3>
                <label>
                  Case title
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Sampling / mitigation action
                  <textarea
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Create investigation
                </button>
              </form>
            </>
          ) : (
            <p className="op-muted">
              Select or save an observation to inspect measurements and evidence.
            </p>
          )}
        </section>
      </div>
      <section className="op-panel">
        <h2>Investigation register</h2>
        <p className="op-muted">
          “Reviewed” records an operator decision. It is not independent laboratory validation or a
          drinking-water certificate. Status and notes are audited in your private export.
        </p>
        {!investigations.data?.cases.length && <p>No investigations created yet.</p>}
        <div className="pollution-cases">
          {investigations.data?.cases.map((c) => (
            <Case
              key={c.id}
              record={c}
              busy={busy}
              onSave={(status, note, expectedRevision) =>
                run(async () => {
                  const result = await api(`/cases/${c.id}`, {
                    method: 'PATCH',
                    body: { status, note: note.trim() ? note : null, expectedRevision },
                  });
                  setNotice('Investigation update saved with an audit event.');
                  return result;
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
function Case({ record, busy, onSave }) {
  const [status, setStatus] = useState(record.status),
    [note, setNote] = useState(record.note || ''),
    [loadedRevision, setLoadedRevision] = useState(record.revision);
  return (
    <form
      className="pollution-case op-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(status, note, loadedRevision).then((result) => {
          if (result?.case) setLoadedRevision(result.case.revision);
        });
      }}
    >
      <div>
        <strong>{record.title}</strong>
        <p className="op-muted">
          Observation {record.observationId} · updated {displayDate(record.updatedAt)}
        </p>
      </div>
      {record.revision !== loadedRevision && (
        <div className="op-notice">
          <p>A newer version was saved. Your draft is preserved; refresh it before saving.</p>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setStatus(record.status);
              setNote(record.note || '');
              setLoadedRevision(record.revision);
            }}
          >
            Load latest case
          </button>
        </div>
      )}
      <label>
        Investigation stage
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {['new', 'sampling', 'reviewed', 'follow-up', 'closed'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Follow-up note
        <textarea maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="quiet" disabled={busy || record.revision !== loadedRevision}>
        Save case update
      </button>
    </form>
  );
}
