import React from 'react';
import { Download, RefreshCw, ArrowUpRight } from 'lucide-react';
export const count = (n) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n);
export const decimal = (n) =>
  typeof n === 'number' ? n.toLocaleString('en', { maximumFractionDigits: 2 }) : 'Not recorded';
export function State({ resource, children, bangla = false }) {
  return resource.error ? (
    <div className="water-error" role="alert">
      <p>{bangla ? 'তথ্য খুলতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : resource.error}</p>
      <button type="button" onClick={resource.reload}>
        <RefreshCw size={16} />
        {bangla ? 'আবার চেষ্টা করুন' : 'Try again'}
      </button>
    </div>
  ) : resource.loading ? (
    <div className="water-pending" aria-busy="true">
      {bangla ? 'তথ্য খুলছে…' : 'Loading records…'}
    </div>
  ) : (
    children
  );
}
export function Source({ href, children }) {
  return (
    <a className="water-source-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
export function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Export({ name, data, children = 'Export records' }) {
  return (
    <button type="button" className="water-text-button" onClick={() => download(name, data)}>
      <Download size={16} aria-hidden="true" />
      {children}
    </button>
  );
}
export const statusName = {
  'needs-check': 'Needs a check',
  visited: 'Visit recorded',
  unavailable: 'Reported unavailable',
  'could-not-reach': 'Could not reach',
};
