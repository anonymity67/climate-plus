import React from 'react';
const roleName = {
  reserve: 'Reserve',
  supplier: 'Supplier',
  pump: 'Pump',
  pond: 'Pond',
  school: 'School',
  crew: 'Crew base',
};
export function PointDetails({ asset, feature, held }) {
  if (feature) {
    const p = feature.properties,
      xy = feature.geometry.coordinates;
    return (
      <section className="mvp-point-detail">
        <h2>{p.name}</h2>
        <span className="mvp-source-state">{p.sourceKind.replaceAll('-', ' ')}</span>
        <p className="mvp-coordinate">
          {xy[1]}, {xy[0]}
        </p>
        <p className="mvp-help">{p.date ? `Sample date: ${p.date}` : 'Sampling date unknown'}</p>
        {p.screening ? (
          <>
            <dl className="mvp-measurements">
              {p.screening.tests.map((t) => (
                <div key={t.key}>
                  <dt>{t.name}</dt>
                  <dd>
                    {t.value} {t.unit}
                    <span>{t.failed ? 'Outside fisheries range' : 'Within tested range'}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mvp-help">
              {p.screening.failed}/{p.screening.tested} measured fisheries objectives outside range.
              Partial panel; potability unknown.
            </p>
          </>
        ) : (
          <p className="mvp-help">
            Publisher class: <strong>{p.contextClass || 'Unknown'}</strong>. Classification method,
            units and current health implications are unverified.
          </p>
        )}
        <details>
          <summary>Source & meaning</summary>
          <p>{p.sourceLabel}</p>
          <p>
            {p.reason || 'Entered results, not independently authenticated laboratory evidence.'}
          </p>
          {p.recordCount && (
            <p>
              {p.recordCount} historical records at this coordinate; latest valid dated result
              shown.
            </p>
          )}
          {p.sourceHash && <code>SHA-256: {p.sourceHash}</code>}
          {p.sourceUrl && /^https?:\/\//.test(p.sourceUrl) && (
            <a href={p.sourceUrl} target="_blank" rel="noreferrer">
              Open published source
            </a>
          )}
        </details>
      </section>
    );
  }
  if (!asset)
    return <p className="mvp-help">Select a service point or pollution observation on the map.</p>;
  return (
    <section className="mvp-point-detail">
      <h2>{roleName[asset.role] || asset.name}</h2>
      <span className="mvp-source-state">Scenario asset · not a surveyed facility</span>
      <p className="mvp-coordinate">
        {asset.latitude.toFixed(6)}, {asset.longitude.toFixed(6)}
      </p>
      {held && (
        <p className="mvp-small-warning">
          Held as a source in this salinity scenario. This is a fictional condition.
        </p>
      )}
      <p className="mvp-help">{asset.sourceLabel}</p>
      <p className="mvp-help">Water quality and current availability: unknown.</p>
    </section>
  );
}
