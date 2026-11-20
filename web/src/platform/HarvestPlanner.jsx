import React, { useState } from 'react';
import { Brief } from './brief.jsx';
import { ArrowDown, Calculator, CloudRain } from 'lucide-react';
import { api } from '../operations/api-client.mjs';
import { SupplyPlanner } from './SupplyPlanner.jsx';
import { HarvestDrawings } from './HarvestDrawings.jsx';
import { harvestReference, parseHarvestNumber } from './harvest-model.mjs';
import { useSessionDraft } from './session-draft.mjs';
import { Export } from './shared.jsx';
import './harvest-planner.css';

const presetLabels = {
  home: ['Home', 'বাড়ি'],
  cluster: ['Shared tank', 'যৌথ ট্যাংক'],
  school: ['School or shelter', 'বিদ্যালয় বা আশ্রয়কেন্দ্র'],
};
const profileLabels = {
  A: 'দক্ষিণ-পশ্চিম উপকূল',
  B: 'দক্ষিণ-পূর্ব উপকূল',
  C: 'প্লাবনভূমি ও হাওর',
  D: 'বরেন্দ্র ও চর',
  E: 'মধ্যাঞ্চলের সমভূমি',
};
const fields = [
  ['roofM2', 'Roof area (m²)', 'ছাদের আয়তন (বর্গমিটার)', 1, 10000],
  ['tankL', 'Tank size (litres)', 'ট্যাংকের ধারণক্ষমতা (লিটার)', 0, 1000000],
  ['dailyDemandL', 'Water needed each day (litres)', 'প্রতিদিন প্রয়োজন (লিটার)', 1, 100000],
];
const monthName = (month, bn) =>
  new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2001, month - 1, 2)));

