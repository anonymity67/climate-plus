import React, { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { Brief } from './brief.jsx';
import { ArrowLeft, ArrowRight, ClipboardCheck, LocateFixed, MapPin, Search } from 'lucide-react';
import { useWaterQuery } from './use-water-query.mjs';
import { Export, Source, State, statusName } from './shared.jsx';
import { TaskLink } from './Home.jsx';
import { api } from '../operations/api-client.mjs';
import { bangladeshDate } from '../date-context.mjs';

const AtlasMap = lazy(() => import('./AtlasMap.jsx').then((m) => ({ default: m.AtlasMap })));
const PAGE_SIZE = 20;
const banglaPlaces = {
  "Cox'S Bazar": 'কক্সবাজার',
  Ukhia: 'উখিয়া',
  Teknaf: 'টেকনাফ',
  "Cox'S Bazar Sadar": 'কক্সবাজার সদর',
  Khulna: 'খুলনা',
  Koyra: 'কয়রা',
  Paikgachha: 'পাইকগাছা',
  'Khulna Sadar': 'খুলনা সদর',
  Daulatpur: 'দৌলতপুর',
  Khalishpur: 'খালিশপুর',
  Dhaka: 'ঢাকা',
  Turag: 'তুরাগ',
  Mohammadpur: 'মোহাম্মদপুর',
  Chittagong: 'চট্টগ্রাম',
  Sitakunda: 'সীতাকুণ্ড',
  Halishahar: 'হালিশহর',
  Bakalia: 'বাকলিয়া',
  Rangpur: 'রংপুর',
  Pirganj: 'পীরগঞ্জ',
  Badarganj: 'বদরগঞ্জ',
  Gangachara: 'গঙ্গাচড়া',
  'Rangpur Sadar': 'রংপুর সদর',
  Taraganj: 'তারাগঞ্জ',
  'Mitha Pukur': 'মিঠাপুকুর',
  Nilphamari: 'নীলফামারী',
  Kishoreganj: 'কিশোরগঞ্জ',
  Jaldhaka: 'জলঢাকা',
  Saidpur: 'সৈয়দপুর',
  Kurigram: 'কুড়িগ্রাম',
  Nageshwari: 'নাগেশ্বরী',
  'Kurigram Sadar': 'কুড়িগ্রাম সদর',
  Phulbari: 'ফুলবাড়ী',
  Bhurungamari: 'ভূরুঙ্গামারী',
  Ulipur: 'উলিপুর',
  Naogaon: 'নওগাঁ',
  Manda: 'মান্দা',
  Mahadebpur: 'মহাদেবপুর',
  Rajshahi: 'রাজশাহী',
  Mohanpur: 'মোহনপুর',
  Baghmara: 'বাগমারা',
  Durgapur: 'দুর্গাপুর',
  Tanore: 'তানোর',
  Nawabganj: 'চাঁপাইনবাবগঞ্জ',
  Bholahat: 'ভোলাহাট',
  Nachole: 'নাচোল',
  Gomastapur: 'গোমস্তাপুর',
  Shibganj: 'শিবগঞ্জ',
  Panchagarh: 'পঞ্চগড়',
  Boda: 'বোদা',
  Debiganj: 'দেবীগঞ্জ',
  Bhola: 'ভোলা',
  Lalmohan: 'লালমোহন',
  Sylhet: 'সিলেট',
  Gowainghat: 'গোয়াইনঘাট',
  Bandarban: 'বান্দরবান',
  Naikhongchhari: 'নাইক্ষ্যংছড়ি',
  Tangail: 'টাঙ্গাইল',
  Sakhipur: 'সখীপুর',
  Satkhira: 'সাতক্ষীরা',
  Shyamnagar: 'শ্যামনগর',
  Dinajpur: 'দিনাজপুর',
  Parbatipur: 'পার্বতীপুর',
  Gaibandha: 'গাইবান্ধা',
  Sadullapur: 'সাদুল্লাপুর',
};
const banglaTypes = {
  'Borehole/Tubewell': 'নলকূপ',
  'Protected Well': 'সুরক্ষিত কূপ',
  'Rainwater Harvesting': 'বৃষ্টির পানি সংরক্ষণের ব্যবস্থা',
  'Water point': 'পানির উৎস',
};

function CheckForm({ point, draft, change }) {
  const [status, setStatus] = useState({ busy: false });
  const checks = useWaterQuery('checks?sourceId=' + encodeURIComponent(point.id));
  async function save(event) {
    event.preventDefault();
    if (status.busy) return;
    const clientId = draft.clientId || crypto.randomUUID();
    change({ ...draft, clientId });
    setStatus({ busy: true });
    try {
      await api('/water/checks', {
        method: 'POST',
        body: { ...draft, sourceId: point.id, clientId },
      });
      change({ ...draft, clientId: null, note: '' });
      setStatus({ message: 'Saved to your private records.' });
      checks.reload();
    } catch (e) {
      setStatus({ error: e.message });
    }
  }
  const update = (key, value) => change({ ...draft, [key]: value, clientId: null });
  return (
    <section className="water-check-form" lang="en">
      <h3>Record a field visit</h3>
      <p className="water-small">
        Describe what you found. Drinking-water clearance requires separate testing.
      </p>
      <form onSubmit={save}>
        <label>
          Outcome
          <select
            value={draft.status}
            disabled={status.busy}
            onChange={(e) => update('status', e.target.value)}
          >
            {Object.entries(statusName).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visit date
          <input
            type="date"
            required
            max={bangladeshDate()}
            value={draft.visitDate}
            disabled={status.busy}
            onChange={(e) => update('visitDate', e.target.value)}
          />
        </label>
        <label>
          What did you find?
          <textarea
            required
            maxLength={1000}
            rows={3}
            value={draft.note}
            disabled={status.busy}
            onChange={(e) => update('note', e.target.value)}
          />
        </label>
        <button className="water-primary" type="submit" disabled={status.busy}>
          <ClipboardCheck size={17} aria-hidden="true" />
          {status.busy ? 'Saving…' : status.error ? 'Retry saving' : 'Save private record'}
        </button>
      </form>
      {status.error && (
        <p role="alert" className="water-error">
          {status.error}
        </p>
      )}
      {status.message && (
        <p role="status" className="water-success">
          {status.message}
        </p>
      )}
      <State resource={checks}>
        {Boolean(checks.data?.checks.length) && (
          <ul className="water-history">
            {checks.data.checks.map((c) => (
              <li key={c.id}>
                <strong>
                  {statusName[c.status]} · {c.visitDate}
                </strong>
                <p>{c.note}</p>
              </li>
            ))}
          </ul>
        )}
      </State>
    </section>
  );
}

export function SourceFinder({
  meta,
  bn,
  onRiver,
  initialSource,
  authenticated,
  signIn,
  useGuide,
}) {
  const areaId = useId();
  const nameId = useId();
  const radiusId = useId();
  const language = bn ? 'bn-BD' : 'en';
  const t = (en, bangla) => (bn ? bangla : en);
  const place = (value) => (bn && banglaPlaces[value]) || value;
  const displayType = (value) => (bn && banglaTypes[value]) || value;
  const n = (value, digits = 0) =>
    value.toLocaleString(language, { maximumFractionDigits: digits });
  const [area, setArea] = useState('');
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(5);
  const [search, setSearch] = useState(null);
  const [selected, setSelected] = useState(initialSource || null);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [drafts, setDrafts] = useState({});
  const inspector = useRef(null);
  const offset = search?.offset || 0;
  const near = search?.kind === 'nearby' ? search : null;
  const path = near
    ? 'nearby'
    : search
      ? 'sources?' +
        new URLSearchParams({ area: search.area, query: search.name, offset, limit: PAGE_SIZE })
      : null;
  const nearbyBody = near
    ? JSON.stringify({
        latitude: near.latitude,
        longitude: near.longitude,
        radiusKm: near.radius,
        offset,
      })
    : null;
  const results = useWaterQuery(path, nearbyBody);
  const detail = useWaterQuery(selected ? 'source?id=' + encodeURIComponent(selected) : null);
  const point = detail.data?.point;
  const districts = new Map();
  for (const entry of meta.areas) {
    if (!districts.has(entry.district)) districts.set(entry.district, []);
    districts.get(entry.district).push(entry);
  }
  const pageKey = near ? [near.latitude, near.longitude, near.radius, offset].join('/') : path;
  useEffect(() => {
    if (selected) inspector.current?.focus({ preventScroll: false });
  }, [selected]);
  function submit(event) {
    event.preventDefault();
    setLocationError(false);
    setSelected(null);
    setSearch({ area, name, offset: 0 });
    results.reload();
  }
  function locate() {
    if (!navigator.geolocation) return setLocationError(true);
    setLocationError(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSearch({
          kind: 'nearby',
          latitude: Number(coords.latitude.toFixed(4)),
          longitude: Number(coords.longitude.toFixed(4)),
          radius,
          offset: 0,
          accuracy: Math.round(coords.accuracy),
        });
        setSelected(null);
        setLocating(false);
        results.reload();
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  function page(next) {
    setSelected(null);
    setSearch((previous) => ({ ...previous, offset: next }));
  }
  return (
    <div className="water-workspace aq-finder" lang={bn ? 'bn' : 'en'}>
      <div className="water-task-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {t('Find a water source', 'পানির উৎস খুঁজুন')}
          </h1>
          <Brief
            bn={bn}
            problem={[
              'In the dry months, your usual source may run out.',
              'শুষ্ক মাসে আপনার নিয়মিত উৎস শুকিয়ে যেতে পারে।',
            ]}
            purpose={[
              'Find a backup well or tap before you need it.',
              'দরকারের আগেই বিকল্প নলকূপ বা কল খুঁজে রাখুন।',
            ]}
            steps={[
              ['Choose your area', 'আপনার এলাকা বেছে নিন'],
              ['Tap a water point', 'একটি পানির উৎসে চাপুন'],
              ['Call or visit to check it works', 'ফোন করে বা গিয়ে দেখুন সচল কি না'],
            ]}
            result={[
              'You get a short list of nearby sources from 20,084 records.',
              '২০,০৮৪টি নথি থেকে কাছের উৎসের ছোট তালিকা পাবেন।',
            ]}
          />
        </div>
      </div>
      <div className="aq-finder-notice">
        <p>
          {t(
            'These are survey records from ' +
              meta.source.dates.min.slice(0, 4) +
              '–' +
              meta.source.dates.max.slice(0, 4) +
              '. Check that a source still works and ask for a recent test before drinking.',
            'এগুলো ২০১৪–২০১৯ সালের জরিপের তথ্য। উৎসটি এখন সচল কি না জেনে নিন এবং পান করার আগে সাম্প্রতিক পরীক্ষার ফল চান।',
          )}
        </p>
        <TaskLink view="care" bn={bn} onGo={useGuide} className="aq-inline">
          {t('How to check a source', 'উৎস যাচাইয়ের উপায়')}{' '}
          <ArrowRight size={16} aria-hidden="true" />
        </TaskLink>
      </div>
      <form
        className="aq-finder-form"
        onSubmit={submit}
        aria-label={t('Search water sources by area', 'এলাকা দিয়ে পানির উৎস খুঁজুন')}
      >
        <div>
          <label htmlFor={areaId}>{t('Area', 'এলাকা')}</label>
          <select
            id={areaId}
            name="area"
            value={area}
            required
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">{t('Choose an area', 'এলাকা বেছে নিন')}</option>
            {[...districts].map(([district, areas]) => (
              <optgroup key={district} label={place(district)}>
                {areas.map((a) => (
                  <option key={a.key} value={a.key}>
                    {place(a.subdistrict)} · {n(a.count)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={nameId}>
            {t('Name or source ID (optional)', 'নাম বা উৎসের আইডি (ঐচ্ছিক)')}
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="search"
            maxLength={200}
            placeholder={t('As written in the survey', 'জরিপে যেভাবে লেখা আছে')}
          />
        </div>
        <button className="water-primary" type="submit">
          <Search size={18} aria-hidden="true" /> {t('Find sources', 'উৎস খুঁজুন')}
        </button>
      </form>
      <details className="aq-nearby">
        <summary>{t('Search near my location instead', 'আমার অবস্থানের আশপাশে খুঁজুন')}</summary>
        <p>
          {t(
            'Your browser will ask before sharing a rounded location for this search.',
            'এই খোঁজের জন্য আপনার আনুমানিক অবস্থান পাঠানোর আগে ব্রাউজার অনুমতি চাইবে।',
          )}
        </p>
        <div className="aq-location-controls">
          <div>
            <label htmlFor={radiusId}>{t('Search distance', 'কত দূর পর্যন্ত')}</label>
            <select
              id={radiusId}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            >
              {[2, 5, 10, 25, 50].map((km) => (
                <option key={km} value={km}>
                  {n(km)} {t('km', 'কিমি')}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={locate} disabled={locating}>
            <LocateFixed size={17} aria-hidden="true" />{' '}
            {locating
              ? t('Finding location…', 'অবস্থান খোঁজা হচ্ছে…')
              : t('Use my location', 'আমার অবস্থান ব্যবহার করুন')}
          </button>
        </div>
        {locationError && (
          <p className="water-error" role="alert">
            {t(
              'Location is unavailable. Choose an area above.',
              'অবস্থান পাওয়া যায়নি। উপরে এলাকা বেছে নিন।',
            )}
          </p>
        )}
      </details>
      {!search && !selected && (
        <p className="aq-coverage-note">
          {t(
            'Most records are in Cox’s Bazar. If your area is missing, ask your local water provider or public health engineering office.',
            'বেশির ভাগ নথি কক্সবাজারের। আপনার এলাকা না থাকলে স্থানীয় পানি সরবরাহকারী বা জনস্বাস্থ্য প্রকৌশল অফিসে জিজ্ঞেস করুন।',
          )}
        </p>
      )}
      <div className="aq-finder-results">
        {search && (
          <State resource={results} bangla={bn}>
            <section className="aq-results" aria-label={t('Search results', 'খোঁজের ফলাফল')}>
              <h2>
                <span role="status">
                  {n(results.data?.total ?? 0)} {t('records found', 'টি নথি পাওয়া গেছে')}
                </span>
              </h2>
              {near && (
                <p className="water-small">
                  {t(
                    'Straight-line distance from your device location.',
                    'আপনার অবস্থান থেকে সরলরেখার দূরত্ব।',
                  )}{' '}
                  ±{n(near.accuracy)} {t('m GPS accuracy', 'মিটার অবস্থানগত নির্ভুলতা')}
                </p>
              )}
              {results.data?.points.length ? (
                <>
                  <ul className="water-source-list">
                    {results.data.points.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(p.id)}
                          aria-pressed={p.id === selected}
                        >
                          <span className="water-result-name">
                            {displayType(p.sourceType)} <ArrowRight size={16} aria-hidden="true" />
                          </span>
                          <span>
                            {[p.locality, p.subdistrict].filter(Boolean).map(place).join(', ')}
                          </span>
                          <span className="water-result-meta">
                            {p.assessedAt}
                            {near ? ' · ' + n(p.distanceKm, 2) + ' ' + t('km', 'কিমি') : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="water-pagination">
                    <button
                      type="button"
                      disabled={!offset}
                      onClick={() => page(offset - PAGE_SIZE)}
                    >
                      <ArrowLeft size={15} aria-hidden="true" /> {t('Previous', 'আগের')}
                    </button>
                    <span>
                      {n(offset + 1)}–{n(Math.min(offset + PAGE_SIZE, results.data.total))}
                    </span>
                    <button
                      type="button"
                      disabled={offset + PAGE_SIZE >= results.data.total}
                      onClick={() => page(offset + PAGE_SIZE)}
                    >
                      {t('Next', 'পরের')} <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="aq-result-actions">
                    <button
                      type="button"
                      aria-expanded={showMap}
                      onClick={() => setShowMap((value) => !value)}
                    >
                      <MapPin size={16} aria-hidden="true" />{' '}
                      {showMap
                        ? t('Hide map', 'মানচিত্র বন্ধ করুন')
                        : t('Show map', 'মানচিত্র দেখুন')}
                    </button>
                    <Export name="aquavelle-water-sources.json" data={results.data}>
                      {t('Download results', 'ফলাফল ডাউনলোড করুন')}
                    </Export>
                  </div>
                  {showMap && (
                    <Suspense fallback={<p>{t('Opening map…', 'মানচিত্র খুলছে…')}</p>}>
                      <AtlasMap
                        points={results.data.points}
                        selectedId={selected}
                        onSelect={(p) => setSelected(p.id)}
                        extentKey={pageKey}
                        label={t(
                          'Map of recorded points. The results list contains the same points.',
                          'নথিভুক্ত উৎসের মানচিত্র। একই উৎস ফলাফলের তালিকাতেও আছে।',
                        )}
                        tiles={false}
                        bangla={bn}
                      />
                    </Suspense>
                  )}
                </>
              ) : (
                <p>
                  {t(
                    'Try removing the name filter or choosing another area. Ask your local provider about current sources.',
                    'নাম মুছে আবার খুঁজুন বা অন্য এলাকা বেছে নিন। সচল উৎস জানতে স্থানীয় সরবরাহকারীর সঙ্গে কথা বলুন।',
                  )}
                </p>
              )}
            </section>
          </State>
        )}
        {selected && (
          <aside
            ref={inspector}
            tabIndex={-1}
            className="water-inspector aq-source-detail"
            aria-label={t('Selected water source', 'বেছে নেওয়া পানির উৎস')}
          >
            <State resource={detail} bangla={bn}>
              {point && (
                <>
                  <span className="water-tag">
                    {t('Check before use', 'ব্যবহারের আগে যাচাই করুন')}
                  </span>
                  <h2>{displayType(point.sourceType)}</h2>
                  <p>
                    {[point.locality, point.subdistrict, point.district]
                      .filter(Boolean)
                      .map(place)
                      .join(', ')}
                  </p>
                  <dl className="water-record">
                    <div>
                      <dt>{t('Last recorded', 'শেষ নথির তারিখ')}</dt>
                      <dd>{point.assessedAt}</dd>
                    </div>
                    <div>
                      <dt>{t('Recorded by', 'তথ্য সংগ্রহ করেছে')}</dt>
                      <dd lang="en">{point.provider}</dd>
                    </div>
                    <div>
                      <dt>{t('Source ID', 'উৎসের আইডি')}</dt>
                      <dd>{point.id}</dd>
                    </div>
                    <div>
                      <dt>{t('Current water quality and supply', 'বর্তমান পানির মান ও সরবরাহ')}</dt>
                      <dd>{t('Unknown', 'জানা নেই')}</dd>
                    </div>
                  </dl>
                  <p>
                    {t(
                      'Confirm it is open and ask for a recent test from this exact source.',
                      'উৎসটি খোলা কি না জেনে নিন এবং ঠিক এই উৎসের সাম্প্রতিক পরীক্ষার ফল চান।',
                    )}
                  </p>
                  <details>
                    <summary>{t('Coordinates and data source', 'স্থানাঙ্ক ও তথ্যসূত্র')}</summary>
                    <p>
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </p>
                    <Source href={detail.data.source.url}>
                      {t('Original WPdx inventory', 'মূল ডব্লিউপিডিএক্স জরিপ')}
                    </Source>
                  </details>
                  {authenticated && (
                    <details>
                      <summary>{t('Record a check', 'পরিদর্শনের নথি রাখুন')}</summary>
                      <CheckForm
                        key={point.id}
                        point={point}
                        draft={
                          drafts[point.id] || {
                            status: 'needs-check',
                            visitDate: bangladeshDate(),
                            note: '',
                          }
                        }
                        change={(value) => setDrafts((all) => ({ ...all, [point.id]: value }))}
                      />
                    </details>
                  )}
                  {!authenticated && signIn && (
                    <a href={signIn} className="aq-inline">
                      {t('Field team sign-in', 'মাঠকর্মীদের প্রবেশ')}
                    </a>
                  )}
                  {detail.data.nearbySites.length > 0 && (
                    <details>
                      <summary>
                        {t('Nearby historic river samples', 'কাছের নদীর পুরোনো নমুনা')}
                      </summary>
                      <p>
                        {t(
                          'River samples cannot tell you if this source is safe.',
                          'নদীর নমুনা দিয়ে এই উৎস নিরাপদ কি না জানা যায় না।',
                        )}
                      </p>
                      {detail.data.nearbySites.map((s) => (
                        <button
                          type="button"
                          className="water-text-button"
                          key={s.id}
                          onClick={() => onRiver(s.id)}
                        >
                          <span lang="en">{s.river}</span> · {n(s.distanceKm, 2)} {t('km', 'কিমি')}{' '}
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </details>
                  )}
                </>
              )}
            </State>
          </aside>
        )}
      </div>
    </div>
  );
}
