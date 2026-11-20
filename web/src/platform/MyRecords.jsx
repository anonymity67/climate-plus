import React, { useEffect, useState } from 'react';
import { useWaterQuery } from './use-water-query.mjs';
import { api } from '../operations/api-client.mjs';
import { clearFieldDrafts } from './session-draft.mjs';
import { State, Export, decimal, statusName, download } from './shared.jsx';
export function MyRecords({ authenticated, session }) {
  const checks = useWaterQuery(authenticated ? 'checks' : null),
    [observations, setObservations] = useState([]),
    [cases, setCases] = useState([]),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!authenticated) return;
    const c = new AbortController();
    setError('');
    Promise.all([api('/observations', { signal: c.signal }), api('/cases', { signal: c.signal })])
      .then(([a, b]) => {
        setObservations(a.observations);
        setCases(b.cases);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [refresh, authenticated]);
  async function updateCase(e, c) {
    e.preventDefault();
    setBusy(c.id);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await api('/cases/' + c.id, {
        method: 'PATCH',
        body: {
          expectedRevision: c.revision,
          status: form.get('status'),
          note: form.get('note') || null,
        },
      });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function exportChecks() {
    try {
      download('aquavelle-my-water-checks.json', await api('/water/checks-export'));
    } catch (e) {
      setError(e.message);
    }
  }
  if (!authenticated)
    return (
      <div className="water-workspace">
        <h1 id="water-content" tabIndex={-1}>
          Field records
        </h1>
        <p>
          {session?.signIn
            ? 'Use your field account to open private checks and measurements.'
            : 'Private field records are unavailable on this site.'}
        </p>
        {session?.signIn && (
          <a className="aq-action" href={session.signIn}>
            Sign in
          </a>
        )}
      </div>
    );
  return (
    <div className="water-workspace water-records-page">
      <div className="water-task-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            My records
          </h1>
          <p>
            Keep checks, measurements and follow-up decisions together. Only your signed-in account
            can read these records.
          </p>
        </div>
        <button
          type="button"
          className="water-secondary"
          onClick={() => {
            checks.reload();
            setRefresh((n) => n + 1);
          }}
        >
          Refresh saved records
        </button>
      </div>
      {session?.signOut && (
        <a className="aq-inline" href={session.signOut} onClick={clearFieldDrafts}>
          Sign out
        </a>
      )}
      {(checks.error || error) && (
        <p className="water-error" role="alert">
          {checks.error || error}
        </p>
      )}
      <section>
        <div className="water-section-title">
          <h2>Water-point checks</h2>
          <button type="button" className="water-text-button" onClick={exportChecks}>
            Export complete check history
          </button>
        </div>
        <State resource={checks}>
          {checks.data?.checks.length ? (
            <ul className="water-saved-list">
              {checks.data.checks.map((c) => (
                <li key={c.id}>
                  <strong>{statusName[c.status]}</strong>
                  <span>
                    {c.sourceId} · {c.visitDate}
                  </span>
                  <p>{c.note}</p>
                  <small>{c.meaning}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="water-empty">
              No water-point checks yet. Find a source and choose “Record a check”.
            </p>
          )}
        </State>
      </section>
      <section>
        <h2>Saved measurements</h2>
        {observations.length ? (
          <>
            <div className="water-table-wrap">
              <table>
                <caption>Private entered measurements · original units</caption>
                <thead>
                  <tr>
                    <th scope="col">Date / location</th>
                    <th scope="col">Source</th>
                    <th scope="col">pH</th>
                    <th scope="col">Oxygen mg/L</th>
                    <th scope="col">COD mg/L</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((o) => (
                    <tr key={o.id}>
                      <th scope="row">
                        {o.date}
                        <br />
                        {o.location || o.river || o.id}
                      </th>
                      <td>
                        {o.metadata.sourceLabel}
                        <br />
                        {o.metadata.sourceKind}
                      </td>
                      <td>{decimal(o.ph)}</td>
                      <td>{decimal(o.do)}</td>
                      <td>{decimal(o.cod)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Export name="aquavelle-my-observations.json" data={{ observations }} />
          </>
        ) : (
          <p className="water-empty">
            No saved measurements. Use “Add a measurement” in Check rivers.
          </p>
        )}
      </section>
      <section>
        <h2>Follow-up cases</h2>
        <p>
          Changing a case status records your workflow. It does not certify water safety or
          independently verify a laboratory result.
        </p>
        {cases.length ? (
          cases.map((c) => (
            <form
              key={c.id + ':' + c.revision}
              onSubmit={(e) => updateCase(e, c)}
              className="water-case-form"
            >
              <h3>{c.title}</h3>
              <label>
                Status
                <select name="status" defaultValue={c.status}>
                  {[
                    ['new', 'Needs a check'],
                    ['sampling', 'Sampling planned / under way'],
                    ['reviewed', 'Reviewed by operator'],
                    ['follow-up', 'Follow-up needed'],
                    ['closed', 'Closed in my workflow'],
                  ].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decision or next step
                <textarea name="note" maxLength={4000} rows={3} defaultValue={c.note || ''} />
              </label>
              <button className="water-secondary" type="submit" disabled={busy === c.id}>
                {busy === c.id ? 'Saving…' : 'Save case update'}
              </button>
            </form>
          ))
        ) : (
          <p className="water-empty">Save a measurement, then open a follow-up case.</p>
        )}
      </section>
    </div>
  );
}
