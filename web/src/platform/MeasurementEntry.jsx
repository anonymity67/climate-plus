import React, { useState } from 'react';
import { Save, Upload, X } from 'lucide-react';
import { api } from '../operations/api-client.mjs';
import { bangladeshDate } from '../date-context.mjs';
import { parsePointUpload } from '../mvp/pollution-vectors.mjs';
import { Export, Source } from './shared.jsx';
import { useSessionDraft } from './session-draft.mjs';
export function MeasurementEntry({ onClose, onSaved, authenticated }) {
  const [draft, setDraft] = useSessionDraft('measurement-draft', {
      date: '',
      latitude: '',
      longitude: '',
      location: '',
      river: '',
      ph: '',
      do: '',
      cod: '',
      sourceLabel: '',
      sourceKind: 'field-entry',
      evidenceUrl: '',
    }),
    [queueState, setQueueState] = useSessionDraft('measurement-import', { records: [] }),
    [request, setRequest] = useSessionDraft('measurement-request', { value: null }),
    [state, setState] = useState({ busy: false, error: '', message: '' }),
    [savedId, setSavedId] = useState(null);
  const queue = queueState.records;
  const setQueue = (updater) =>
    setQueueState((s) => ({
      records: typeof updater === 'function' ? updater(s.records) : updater,
    }));
  const update = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedId(null);
    setRequest({ value: null });
  };
  function normalize() {
    const o = {
      date: draft.date,
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
      location: draft.location,
      river: draft.river,
      units: { do: 'mg/L', cod: 'mg/L' },
      metadata: {
        sourceKind: draft.sourceKind,
        sourceLabel: draft.sourceLabel,
        evidenceUrl: draft.evidenceUrl || null,
      },
    };
    for (const k of ['ph', 'do', 'cod']) if (draft[k] !== '') o[k] = Number(draft[k]);
    return o;
  }
  async function submit(e) {
    e.preventDefault();
    if (!authenticated) {
      setState({
        busy: false,
        error: 'Sign in before saving. Your draft stays in this tab.',
        message: '',
      });
      return;
    }
    if (state.busy) return;
    setState({ busy: true, error: '', message: '' });
    try {
      const payload = request.value || { ...normalize(), clientId: crypto.randomUUID() };
      setRequest({ value: payload });
      const r = await api('/observations', { method: 'POST', body: payload });
      onSaved?.(r.observation);
      setSavedId({
        id: r.observation.id,
        title:
          'Verify ' + (r.observation.location || r.observation.river || 'entered water sample'),
        clientId: 'case-' + payload.clientId,
      });
      setState({
        busy: false,
        error: '',
        message:
          'Measurement saved privately with its source and content hash. It has not been independently verified.',
      });
    } catch (e) {
      setState({
        busy: false,
        error: e.message + (Array.isArray(e.details) ? ' ' + e.details.join(' ') : ''),
        message: '',
      });
    }
  }
  async function upload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 1048576) throw Error('Use a file up to 1 MiB and 200 records.');
      const parsed = parsePointUpload(await f.text(), {
        format: f.name.toLowerCase().endsWith('.csv') ? 'csv' : 'geojson',
        sourceKind: 'field-entry',
        bounds: [88, 20, 93, 27],
      });
      setQueue(
        parsed.observations.map((o, i) => ({
          ...o,
          id: 'import-' + i,
          clientId: crypto.randomUUID(),
          saved: false,
        })),
      );
      setState({
        busy: false,
        error: '',
        message:
          parsed.observations.length +
          ' validated records ready. They retain their coordinates; saving does not authenticate a laboratory result.',
      });
    } catch (e) {
      setState({ busy: false, error: e.message, message: '' });
    }
    e.target.value = '';
  }
  async function saveImport() {
    if (!authenticated) {
      setState({
        busy: false,
        error: 'Sign in before saving. Your import stays in this tab.',
        message: '',
      });
      return;
    }
    setState({ busy: true, error: '', message: '' });
    let saved = 0;
    try {
      for (const o of queue.filter((o) => !o.saved)) {
        const result = await api('/observations', { method: 'POST', body: o });
        onSaved?.(result.observation);
        saved++;
        setQueue((all) => all.map((p) => (p.id === o.id ? { ...p, saved: true } : p)));
      }
      setState({
        busy: false,
        error: '',
        message: saved + ' records saved privately. Reopen My records to inspect them.',
      });
    } catch (e) {
      setState({
        busy: false,
        error: `${saved} saved in this attempt. ${e.message} Unacknowledged records remain available to retry.`,
        message: '',
      });
    }
  }
  async function openCase() {
    setState({ busy: true, error: '', message: '' });
    try {
      await api('/cases', {
        method: 'POST',
        body: {
          observationId: savedId.id,
          title: savedId.title,
          clientId: savedId.clientId,
          note: 'Re-sampling and source/method verification requested; this entry does not establish drinking-water safety.',
        },
      });
      setSavedId(null);
      setState({
        busy: false,
        error: '',
        message: 'Follow-up case opened. Track it in My records.',
      });
    } catch (e) {
      setState({ busy: false, error: e.message, message: '' });
    }
  }
  return (
    <section className="water-entry">
      <div className="water-section-title">
        <h2>Add water measurements</h2>
        <button type="button" onClick={onClose} aria-label="Close measurement entry">
          <X size={18} />
        </button>
      </div>
      <p>
        Use actual sample dates, coordinates, units and a report or collector reference. Drafts stay
        in this browser tab. Saved records are private.
      </p>
      <form onSubmit={submit} aria-label="Save a water measurement">
        <div className="water-entry-grid">
          <label>
            Sample date
            <input
              name="date"
              type="date"
              required
              max={bangladeshDate()}
              value={draft.date}
              onChange={(e) => update('date', e.target.value)}
            />
          </label>
          <label>
            River / channel
            <input
              name="river"
              value={draft.river}
              maxLength={200}
              onChange={(e) => update('river', e.target.value)}
            />
          </label>
          <label>
            Location name
            <input
              name="location"
              value={draft.location}
              maxLength={200}
              onChange={(e) => update('location', e.target.value)}
            />
          </label>
          <label>
            Latitude
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              required
              value={draft.latitude}
              onChange={(e) => update('latitude', e.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              required
              value={draft.longitude}
              onChange={(e) => update('longitude', e.target.value)}
            />
          </label>
          <label>
            pH · optional
            <input
              name="ph"
              type="number"
              min="0"
              max="14"
              step="any"
              value={draft.ph}
              onChange={(e) => update('ph', e.target.value)}
            />
          </label>
          <label>
            Dissolved oxygen · mg/L
            <input
              name="do"
              type="number"
              min="0"
              max="30"
              step="any"
              value={draft.do}
              onChange={(e) => update('do', e.target.value)}
            />
          </label>
          <label>
            Chemical oxygen demand · mg/L
            <input
              name="cod"
              type="number"
              min="0"
              step="any"
              value={draft.cod}
              onChange={(e) => update('cod', e.target.value)}
            />
          </label>
          <label>
            Source type
            <select
              name="sourceKind"
              value={draft.sourceKind}
              onChange={(e) => update('sourceKind', e.target.value)}
            >
              <option value="field-entry">Field entry · not independently verified</option>
              <option value="representational">Demonstration values · invented</option>
            </select>
          </label>
          <label>
            Report or collector reference
            <input
              name="sourceLabel"
              required
              maxLength={500}
              value={draft.sourceLabel}
              onChange={(e) => update('sourceLabel', e.target.value)}
            />
          </label>
          <label>
            Evidence link · optional
            <input
              type="url"
              name="evidenceUrl"
              value={draft.evidenceUrl}
              onChange={(e) => update('evidenceUrl', e.target.value)}
            />
          </label>
        </div>
        <p className="water-small">
          Blank chemistry means unmeasured. A complete drinking-water panel requires more than these
          three parameters.
        </p>
        <div className="water-actions">
          <button type="submit" className="water-primary" disabled={state.busy}>
            <Save size={17} />
            {state.busy ? 'Saving…' : 'Save private measurement'}
          </button>
          <Export name="climateplus-measurement-draft.json" data={normalize()}>
            Export draft
          </Export>
        </div>
      </form>
      <details>
        <summary>Import CSV or GeoJSON</summary>
        <p>
          Up to 200 records / 1 MiB. Invalid rows reject the entire file. Preview and export before
          saving; an import uses the original coordinates.
        </p>
        <Source href="/examples/pollution-points-v3.csv">
          Download explicitly labelled demonstration CSV
        </Source>
        <label className="water-file">
          <Upload size={17} />
          Choose data file
          <input type="file" accept=".csv,.geojson,.json" onChange={upload} />
        </label>
        {queue.length > 0 && (
          <>
            <div className="water-table-wrap">
              <table>
                <caption>Validated import preview · {queue.length} records</caption>
                <thead>
                  <tr>
                    <th scope="col">Date / source</th>
                    <th scope="col">Coordinates</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.date}
                        <br />
                        {o.metadata?.sourceLabel}
                        <br />
                        {o.metadata?.sourceKind}
                      </td>
                      <td>
                        {o.latitude}, {o.longitude}
                      </td>
                      <td>{o.saved ? 'Saved privately' : 'Ready to save'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="water-actions">
              <button
                type="button"
                className="water-primary"
                onClick={saveImport}
                disabled={state.busy || queue.every((o) => o.saved)}
              >
                Save unsaved imported records
              </button>
              <Export name="climateplus-import-preview.json" data={queue} />
            </div>
          </>
        )}
      </details>
      {state.error && (
        <p role="alert" className="water-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="water-success">
          {state.message}
        </p>
      )}
      {savedId && (
        <button
          type="button"
          className="water-text-button"
          disabled={state.busy}
          onClick={openCase}
        >
          Open a follow-up case for this saved measurement
        </button>
      )}
    </section>
  );
}
