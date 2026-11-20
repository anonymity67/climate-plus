import React from 'react';

// "Outage drill": the District WASH Operations Playbook (static page in public/playbook/) inside the app.

const templates = [
  ['01-asset-registry', 'Asset registry'],
  ['05-incident-and-repair', 'Incident and repair'],
  ['07-dispatch-and-receipt', 'Dispatch and receipt'],
  ['08-fallback-and-handover', 'Fallback and handover'],
];

export function OutageDrill({ bn }) {
  return (
    <div className="water-workspace hub-planner">
      <div className="water-task-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {bn ? 'বিভ্রাট মহড়া' : 'Run an outage drill'}
          </h1>
          <p>Practise what your team does when a pump fails and people need water today.</p>
        </div>
        <a
          className="water-secondary"
          href="/playbook/WASH-Operations-Playbook.html"
          target="_blank"
          rel="noopener"
        >
          Open full screen
        </a>
      </div>
      <div className="drill-brief">
        <p>
          <strong>The scenario:</strong> a pump fails, a bridge closes and three schools run low.
          Your team moves one incident from report to repair, tanker delivery and handover, with one
          map and one stock record.
        </p>
        <p>
          <strong>At the end you will know:</strong> how many households got water, how much went to
          schools, and what is still unaccounted for.
        </p>
      </div>
      <iframe
        className="drill-frame"
        src="/playbook/WASH-Operations-Playbook.html"
        title="District WASH operations playbook and tabletop exercise"
      />
      <section>
        <h2 className="water-section-title">Field forms to use after the drill</h2>
        <ul className="drill-forms">
          {templates.map(([f, label]) => (
            <li key={f}>
              <a href={'/playbook/wash-field-templates/' + f + '.csv'} download>
                {label} (CSV)
              </a>
            </li>
          ))}
        </ul>
        <p className="hub-small">
          All 12 forms are listed inside the playbook. The drill’s map, stock and people are made up
          for practice.
        </p>
      </section>
    </div>
  );
}