function YearResult({ data, bn }) {
  const t = (en, bangla) => (bn ? bangla : en);
  const n = (v, digits = 0) =>
    v.toLocaleString(bn ? 'bn-BD' : 'en', { maximumFractionDigits: digits });
  const result = data?.result;
  if (!result)
    return (
      <div className="harvest-result-empty">
        <CloudRain size={30} strokeWidth={1.5} aria-hidden="true" />
        <h2>{t('When will you need a backup?', 'কখন বিকল্প উৎস লাগবে?')}</h2>
        <p>
          {t(
            'Choose an area and calculate to see which months run short and how much water you may need from another source.',
            'এলাকা বেছে হিসাব করুন। কোন মাসে ঘাটতি হবে এবং অন্য উৎস থেকে কতটা পানি লাগতে পারে দেখুন।',
          )}
        </p>
      </div>
    );
  return (
    <>
      <div className="harvest-outcome" aria-live="polite">
        <h2>{t('Dry-season supply', 'শুষ্ক মৌসুমের সরবরাহ')}</h2>
        <strong>{n(result.dryCoveragePct, 1)}%</strong>
        <p>
          {t(
            'of the entered need met from November to May.',
            'নভেম্বর থেকে মে পর্যন্ত দেওয়া চাহিদার অংশ পূরণ হবে।',
          )}
        </p>
        <p>
          <b>
            {n(result.dryShortL)} {t('litres', 'লিটার')}
          </b>{' '}
          {t(
            'needed from a backup during these seven months.',
            'এই সাত মাসে বিকল্প উৎস থেকে দরকার।',
          )}
        </p>
      </div>
      {!result.stable && (
        <p className="water-qualification">
          {t(
            'The repeated-year calculation did not settle. Treat these amounts as provisional.',
            'পুনরাবৃত্ত বার্ষিক হিসাব স্থির হয়নি। এই পরিমাণগুলো প্রাথমিক ধরে নিন।',
          )}
        </p>
      )}
      <figure className="harvest-months">
        <figcaption>
          {t('Supply and shortfall each month', 'প্রতি মাসের সরবরাহ ও ঘাটতি')}
        </figcaption>
        <div className="harvest-bars" aria-hidden="true">
          {result.months.map((row) => (
            <div
              key={row.month}
              title={
                monthName(row.month, bn) + ' · ' + n(row.shortL) + t(' L short', ' লিটার ঘাটতি')
              }
            >
              <i style={{ '--filled': (100 * row.servedL) / row.demandL + '%' }} />
              <span>{monthName(row.month, bn)}</span>
            </div>
          ))}
        </div>
        <p className="harvest-chart-key">
          <span />
          {t('Supplied', 'সরবরাহ')}
          <span />
          {t('Shortfall', 'ঘাটতি')}
        </p>
      </figure>
      <details>
        <summary>{t('Read the monthly figures', 'প্রতি মাসের হিসাব দেখুন')}</summary>
        <div
          className="water-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={t('Monthly water supply figures', 'মাসিক পানি সরবরাহের হিসাব')}
        >
          <table>
            <caption>
              {t('Rain in millimetres. Water in litres.', 'বৃষ্টি মিলিমিটারে। পানি লিটারে।')}
            </caption>
            <thead>
              <tr>
                {[
                  t('Month', 'মাস'),
                  t('Rain', 'বৃষ্টি'),
                  t('Supplied', 'সরবরাহ'),
                  t('Shortfall', 'ঘাটতি'),
                  t('Tank at end', 'শেষে ট্যাংকে'),
                ].map((name) => (
                  <th scope="col" key={name}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.months.map((row) => (
                <tr key={row.month}>
                  <th scope="row">{monthName(row.month, bn)}</th>
                  <td>{n(row.rainfallMm, 1)}</td>
                  <td>{n(row.servedL)}</td>
                  <td>{n(row.shortL)}</td>
                  <td>{n(row.endL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Export name="aquavelle-seasonal-rainwater-plan.json" data={data}>
        {t('Download calculation and assumptions', 'হিসাব ও অনুমান ডাউনলোড করুন')}
      </Export>
    </>
  );
}

function SeasonalPlanner({ bn }) {
  const t = (en, bangla) => (bn ? bangla : en);
  const first = harvestReference.presets[0];
  const [form, setForm] = useSessionDraft('rainwater-seasonal', {
    profile: 'A',
    rainfall: 'lower',
    roofM2: String(first.roofM2),
    tankL: String(first.tankL),
    dailyDemandL: String(first.dailyDemandL),
  });
  const [state, setState] = useState({});
  const region = harvestReference.profiles.find(({ id }) => id === form.profile);
  function change(values) {
    setForm((current) => ({ ...current, ...values }));
    setState({});
  }
  async function calculate(event) {
    event.preventDefault();
    const input = { profile: form.profile, rainfall: form.rainfall };
    for (const [key, en, bangla, min, max] of fields) {
      const value = parseHarvestNumber(form[key]);
      if (!Number.isFinite(value) || value < min || value > max) {
        setState({
          field: key,
          error:
            t(en, bangla) +
            ' · ' +
            t('enter a number between ', 'সংখ্যা লিখুন ') +
            min.toLocaleString(bn ? 'bn-BD' : 'en') +
            '–' +
            max.toLocaleString(bn ? 'bn-BD' : 'en'),
        });
        event.currentTarget.elements.namedItem(key)?.focus();
        return;
      }
      input[key] = value;
    }
    setState({ busy: true });
    try {
      setState({ data: await api('/water/rainwater/seasonal', { method: 'POST', body: input }) });
    } catch {
      setState({
        error: t(
          'The calculation could not finish. Try again.',
          'হিসাব শেষ হয়নি। আবার চেষ্টা করুন।',
        ),
      });
    }
  }
  return (
    <div className="harvest-seasonal">
      <section className="harvest-inputs">
        <h2>{t('Roof, tank and rainfall', 'ছাদ, ট্যাংক ও বৃষ্টি')}</h2>
        <fieldset className="harvest-presets">
          <legend>{t('Use an example to start', 'শুরুর জন্য উদাহরণ বেছে নিন')}</legend>
          {harvestReference.presets.map(({ id, roofM2, tankL, dailyDemandL }) => {
            const active =
              +form.roofM2 === roofM2 &&
              +form.tankL === tankL &&
              +form.dailyDemandL === dailyDemandL;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                disabled={state.busy}
                onClick={() =>
                  change({
                    roofM2: String(roofM2),
                    tankL: String(tankL),
                    dailyDemandL: String(dailyDemandL),
                  })
                }
              >
                {presetLabels[id][Number(bn)]}
              </button>
            );
          })}
        </fieldset>
        <p className="harvest-caption">
          {t(
            'Examples use 5 litres per person a day for drinking and cooking.',
            'উদাহরণে জনপ্রতি দিনে ৫ লিটার (পান ও রান্না)।',
          )}
        </p>
        <form onSubmit={calculate} noValidate>
          <div className="harvest-input-grid">
            <div>
              <label htmlFor="harvest-region">
                {t('Area rainfall pattern', 'এলাকার বৃষ্টির ধরন')}
              </label>
              <select
                id="harvest-region"
                value={form.profile}
                disabled={state.busy}
                onChange={(e) => change({ profile: e.target.value })}
                aria-describedby="harvest-region-note"
              >
                {harvestReference.profiles.map((option) => (
                  <option key={option.id} value={option.id}>
                    {bn ? profileLabels[option.id] : option.name}
                  </option>
                ))}
              </select>
              <small id="harvest-region-note" lang="en">
                {region?.examples}
              </small>
            </div>
            <div>
              <label htmlFor="harvest-rainfall">
                {t('Rainfall scenario', 'বৃষ্টির পরিস্থিতি')}
              </label>
              <select
                id="harvest-rainfall"
                value={form.rainfall}
                disabled={state.busy}
                onChange={(e) => change({ rainfall: e.target.value })}
              >
                <option value="lower">
                  {t('25% less rain each month', 'প্রতি মাসে ২৫% কম বৃষ্টি')}
                </option>
                <option value="typical">
                  {t('Use the supplied monthly totals', 'উৎসের মাসিক বৃষ্টির পরিমাণ')}
                </option>
              </select>
            </div>
            {fields.map(([key, en, bangla]) => (
              <label key={key} htmlFor={'harvest-' + key}>
                {t(en, bangla)}
                <input
                  id={'harvest-' + key}
                  name={key}
                  type="text"
                  inputMode="decimal"
                  maxLength={14}
                  value={form[key]}
                  disabled={state.busy}
                  onChange={(e) => change({ [key]: e.target.value })}
                  aria-invalid={state.field === key || undefined}
                  aria-describedby={state.field === key ? 'harvest-error' : undefined}
                />
              </label>
            ))}
          </div>
          {state.error && (
            <p className="water-error" id="harvest-error" role="alert">
              {state.error}
            </p>
          )}
          <button type="submit" className="water-primary" disabled={state.busy}>
            <Calculator size={17} aria-hidden="true" />{' '}
            {state.busy
              ? t('Calculating…', 'হিসাব হচ্ছে…')
              : t('Check the year', 'বছরের হিসাব করুন')}
          </button>
        </form>
        <details>
          <summary>{t('How the estimate works', 'হিসাবের পদ্ধতি')}</summary>
          <p>
            {t(
              'Rainfall patterns come from the Borsha-Bandhu planning archive. The estimate collects 80% of roof rainfall and applies each month’s rain before its demand. The lower-rain option is a stress test. Day-to-day shortages need a daily check.',
              'বৃষ্টির ধরন বর্ষাবন্ধুর নকশার নথি থেকে। ছাদের বৃষ্টির ৮০% জমা ধরে প্রতি মাসে আগে বৃষ্টি, পরে ব্যবহার হিসাব করা হয়। কম বৃষ্টির বিকল্পটি চাপের পরিস্থিতি। দৈনিক ঘাটতির জন্য দৈনিক হিসাব দেখুন।',
            )}
          </p>
        </details>
      </section>
      <section className="harvest-results" aria-label={t('Seasonal results', 'মৌসুমি হিসাব')}>
        <YearResult data={state.data} bn={bn} />
      </section>
    </div>
  );
}

export function HarvestPlanner({ bn }) {
  const [mode, setMode] = useState(() =>
    new URLSearchParams(location.search).get('plan') === 'daily' ? 'daily' : 'year',
  );
  const t = (en, bangla) => (bn ? bangla : en);
  function choose(next) {
    setMode(next);
    const url = new URL(location.href);
    if (next === 'daily') url.searchParams.set('plan', 'daily');
    else url.searchParams.delete('plan');
    history.replaceState(history.state, '', url);
  }
  return (
    <div className="water-workspace harvest-planner" lang={bn ? 'bn' : 'en'}>
      <header className="harvest-heading">
        <div>
          <h1 id="water-content" tabIndex={-1}>
            {t('Plan rainwater harvesting', 'বৃষ্টির পানি সংরক্ষণের পরিকল্পনা')}
          </h1>
          <Brief
            bn={bn}
            problem={[
              'A tank that is too small runs dry before the rains come back.',
              'ট্যাংক ছোট হলে বৃষ্টি ফেরার আগেই পানি ফুরিয়ে যায়।',
            ]}
            purpose={[
              'Find the right tank for your home, school or shared site.',
              'আপনার বাড়ি, স্কুল বা যৌথ স্থানের জন্য ঠিক মাপের ট্যাংক বেছে নিন।',
            ]}
            steps={[
              [
                'Pick an example or enter your roof and tank',
                'উদাহরণ বাছুন বা ছাদ ও ট্যাংকের মাপ দিন',
              ],
              ['Press “Check the year”', '“বছরের হিসাব করুন” চাপুন'],
              ['See which months need backup water', 'কোন মাসে বিকল্প পানি লাগবে দেখুন'],
            ]}
            result={[
              'You get a month-by-month plan and drawings to build it.',
              'মাসভিত্তিক হিসাব আর তৈরির নকশা পাবেন।',
            ]}
          />
        </div>
        <a className="aq-inline" href="#harvest-drawings">
          {t('System drawings', 'ব্যবস্থার নকশা')} <ArrowDown size={17} aria-hidden="true" />
        </a>
      </header>
      <div
        className="harvest-mode"
        role="group"
        aria-label={t('Choose how to plan', 'হিসাবের ধরন বেছে নিন')}
      >
        <button type="button" aria-pressed={mode === 'year'} onClick={() => choose('year')}>
          {t('Plan across a year', 'বছরের হিসাব')}
        </button>
        <button type="button" aria-pressed={mode === 'daily'} onClick={() => choose('daily')}>
          {t('Check a shorter period', 'অল্প দিনের হিসাব')}
        </button>
      </div>
      {mode === 'year' ? <SeasonalPlanner bn={bn} /> : <SupplyPlanner bn={bn} />}
      <p className="harvest-note">
        {t(
          'The estimates describe water volume. Arrange local treatment and testing before anyone drinks the water.',
          'হিসাবে শুধু পানির পরিমাণ বোঝায়। পান করার আগে স্থানীয়ভাবে পানি শোধন ও পরীক্ষার ব্যবস্থা করুন।',
        )}
      </p>
      <HarvestDrawings bn={bn} />
    </div>
  );
}
