import React, { useState } from 'react';
import { ContinuityMap } from './components/ContinuityMap.jsx';
import {
  CONDITIONS,
  HAZARDS,
  STATUS_COLOR,
  accessRows,
  effectiveCondition,
  hazardSummary,
  routeCaption,
  statusLabel,
} from './gis-network.mjs';

const HAZARD_LABEL = { storm: 'Storm', salinity: 'Salinity' };
const CONDITION_LABEL = { clear: 'Clear', moderate: 'Moderate storm', severe: 'Severe storm' };

function Detail({ gis, geo, selectedId, rows }) {
  if (!selectedId)
    return <p className="cm-hint">Select a node or catchment on the map or table.</p>;
  const node = gis.nodes.find((n) => n.id === selectedId);
  if (node) {
    const row = rows.find((r) => r.id === node.id);
    return (
      <div className="cm-detail">
        <strong>{node.name}</strong>
        <span>Type: {node.type} · synthetic</span>
        {node.capacityL != null && <span>Storage: {node.capacityL.toLocaleString('en-US')} L</span>}
        {node.priority != null && <span>Priority {node.priority}</span>}
        <span>Inside salinity area: {node.exposedSalinity ? 'yes' : 'no'}</span>
        <span>Inside storm area: {node.exposedStorm ? 'yes' : 'no'}</span>
        {row && (
          <span>
            From supplier: {(row.distanceM / 1000).toFixed(1)} km, {row.minutes.toFixed(1)} min ·{' '}
            {statusLabel(row.status)}
          </span>
        )}
      </div>
    );
  }
  const c = gis.catchments.find((x) => x.id === selectedId);
  if (!c) return null;
  return (
    <div className="cm-detail">
      <strong>{c.name}</strong>
      <span>Demand: {c.demandLDay.toLocaleString('en-US')} L/day</span>
      <span>Households: {c.households}</span>
      <span>Synthetic catchment</span>
    </div>
  );
}

export function CalamityPanel({ gis, geo, scenario, hazard, setHazard, condition, setCondition }) {
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  if (!gis || !geo) return <div className="panel">Loading the GIS layer…</div>;
  const cond = effectiveCondition(hazard, condition);
  const rows = accessRows(gis, cond);
  return (
    <div className="panel map-panel">
      <div className="panel-head">
        <div>
          <h2>Calamity map</h2>
          <span>Dacope · fictional network on real roads</span>
        </div>
        <button type="button" className="quiet" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy link to this view'}
        </button>
      </div>
      <div className="continuity-map">
        <div className="cm-controls" role="group" aria-label="Calamity type">
          {HAZARDS.map((h) => (
            <button
              key={h}
              type="button"
              className={h === hazard && scenario !== 'dry' ? 'active' : ''}
              aria-pressed={h === hazard && scenario !== 'dry'}
              onClick={() => setHazard(h)}
            >
              {HAZARD_LABEL[h]}
            </button>
          ))}
        </div>
        {scenario === 'dry' && (
          <p className="cm-hint">
            Seasonal dry-period stress has no hazard area. Pick Storm or Salinity to see one.
          </p>
        )}
        {hazard === 'storm' && scenario !== 'dry' && (
          <div className="cm-controls" role="group" aria-label="Storm severity">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={c === condition ? 'active' : ''}
                aria-pressed={c === condition}
                onClick={() => setCondition(c)}
              >
                {CONDITION_LABEL[c]}
              </button>
            ))}
          </div>
        )}
        <div className="cm-grid">
          <ContinuityMap
            gis={gis}
            geo={geo}
            hazard={hazard}
            condition={condition}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="cm-side">
            <Detail gis={gis} geo={geo} selectedId={selectedId} rows={rows} />
            <table className="cm-table">
              <caption>Access from supplier</caption>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>km</th>
                  <th>min</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={r.id === selectedId ? 'on' : ''}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td>
                      <button type="button" className="cm-link" onClick={() => setSelectedId(r.id)}>
                        {r.name}
                      </button>
                    </td>
                    <td>{(r.distanceM / 1000).toFixed(1)}</td>
                    <td>{r.minutes.toFixed(1)}</td>
                    <td style={{ color: STATUS_COLOR[r.status] }}>{statusLabel(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="cm-caption">
          <strong>{hazardSummary(gis, hazard, condition)}</strong>
          <br />
          {routeCaption(gis, cond)}
        </p>
        <div className="legend">
          <span>
            <i className="dot green" />
            Open
          </span>
          <span>
            <i className="dot amber" />
            Delayed
          </span>
          <span>
            <i className="dot red" />
            Extreme delay
          </span>
          <span>
            Fictional network on real Dacope roads · hazard areas are scenario assumptions
          </span>
        </div>
      </div>
    </div>
  );
}
