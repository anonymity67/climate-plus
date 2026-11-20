import React, { useState } from 'react';
import { MapPin, Upload, Plus, Save } from 'lucide-react';
import { parsePointUpload } from './pollution-vectors.mjs';
import { bangladeshDate } from '../date-context.mjs';
export const emptyObservationDraft = {
  date: '',
  latitude: '',
  longitude: '',
  ph: '',
  do: '',
  cod: '',
  sourceLabel: '',
  sourceKind: 'field-entry',
};
export function PollutionInput({
  region,
  scenario,
  draft,
  onDraftChange,
  picking,
  onPick,
  onStage,
  pendingCount,
  onSave,
  saving,
  saveStatus,
  authenticated,
  signInPath,
  onClose,
}) {
  const form = draft,
    setForm = onDraftChange;
  const [error, setError] = useState('');
  const change = (key) => (e) => setForm((old) => ({ ...old, [key]: e.target.value }));
  function stage(data) {
    setError('');
    onStage(data);
  }
  function submit(e) {
    e.preventDefault();
    try {
      const properties = {
        date: form.date,
        sourceKind: form.sourceKind,
        sourceLabel: form.sourceLabel,
        units: { do: 'mg/L', cod: 'mg/L' },
      };
      for (const k of ['ph', 'do', 'cod']) if (form[k] !== '') properties[k] = Number(form[k]);
      const data = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(form.longitude), Number(form.latitude)],
            },
            properties,
          },
        ],
      };
      stage(
        parsePointUpload(JSON.stringify(data), {
          format: 'geojson',
          sourceKind: form.sourceKind,
          bounds: region.bounds,
        }),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1048576) throw Error('Use a file up to1 MiB and200 points.');
      const content = await file.text();
      stage(
        parsePointUpload(content, {
          sourceKind: form.sourceKind,
          format: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'geojson',
          bounds: region.bounds,
        }),
      );
    } catch (error) {
      setError(error.message);
    } finally {
      e.target.value = '';
    }
  }
  function demo() {
    const a = scenario.assets.find((a) => a.role === 'reserve');
    setForm({
      date: '2026-10-01',
      latitude: String(a.latitude),
      longitude: String(a.longitude),
      ph: '7.1',
      do: '3.2',
      cod: '65',
      sourceKind: 'representational',
      sourceLabel: `Invented ${region.name} demonstration values; not a field measurement`,
    });
    setError('');
  }
  return (
    <section className="mvp-input">
      <div className="mvp-section-line">
        <h2>Add pollution points</h2>
        <button className="mvp-text-button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mvp-help">
        Preview a measurement on this map, then save it to your private workspace or export it.
        Source coordinates stay unchanged.
      </p>
      {error && (
        <p className="mvp-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Evidence type
          <select value={form.sourceKind} onChange={change('sourceKind')}>
            <option value="field-entry">Field entry · unverified</option>
            <option value="representational">Demonstration values</option>
          </select>
        </label>
        <label>
          Sample date
          <input
            type="date"
            required
            max={bangladeshDate()}
            value={form.date}
            onChange={change('date')}
          />
        </label>
        <div className="mvp-two-fields">
          <label>
            Latitude
            <input
              type="number"
              required
              step="any"
              min="-90"
              max="90"
              value={form.latitude}
              onChange={change('latitude')}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              required
              step="any"
              min="-180"
              max="180"
              value={form.longitude}
              onChange={change('longitude')}
            />
          </label>
        </div>
        <button className="mvp-secondary" type="button" onClick={onPick} aria-pressed={picking}>
          <MapPin size={15} />
          {picking ? 'Click a location on the map' : 'Pick coordinates on map'}
        </button>
        <div className="mvp-three-fields">
          {['ph', 'do', 'cod'].map((k) => (
            <label key={k}>
              {k === 'ph' ? 'pH' : `${k.toUpperCase()} · mg/L`}
              <input
                type="number"
                step="any"
                min="0"
                max={k === 'ph' ? 14 : k === 'do' ? 30 : undefined}
                value={form[k]}
                onChange={change(k)}
              />
            </label>
          ))}
        </div>
        <label>
          Source / report reference
          <input
            required
            maxLength={500}
            value={form.sourceLabel}
            onChange={change('sourceLabel')}
            placeholder="Who or which report supplied these values?"
          />
        </label>
        <p className="mvp-help">
          Leave unmeasured fields empty. This partial fisheries screen does not establish
          drinking-water safety.
        </p>
        <button className="mvp-primary" type="submit">
          <Plus size={16} />
          Place point on map
        </button>
        <button type="button" className="mvp-text-button" onClick={demo}>
          Fill a labelled demo example
        </button>
      </form>
      <details className="mvp-import">
        <summary>
          <Upload size={16} />
          Import CSV / GeoJSON
        </summary>
        <p className="mvp-help">
          Up to200 points,1 MiB. Every row must have coordinates, date, attribution and explicit
          units. The selected evidence type applies unless declared per row.
        </p>
        <label>
          Choose point file
          <input type="file" accept=".csv,.json,.geojson" onChange={upload} />
        </label>
        <code>date,latitude,longitude,ph,do_mg_l,cod_mg_l,source</code>
        <a href="/examples/pollution-points-v3.csv" download>
          Download labelled CSV example
        </a>
      </details>
      {pendingCount > 0 && (
        <div className="mvp-save-line">
          <strong>
            {pendingCount} point{pendingCount === 1 ? '' : 's'} awaiting save
          </strong>
          {authenticated ? (
            <button className="mvp-secondary" disabled={saving} onClick={onSave}>
              <Save size={15} />
              {saving ? 'Saving…' : 'Save points to database'}
            </button>
          ) : (
            <p className="mvp-help">
              You can preview and export your entries.{' '}
              {signInPath && (
                <a href={signInPath} target="_top">
                  Use a field account to save records.
                </a>
              )}
            </p>
          )}
        </div>
      )}
      {saveStatus && (
        <p className="mvp-save-status" role="status">
          {saveStatus}
        </p>
      )}
    </section>
  );
}
