import React, { lazy, Suspense, useState } from 'react';
import { FlaskConical, MapPin, Route, ShieldCheck, Waves } from 'lucide-react';
import { WaterFinder } from './WaterFinder.jsx';
import './water-gis.css';

const PollutionExplorer = lazy(() =>
  import('./PollutionExplorer.jsx').then((module) => ({ default: module.PollutionExplorer })),
);
const DisasterPlanning = lazy(() =>
  import('./DisasterPlanning.jsx').then((module) => ({ default: module.DisasterPlanning })),
);
const WaterCare = lazy(() =>
  import('./WaterCare.jsx').then((module) => ({ default: module.WaterCare })),
);
const PollutionPanel = lazy(() =>
  import('../PollutionPanel.jsx').then((module) => ({ default: module.PollutionPanel })),
);

const sections = [
  ['water', 'Find water', 'পানির উৎস', MapPin],
  ['pollution', 'River pollution', 'নদীর দূষণ', Waves],
  ['planning', 'Disaster planning', 'দুর্যোগ পরিকল্পনা', Route],
  ['care', 'Water care', 'পানির যত্ন', ShieldCheck],
  ['evidence', 'Evidence tools', 'বিশ্লেষণ', FlaskConical],
];
class GISBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="gis-data-state" role="alert">
        <h2>The GIS data could not be read.</h2>
        <p>
          Reload the application. For a local build, run npm run verify:data and check that the
          dataset files match this version.
        </p>
        <button className="secondary" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function WaterGISWorkspace({ onPlan }) {
  const [section, setSection] = useState('water'),
    [bn, setBn] = useState(false),
    [evidenceMode, setEvidenceMode] = useState('trace');
  function openEvidence(mode) {
    setEvidenceMode(mode);
    setSection('evidence');
  }
  return (
    <GISBoundary>
      <div className={'water-gis-workspace ' + (bn ? 'gis-bangla' : '')}>
        <div className="gis-navigation-line">
          <nav className="gis-task-navigation" aria-label="Water and GIS tasks">
            {sections.map(([id, en, bengali, Icon]) => (
              <button
                key={id}
                className={section === id ? 'selected' : ''}
                aria-current={section === id ? 'page' : undefined}
                onClick={() => setSection(id)}
              >
                <Icon size={17} />
                <span>{bn ? bengali : en}</span>
              </button>
            ))}
          </nav>
          <button
            className="secondary gis-language"
            onClick={() => setBn((value) => !value)}
            lang={bn ? 'en' : 'bn'}
          >
            {bn ? 'English' : 'বাংলা'}
          </button>
        </div>
        <div className="gis-workspace-content">
          <Suspense
            fallback={
              <div className="gis-data-state" role="status">
                Loading this water and GIS task…
              </div>
            }
          >
            {section === 'water' ? (
              <WaterFinder bn={bn} onCare={() => setSection('care')} />
            ) : section === 'pollution' ? (
              <PollutionExplorer bn={bn} onEvidence={openEvidence} />
            ) : section === 'planning' ? (
              <DisasterPlanning bn={bn} onPlan={onPlan} />
            ) : section === 'care' ? (
              <WaterCare bn={bn} onFind={() => setSection('water')} />
            ) : (
              <>
                <div className="gis-evidence-intro">
                  <h2>Inspect the science behind the map.</h2>
                  <p>
                    Advanced workflows: measured source-mixing diagnostics, chronological DO-model
                    validation and explicit-unit observation import. No output certifies potability
                    or identifies an emitter.
                  </p>
                </div>
                <PollutionPanel key={evidenceMode} initialMode={evidenceMode} />
              </>
            )}
          </Suspense>
        </div>
      </div>
    </GISBoundary>
  );
}
