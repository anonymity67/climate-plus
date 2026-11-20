import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Droplet, Languages, ArrowLeft } from 'lucide-react';
import { useWaterQuery } from './use-water-query.mjs';
import { State } from './shared.jsx';
import { Field, Home, TaskLink, WaterCare, taskLink } from './Home.jsx';
import './water-platform.css';
import './story.css';

const SourceFinder = lazy(() =>
  import('./SourceFinder.jsx').then((m) => ({ default: m.SourceFinder })),
);
const RiverExplorer = lazy(() =>
  import('./RiverExplorer.jsx').then((m) => ({ default: m.RiverExplorer })),
);
const HarvestPlanner = lazy(() =>
  import('./HarvestPlanner.jsx').then((m) => ({ default: m.HarvestPlanner })),
);
const HubPlanner = lazy(() => import('./HubPlanner.jsx').then((m) => ({ default: m.HubPlanner })));
const RiverWatchAtlas = lazy(() =>
  import('./RiverWatchAtlas.jsx').then((m) => ({ default: m.RiverWatchAtlas })),
);
const OutageDrill = lazy(() =>
  import('./OutageDrill.jsx').then((m) => ({ default: m.OutageDrill })),
);
const EvidenceGuide = lazy(() =>
  import('./EvidenceGuide.jsx').then((m) => ({ default: m.EvidenceGuide })),
);
const MyRecords = lazy(() => import('./MyRecords.jsx').then((m) => ({ default: m.MyRecords })));
const ResponseMap = lazy(() => import('../mvp/MapMVP.jsx').then((m) => ({ default: m.MapMVP })));

const labels = {
  home: ['Home', 'প্রথম পাতা'],
  water: ['Find water', 'পানির উৎস'],
  care: ['Water safety', 'পানি যাচাই'],
  supply: ['Rainwater', 'বৃষ্টির পানি'],
  field: ['Field teams', 'মাঠকর্মী'],
  rivers: ['River map', 'নদীর মানচিত্র'],
  samples: ['River samples', 'নদীর নমুনা'],
  hubs: ['Shared rain tanks', 'যৌথ পানির ট্যাংক'],
  sources: ['River map', 'নদীর মানচিত্র'],
  drill: ['Outage drill', 'পানি সরবরাহের মহড়া'],
  records: ['Field records', 'মাঠের নথি'],
  evidence: ['Data sources', 'তথ্যসূত্র'],
  response: ['Response practice', 'সরবরাহের মহড়া'],
};
const navigation = ['supply', 'hubs', 'water', 'field'];
const navLabels = { hubs: ['Shared tanks', 'যৌথ ট্যাংক'], water: ['Find water', 'পানির উৎস'] };

function validView(view) {
  return Object.hasOwn(labels, view) ? view : 'home';
}

