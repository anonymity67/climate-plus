import React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

export function DataState({ resource, label }) {
  return resource.error ? (
    <div className="gis-data-state" role="alert">
      <h3>Dataset unavailable</h3>
      <p>{resource.error}</p>
      <button className="secondary" onClick={resource.retry}>
        <RefreshCw size={16} /> Retry dataset
      </button>
    </div>
  ) : (
    <div className="gis-data-state gis-loading" role="status">
      <div className="gis-loading-line" />
      <h3>{label || 'Loading attributed map data…'}</h3>
      <p>Coordinates and source dates are checked before showing records.</p>
    </div>
  );
}
export function SourceLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="gis-source-link">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}
export function saveJSON(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const number = (value, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
