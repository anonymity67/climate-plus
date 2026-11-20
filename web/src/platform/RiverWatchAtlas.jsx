import React, { useMemo, useRef, useState } from 'react';
import { Brief } from './brief.jsx';
import { ArrowLeft, ArrowRight, ArrowUpRight, FlaskConical, MapPin, Search } from 'lucide-react';
import { useMapData } from '../mvp/use-map-data.mjs';
import { useWaterQuery } from './use-water-query.mjs';
import { TaskLink } from './Home.jsx';
import { State } from './shared.jsx';
import { atlasDistricts, atlasMatches, samplesNearTrace } from './riverwatch-model.mjs';
import { RiverWatchMap } from './RiverWatchMap.jsx';
import { RiverWatchEvidence, siteKind } from './RiverWatchEvidence.jsx';
import { atlasPlace } from './atlas-place-names.mjs';
import './riverwatch-atlas.css';

const root = '/data/riverwatch/';
const empty = [];
const defaults = { district: '', category: '', query: '', priority: false };
const perPage = 12;

function saveLocation(run, site) {
  const url = new URL(location.href);
  if (run === 'dhaka_pilot') url.searchParams.set('run', run);
  else url.searchParams.delete('run');
  if (site) url.searchParams.set('lead', site);
  else url.searchParams.delete('lead');
  history.replaceState(history.state, '', url);
}