export function WaterPlatform({ initialView = '', initialBangla = false }) {
  const [view, setView] = useState(validView(initialView));
  const [bn, setBn] = useState(initialBangla);
  const [ready, setReady] = useState(false);
  const [intent, setIntent] = useState(false);
  const [mapContext, setMapContext] = useState({ source: null, site: null });
  const meta = useWaterQuery(['water', 'samples', 'evidence'].includes(view) ? 'meta' : null);
  const session = useWaterQuery(
    ['field', 'water', 'samples', 'records', 'response'].includes(view) ? 'session' : null,
  ).data;
  const authenticated = Boolean(session?.signedIn);
  const index = Number(bn);
  const Content = view === 'response' ? 'div' : 'main';

  function navigate(next, nextBangla = bn, context) {
    if (view === next && bn === nextBangla && !context?.site && !context?.source) return;
    setIntent(true);
    setView(validView(next));
    setBn(nextBangla);
    const url =
      view === next ? new URL(location.href) : new URL(taskLink(next, nextBangla), location.origin);
    if (nextBangla) url.searchParams.set('lang', 'bn');
    else url.searchParams.delete('lang');
    if (context?.site) url.searchParams.set('site', context.site);
    if (context?.source) url.searchParams.set('source', context.source);
    history.pushState({}, '', url);
  }
  function go(next, context = { source: null, site: null }) {
    setMapContext(context);
    navigate(next, bn, context);
  }
  useEffect(() => {
    setReady(true);
    const readContext = () => {
      const p = new URLSearchParams(location.search);
      setMapContext({ source: p.get('source'), site: p.get('site') });
      return p;
    };
    readContext();
    const back = () => {
      const p = readContext();
      setIntent(true);
      setView(validView(p.get('view')));
      setBn(p.get('lang') === 'bn');
    };
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    document.title = view === 'home' ? 'Aquavelle' : labels[view][index] + ' · Aquavelle';
    document.documentElement.lang = bn ? 'bn' : 'en';
    if (intent) {
      window.scrollTo(0, 0);
      document.getElementById('water-main')?.focus({ preventScroll: true });
    }
  }, [view, bn, index, intent]);
  const loading = (
    <p className="water-workspace" id="water-content" tabIndex={-1} aria-busy="true">
      {bn ? 'খুলছে…' : 'Opening tool…'}
    </p>
  );
  const fieldView = !['home', ...navigation].includes(view);
  return (
    <div className="water-platform aquavelle" lang={bn ? 'bn' : 'en'}>
      <a className="water-skip" href="#water-main">
        {bn ? 'সরাসরি মূল অংশে যান' : 'Skip to content'}
      </a>
      <header className="aq-header">
        <div className="aq-shell aq-header-inner">
          <TaskLink view="home" bn={bn} onGo={go} className="aq-brand">
            <span className="aq-logo">
              <Droplet size={22} aria-hidden="true" />
            </span>
            <span>Aquavelle</span>
          </TaskLink>
          <nav aria-label={bn ? 'প্রধান পাতা' : 'Main navigation'} className="aq-nav">
            {navigation.map((id) => (
              <TaskLink
                key={id}
                view={id}
                bn={bn}
                onGo={go}
                current={view === id || (id === 'field' && fieldView && view !== 'hubs')}
              >
                {(navLabels[id] || labels[id])[index]}
              </TaskLink>
            ))}
          </nav>
          <TaskLink view={view} bn={!bn} onGo={() => navigate(view, !bn)} className="aq-language">
            <Languages size={18} aria-hidden="true" />{' '}
            <span lang={bn ? 'en' : 'bn'}>{bn ? 'English' : 'বাংলা'}</span>
          </TaskLink>
        </div>
      </header>
      <Content
        id="water-main"
        tabIndex={-1}
        lang={bn && (fieldView || view === 'hubs') ? 'en' : undefined}
      >
        {view === 'home' && <Home bn={bn} onGo={go} />}
        {view === 'care' && <WaterCare bn={bn} onGo={go} />}
        {view === 'field' && <Field bn={bn} onGo={go} session={session} />}
        {!['home', 'care', 'field'].includes(view) && !ready && loading}
        {ready && (
          <Suspense fallback={loading}>
            {view === 'water' && (
              <State resource={meta} bangla={bn}>
                {meta.data && (
                  <SourceFinder
                    initialSource={mapContext.source}
                    authenticated={authenticated}
                    signIn={session?.signIn}
                    meta={meta.data}
                    bn={bn}
                    useGuide={() => go('care')}
                    onRiver={(id) => go('samples', { site: id })}
                  />
                )}
              </State>
            )}
            {view === 'samples' && (
              <State resource={meta}>
                {meta.data && (
                  <RiverExplorer
                    meta={meta.data}
                    initialSite={mapContext.site}
                    signIn={session?.signIn}
                    authenticated={authenticated}
                    bn={bn}
                    onSource={(id) => go('water', { source: id })}
                  />
                )}
              </State>
            )}
            {view === 'supply' && <HarvestPlanner bn={bn} />}
            {view === 'hubs' && <HubPlanner bn={bn} />}
            {['rivers', 'sources'].includes(view) && (
              <RiverWatchAtlas bn={bn} onSample={(id) => go('samples', { site: id })} />
            )}
            {view === 'drill' && <OutageDrill bn={bn} />}
            {view === 'records' && <MyRecords authenticated={authenticated} session={session} />}
            {view === 'evidence' && (
              <State resource={meta}>{meta.data && <EvidenceGuide meta={meta.data} />}</State>
            )}
            {view === 'response' && (
              <>
                <div className="water-response-return" id="water-content" tabIndex={-1}>
                  <TaskLink view="field" bn={bn} onGo={go}>
                    <ArrowLeft size={17} aria-hidden="true" /> Field team tools
                  </TaskLink>
                  <span>Delivery simulation for training</span>
                </div>
                <ResponseMap signInPath={session?.signIn} />
              </>
            )}
          </Suspense>
        )}
      </Content>
      <footer className="aq-footer">
        <div className="aq-shell aq-footer-inner">
          <span>Aquavelle</span>
          <TaskLink view="evidence" bn={bn} onGo={go}>
            {bn ? 'তথ্যসূত্র ও সীমা' : 'Data sources and limits'}
          </TaskLink>
          <TaskLink view="care" bn={bn} onGo={go}>
            {bn ? 'পানির নিরাপত্তা' : 'Water safety'}
          </TaskLink>
          <span className="aq-map-credit">
            ©{' '}
            <a href="https://www.openstreetmap.org/copyright" rel="license">
              OpenStreetMap
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