export function RiverWatchAtlas({ bn, onSample }) {
  const t = (en, bangla) => (bn ? bangla : en);
  const n = (v) => v.toLocaleString(bn ? 'bn-BD' : 'en');
  const [run, setRun] = useState(() =>
    new URLSearchParams(location.search).get('run') === 'dhaka_pilot' ? 'dhaka_pilot' : 'national',
  );
  const [lead, setLead] = useState(() => new URLSearchParams(location.search).get('lead'));
  const [filter, setFilter] = useState(defaults);
  const [page, setPage] = useState(0);
  const [showZone, setShowZone] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const panel = useRef(null);

  const base = useMapData(root + 'bangladesh.json');
  const catalogue = useMapData(root + run + '.json');
  const sites = catalogue.data?.sites || empty;
  const byDistrict = useMemo(() => atlasDistricts(sites), [sites]);
  const filtered = useMemo(() => atlasMatches(sites, filter), [sites, filter]);
  const selection = sites.find((site) => site.id === lead);
  const record = useMapData(selection ? root + run + '/' + selection.group + '.json' : null);
  const policy = catalogue.data;
  const detail = record.data?.[selection?.id];
  const samples = useWaterQuery(showSamples || detail?.trace.length ? 'sites' : null);
  const comparison = useMapData(
    root + 'dhaka_pilot.json',
    run === 'national' && selection?.division === 'Dhaka',
  );
  const pilotSite = comparison.data?.sites.find((site) => site.id === selection?.id);
  const nearby = useMemo(
    () => samplesNearTrace(detail?.trace || empty, samples.data?.sites || empty),
    [detail, samples.data],
  );
  const categories =
    run === 'dhaka_pilot'
      ? ['industrial', 'landfill', 'wastewater', 'reference']
      : ['industrial', 'landfill', 'wastewater'];

  function chooseSite(site) {
    setLead(site?.id || null);
    setShowZone(false);
    saveLocation(run, site?.id);
    if (site) panel.current?.focus({ preventScroll: true });
  }
  function chooseRun(next, site = null) {
    setRun(next);
    setLead(site);
    setFilter(defaults);
    setPage(0);
    setShowZone(false);
    saveLocation(next, site);
  }
  function change(key, value) {
    setFilter((all) => ({ ...all, [key]: value }));
    setPage(0);
    chooseSite(null);
  }
  return (
    <div className="water-workspace rw-atlas" lang={bn ? 'bn' : 'en'}>
      <header className="rw-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {t('Rivers and pollution', 'নদী ও দূষণ')}
          </h1>
          <Brief
            bn={bn}
            problem={[
              'Factories, dumps and sewage beside a river make the water unsafe downstream.',
              'নদীর পাশের কারখানা, ময়লার স্তূপ ও পয়োবর্জ্য ভাটির পানি অনিরাপদ করে।',
            ]}
            purpose={['Find which sites to check first.', 'কোন স্থান আগে যাচাই করবেন, খুঁজে নিন।']}
            steps={[
              ['Pick a district or search a river', 'জেলা বাছুন বা নদীর নাম লিখুন'],
              ['Tap a site', 'একটি স্থানে চাপুন'],
              ['See who lives downstream', 'ভাটিতে কারা থাকেন দেখুন'],
            ]}
            result={[
              '4,898 mapped sites, each a lead to check on the ground.',
              '৪,৮৯৮টি চিহ্নিত স্থান, প্রতিটি মাঠে যাচাইয়ের সূত্র।',
            ]}
          />
        </div>
        <TaskLink view="samples" bn={bn} className="aq-inline">
          <FlaskConical size={17} aria-hidden="true" />
          {t('Read river measurements', 'নদীর পরিমাপ দেখুন')}
        </TaskLink>
      </header>

      <section className="rw-workbench" aria-label={t('RiverWatch atlas', 'রিভারওয়াচ মানচিত্র')}>
        <div className="rw-toolbar">
          <div
            className="rw-run"
            role="group"
            aria-label={t('Choose a RiverWatch dataset', 'রিভারওয়াচের তথ্য বেছে নিন')}
          >
            <button
              type="button"
              aria-pressed={run === 'national'}
              onClick={() => chooseRun('national')}
            >
              {t('Bangladesh overview', 'সারা বাংলাদেশ')}
            </button>
            <button
              type="button"
              aria-pressed={run === 'dhaka_pilot'}
              onClick={() => chooseRun('dhaka_pilot')}
            >
              {t('Dhaka satellite pilot', 'ঢাকার স্যাটেলাইট গবেষণা')}
            </button>
          </div>
          {policy && (
            <p>
              {run === 'national'
                ? t(
                    n(policy.summary.mapped) + ' mapped sites · November 2026 snapshot',
                    n(policy.summary.mapped) + ' নথিভুক্ত স্থান · নভেম্বর ২০২৬',
                  )
                : t(
                    n(policy.summary.mapped) +
                      ' sites + ' +
                      n(policy.summary.references) +
                      ' reference reaches · 2025–26 dry season',
                    n(policy.summary.mapped) +
                      ' স্থান ও ' +
                      n(policy.summary.references) +
                      ' তুলনার নদী অংশ · শুষ্ক মৌসুম ২০২৫–২৬',
                  )}
            </p>
          )}
        </div>
        <State resource={{ ...catalogue, reload: catalogue.retry }} bangla={bn}>
          {policy && (
            <>
              <div className="rw-filters">
                <div>
                  <label htmlFor="rw-district">{t('District', 'জেলা')}</label>
                  <select
                    id="rw-district"
                    value={filter.district}
                    onChange={(e) => change('district', e.target.value)}
                  >
                    <option value="">{t('All districts', 'সব জেলা')}</option>
                    {byDistrict.map(([district, division]) => (
                      <option key={district} value={district}>
                        {atlasPlace(district, bn)}
                        {division && division !== district ? ' · ' + atlasPlace(division, bn) : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rw-kind">{t('Site type', 'স্থানের ধরন')}</label>
                  <select
                    id="rw-kind"
                    value={filter.category}
                    onChange={(e) => change('category', e.target.value)}
                  >
                    <option value="">{t('All types', 'সব ধরন')}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {siteKind({ category }, bn)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rw-find">
                    {t('Find a site or river', 'স্থান বা নদী খুঁজুন')}
                  </label>
                  <span className="rw-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id="rw-find"
                      type="search"
                      value={filter.query}
                      maxLength={100}
                      onChange={(e) => change('query', e.target.value)}
                      placeholder={t(
                        'Name as mapped, e.g. Buriganga',
                        'মানচিত্রে থাকা নাম, যেমন Buriganga',
                      )}
                    />
                  </span>
                </div>
              </div>
              <div className="rw-layers">
                <label className="rw-check">
                  <input
                    type="checkbox"
                    checked={filter.priority}
                    onChange={(e) => change('priority', e.target.checked)}
                  />
                  {t('Priority leads only', 'শুধু অগ্রাধিকারপ্রাপ্ত স্থান')}
                </label>
                <label className="rw-check">
                  <input
                    type="checkbox"
                    checked={showSamples}
                    onChange={(e) => setShowSamples(e.target.checked)}
                  />
                  {t('Show historical river samples', 'নদীর পুরোনো নমুনা দেখুন')}
                </label>
              </div>
              <div className="rw-body">
                <div className="rw-map-area">
                  {base.error && (
                    <div className="rw-map-alert">
                      <p>
                        {t(
                          'The map outline could not load. The site list is still available.',
                          'মানচিত্রের সীমানা খুলতে সমস্যা হয়েছে। স্থানের তালিকা দেখা যাবে।',
                        )}
                      </p>
                      <button type="button" onClick={base.retry}>
                        {t('Retry map', 'আবার চেষ্টা করুন')}
                      </button>
                    </div>
                  )}
                  <RiverWatchMap
                    base={base.data}
                    sites={filtered}
                    selection={selection}
                    detail={detail}
                    samples={showSamples ? samples.data?.sites || empty : empty}
                    district={filter.district}
                    run={run}
                    onPick={chooseSite}
                    onSample={onSample}
                    showZone={showZone}
                    bn={bn}
                  />
                  <div className="rw-map-key" aria-label={t('Map legend', 'মানচিত্রের চিহ্ন')}>
                    <span>
                      <i className="rw-dot" />
                      {t('Mapped site', 'নথিভুক্ত স্থান')}
                    </span>
                    <span>
                      <i className="rw-dot priority" />
                      {t('Priority lead', 'অগ্রাধিকারপ্রাপ্ত স্থান')}
                    </span>
                    {run === 'dhaka_pilot' && (
                      <span>
                        <i className="rw-dot reference" />
                        {t('Reference', 'তুলনার স্থান')}
                      </span>
                    )}
                    {detail?.trace.length > 0 && (
                      <span>
                        <i className="rw-dashed" />
                        {t('Modelled downstream trace', 'মডেলের ভাটির রেখা')}
                      </span>
                    )}
                    {showSamples && (
                      <span>
                        <i className="rw-dot measured" />
                        {t('Historical sample', 'পুরোনো নমুনা')}
                      </span>
                    )}
                  </div>
                  {showSamples && samples.error && (
                    <div className="rw-map-alert">
                      <p>{t('River samples could not load.', 'নদীর নমুনা খুলতে সমস্যা হয়েছে।')}</p>
                      <button type="button" onClick={samples.reload}>
                        {t('Retry samples', 'আবার চেষ্টা করুন')}
                      </button>
                    </div>
                  )}
                </div>
                <aside
                  ref={panel}
                  tabIndex={-1}
                  className="rw-panel"
                  aria-label={t('Sites and evidence', 'স্থান ও প্রমাণ')}
                >
                  {selection ? (
                    <>
                      {record.loading && (
                        <p className="rw-panel-pad" role="status">
                          {t('Opening site evidence…', 'স্থানের তথ্য খুলছে…')}
                        </p>
                      )}
                      {record.error && (
                        <div className="rw-panel-pad">
                          <p role="alert">
                            {t(
                              'The site evidence could not load.',
                              'স্থানের তথ্য খুলতে সমস্যা হয়েছে।',
                            )}
                          </p>
                          <button onClick={record.retry} type="button">
                            {t('Retry', 'আবার চেষ্টা করুন')}
                          </button>
                          <button onClick={() => chooseSite(null)} type="button">
                            {t('Back to results', 'ফলাফলে ফিরে যান')}
                          </button>
                        </div>
                      )}
                      <RiverWatchEvidence
                        site={selection}
                        detail={detail}
                        run={{ id: run, minPairs: policy.minPairs }}
                        nearby={nearby}
                        showZone={showZone}
                        onZone={setShowZone}
                        onBack={() => chooseSite(null)}
                        onSample={onSample}
                        bn={bn}
                      />
                      {pilotSite && (
                        <div className="rw-panel-pad rw-pilot-link">
                          <button
                            type="button"
                            onClick={() => chooseRun('dhaka_pilot', pilotSite.id)}
                          >
                            {t(
                              'Open this site in the Dhaka pilot',
                              'ঢাকার গবেষণায় এই স্থানটি খুলুন',
                            )}{' '}
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="rw-panel-pad">
                        <h2 aria-live="polite">
                          {n(filtered.length)} {t('places to explore', 'টি স্থান')}
                        </h2>
                        <p>
                          {t(
                            'Open a place on the list or map to inspect its river link.',
                            'নদীর সংযোগ দেখতে তালিকা বা মানচিত্রের কোনো স্থান খুলুন।',
                          )}
                        </p>
                      </div>
                      {filtered.length === 0 ? (
                        <div className="rw-panel-pad">
                          <p>
                            {t(
                              'Try another district or clear the filters.',
                              'অন্য জেলা বেছে নিন বা ফিল্টার মুছুন।',
                            )}
                          </p>
                          <button type="button" onClick={() => setFilter(defaults)}>
                            {t('Clear filters', 'ফিল্টার মুছুন')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <ul className="rw-result-list">
                            {filtered.slice(page * perPage, (page + 1) * perPage).map((site) => (
                              <li key={site.id}>
                                <button type="button" onClick={() => chooseSite(site)}>
                                  <i
                                    className={
                                      'rw-dot' +
                                      (site.priority
                                        ? ' priority'
                                        : site.reference
                                          ? ' reference'
                                          : '')
                                    }
                                  />
                                  <span>
                                    <strong lang="en">{site.name}</strong>
                                    <small>
                                      {siteKind(site, bn)}
                                      {site.district && (
                                        <>
                                          {' '}
                                          · <span>{atlasPlace(site.district, bn)}</span>
                                        </>
                                      )}
                                    </small>
                                  </span>
                                  <ArrowRight size={16} aria-hidden="true" />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className="rw-pages">
                            <button
                              type="button"
                              disabled={page === 0}
                              onClick={() => setPage(page - 1)}
                              aria-label={t('Previous results', 'আগের ফলাফল')}
                            >
                              <ArrowLeft size={17} aria-hidden="true" />
                            </button>
                            <span>
                              {n(page * perPage + 1)}–
                              {n(Math.min((page + 1) * perPage, filtered.length))}
                            </span>
                            <button
                              type="button"
                              disabled={(page + 1) * perPage >= filtered.length}
                              onClick={() => setPage(page + 1)}
                              aria-label={t('Next results', 'পরের ফলাফল')}
                            >
                              <ArrowRight size={17} aria-hidden="true" />
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </aside>
              </div>
            </>
          )}
        </State>
      </section>
      <div className="rw-foot">
        <p>
          <MapPin size={17} aria-hidden="true" />
          {t(
            'Map tags and estimated river links help plan field checks. Confirm site activity and flow before drawing conclusions.',
            'মানচিত্রের তথ্য ও আনুমানিক নদী সংযোগ মাঠের যাচাইয়ে সহায়তা করে। সিদ্ধান্তের আগে স্থানের কাজ ও প্রবাহ যাচাই করুন।',
          )}
        </p>
        {policy && (
          <details>
            <summary>{t('Sources, coverage and limits', 'তথ্যের উৎস ও সীমা')}</summary>
            <ul>
              <li>
                {n(policy.summary.linked)}{' '}
                {t(
                  'linked locations including reference reaches,',
                  'টি নদীর সঙ্গে যুক্ত স্থান (তুলনার অংশসহ),',
                )}{' '}
                {n(policy.summary.priority)} {t('priority leads.', 'টি অগ্রাধিকারপ্রাপ্ত স্থান।')}{' '}
                {t(
                  'Some traces stop at a gap or unresolved flow direction.',
                  'কিছু রেখা ফাঁক বা প্রবাহের অনিশ্চয়তায় থেমেছে।',
                )}
              </li>
              <li>
                {n(policy.qa.valid_paired_dates)}{' '}
                {t(
                  'usable satellite date pairs across this run.',
                  'টি ব্যবহারযোগ্য স্যাটেলাইট জোড়া পাঠ।',
                )}{' '}
                {n(policy.ranked)}{' '}
                {t(
                  'sites have a complete review ranking.',
                  'টি স্থানের পূর্ণ পর্যালোচনা ক্রম আছে।',
                )}
              </li>
              <li>
                {n(Math.round(policy.union.pop_near))}{' '}
                {t(
                  'estimated residents across the combined proximity areas. Overlap is counted once.',
                  'আনুমানিক বাসিন্দা সব নৈকট্য এলাকায়। ওভারল্যাপ একবার ধরা হয়েছে।',
                )}{' '}
                {!policy.union.pop_coverage_complete &&
                  t('Population coverage is incomplete.', 'জনসংখ্যার তথ্য অসম্পূর্ণ।')}
              </li>
            </ul>
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ·{' '}
            <a href="https://www.hydrosheds.org/products/hydrorivers">HydroRIVERS</a> ·{' '}
            <a href="https://www.worldpop.org/">WorldPop</a> ·{' '}
            <a href="https://www.geoboundaries.org/">geoBoundaries</a> ·{' '}
            <a href="https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2">
              Copernicus Sentinel-2 <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </details>
        )}
      </div>
    </div>
  );
}
