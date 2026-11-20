import React, { useState } from 'react';
import { Calculator, Droplets, Wrench } from 'lucide-react';
import { api } from '../operations/api-client.mjs';
import { leakageEstimate } from './water-model.mjs';
import { harvestReference, parseHarvestNumber } from './harvest-model.mjs';
import { count, Export, Source } from './shared.jsx';
import { useSessionDraft } from './session-draft.mjs';
import { TaskLink } from './Home.jsx';
const dryMonth = Array(30).fill(0).join(', ');
const inputLimits = {
  roofM2: [1, 10000],
  tankL: [0, 1000000],
  startL: [0, 1000000],
  dailyDemandL: [1, 100000],
  runoff: [0.1, 1],
  lossMm: [0, 20],
};
const exampleLabels = {
  home: ['Home', 'বাড়ি'],
  cluster: ['Shared tank', 'যৌথ ট্যাংক'],
  school: ['School', 'বিদ্যালয়'],
};
const examples = harvestReference.presets.map(({ id, roofM2, tankL, dailyDemandL }) => [
  ...exampleLabels[id],
  String(roofM2),
  String(tankL),
  String(dailyDemandL),
]);
export function SupplyPlanner({ bn }) {
  const t = (en, bangla) => (bn ? bangla : en);
  const qty = (n) => n.toLocaleString(bn ? 'bn-BD' : 'en', { maximumFractionDigits: 2 });
  const [form, setForm] = useSessionDraft('rainwater-inputs', {
    roofM2: '20',
    runoff: '.8',
    tankL: '5000',
    startL: '5000',
    dailyDemandL: '30',
    lossMm: '1',
    rainfall: dryMonth,
  });
  const [state, setState] = useState({ busy: false, error: '', data: null }),
    [leak, setLeak] = useState({ ml: '100', seconds: '60' }),
    [leakResult, setLeakResult] = useState(null),
    [leakError, setLeakError] = useState('');
  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setState((s) => ({ ...s, data: null, error: '', field: null }));
  };
  async function calculate(e) {
    e.preventDefault();
    if (state.busy) return;
    const input = Object.fromEntries(
      Object.keys(inputLimits).map((key) => [key, parseHarvestNumber(form[key])]),
    );
    const invalid = Object.entries(inputLimits).find(
      ([key, [min, max]]) => !Number.isFinite(input[key]) || input[key] < min || input[key] > max,
    );
    if (invalid) {
      const [field, [min, max]] = invalid;
      setState({
        field,
        error:
          t('Enter a number in this range', 'এই সীমার মধ্যে সংখ্যা লিখুন') +
          ' · ' +
          qty(min) +
          '–' +
          qty(max),
      });
      const control = e.currentTarget.elements.namedItem(field);
      control?.closest('details')?.setAttribute('open', '');
      control?.focus();
      return;
    }
    if (input.startL > input.tankL) {
      setState({
        field: 'startL',
        error: t(
          'Starting water must fit in the tank.',
          'শুরুর পানির পরিমাণ ট্যাংকের ধারণক্ষমতার মধ্যে রাখুন।',
        ),
      });
      e.currentTarget.elements.namedItem('startL')?.focus();
      return;
    }
    input.rainfallMm = form.rainfall.split(',').map(parseHarvestNumber);
    if (
      input.rainfallMm.length > 366 ||
      input.rainfallMm.some((n) => !Number.isFinite(n) || n > 2000)
    ) {
      setState({
        field: 'rainfall',
        error: t(
          'Enter up to 366 daily rainfall amounts from 0 to 2,000 mm, separated by commas.',
          'কমা দিয়ে সর্বোচ্চ ৩৬৬ দিনের বৃষ্টিপাত লিখুন। প্রতিদিনের পরিমাণ ০ থেকে ২০০০ মিমি হতে হবে।',
        ),
      });
      const control = e.currentTarget.elements.namedItem('rainfall');
      control?.closest('details')?.setAttribute('open', '');
      control?.focus();
      return;
    }
    setState({ busy: true, error: '', data: null });
    try {
      const data = await api('/water/rainwater', { method: 'POST', body: input });
      setState({ busy: false, error: '', data });
    } catch {
      setState({
        error: t(
          'The calculation could not finish. Try again.',
          'হিসাব শেষ হয়নি। আবার চেষ্টা করুন।',
        ),
      });
    }
  }
  const result = state.data?.result;
  return (
    <div className="aq-rain" lang={bn ? 'bn' : 'en'}>
      <div className="water-planner-layout">
        <section>
          <h2>{t('Your roof and tank', 'আপনার ছাদ ও ট্যাংক')}</h2>
          <p>
            {t(
              'Start with a full tank and 30 days without rain, or enter your own numbers. Example sizes are from the Borsha-Bandhu planning guide.',
              'উদাহরণে ট্যাংক পূর্ণ এবং ৩০ দিন বৃষ্টি নেই। চাইলে নিজের তথ্য দিন। উদাহরণের মাপ বর্ষাবন্ধু পরিকল্পনা নির্দেশিকা থেকে নেওয়া।',
            )}
          </p>
          <div className="aq-examples">
            {examples.map(([en, bangla, roofM2, tankL, dailyDemandL]) => (
              <button
                key={en}
                type="button"
                disabled={state.busy}
                onClick={() => {
                  setForm({
                    roofM2,
                    tankL,
                    dailyDemandL,
                    startL: tankL,
                    runoff: '0.8',
                    lossMm: '1',
                    rainfall: dryMonth,
                  });
                  setState({ busy: false, data: null, error: '' });
                }}
              >
                {t(en, bangla)}
              </button>
            ))}
          </div>
          <form
            onSubmit={calculate}
            noValidate
            className="water-plan-form"
            aria-label={t('Calculate rainwater storage', 'বৃষ্টির পানি জমার হিসাব করুন')}
          >
            <div className="water-entry-grid">
              {[
                ['roofM2', 'Roof area (m²)', 'ছাদের আয়তন (বর্গমিটার)'],
                ['tankL', 'Tank capacity (litres)', 'ট্যাংকের ধারণক্ষমতা (লিটার)'],
                [
                  'startL',
                  'Water in the tank at the start (litres)',
                  'শুরুতে ট্যাংকে পানি (লিটার)',
                ],
                ['dailyDemandL', 'Water needed per day (litres)', 'প্রতিদিন প্রয়োজন (লিটার)'],
              ].map(([key, en, bangla]) => (
                <label htmlFor={key} key={key}>
                  {t(en, bangla)}
                  <input
                    id={key}
                    name={key}
                    aria-invalid={state.field === key || undefined}
                    aria-describedby={state.field === key ? 'aq-rain-error' : undefined}
                    inputMode="decimal"
                    maxLength={14}
                    required
                    disabled={state.busy}
                    value={form[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <details>
              <summary>
                {t('Change rainfall and collection losses', 'বৃষ্টিপাত ও পানি জমার ক্ষতি বদলান')}
              </summary>
              <div className="water-entry-grid">
                {[
                  [
                    'runoff',
                    'Share of rain collected (0.1 to 1)',
                    'বৃষ্টির যে অংশ জমা হবে (০.১ থেকে ১)',
                  ],
                  [
                    'lossMm',
                    'Collection loss on a rainy day (mm)',
                    'বৃষ্টির দিনে জমা হওয়ার আগে ক্ষতি (মিমি)',
                  ],
                ].map(([key, en, bangla]) => (
                  <label htmlFor={key} key={key}>
                    {t(en, bangla)}
                    <input
                      id={key}
                      name={key}
                      aria-invalid={state.field === key || undefined}
                      aria-describedby={state.field === key ? 'aq-rain-error' : undefined}
                      inputMode="decimal"
                      maxLength={14}
                      required
                      disabled={state.busy}
                      value={form[key]}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label htmlFor="rainfall">
                {t(
                  'Daily rainfall (mm, separated by commas)',
                  'দৈনিক বৃষ্টিপাত (মিমি, কমা দিয়ে আলাদা করুন)',
                )}
                <textarea
                  id="rainfall"
                  name="rainfall"
                  required
                  rows={3}
                  maxLength={4000}
                  disabled={state.busy}
                  value={form.rainfall}
                  onChange={(e) => change('rainfall', e.target.value)}
                  aria-invalid={state.field === 'rainfall' || undefined}
                  aria-describedby={
                    state.field === 'rainfall' ? 'rain-help aq-rain-error' : 'rain-help'
                  }
                />
              </label>
              <p id="rain-help" className="water-small">
                {t(
                  'Use 0 for dry days. Enter up to 366 days in order.',
                  'বৃষ্টিহীন দিনের জন্য ০ লিখুন। ক্রমানুসারে সর্বোচ্চ ৩৬৬ দিনের হিসাব দিন।',
                )}
              </p>
            </details>
            <button type="submit" className="water-primary" disabled={state.busy}>
              <Calculator size={18} />
              {state.busy
                ? t('Calculating…', 'হিসাব হচ্ছে…')
                : t('Calculate water balance', 'পানির হিসাব করুন')}
            </button>
          </form>
          {state.error && (
            <p className="water-error" id="aq-rain-error" role="alert">
              {state.error}
            </p>
          )}
          <details lang="en">
            <summary>Assumptions and formula</summary>
            <p>
              One millimetre of rain on one square metre is one litre before losses. Each day's
              collection = max(0, rainfall − entered loss) × roof area × collected share. Rain
              enters first, the tank spills above capacity, then daily demand is served. Start +
              collected = used + spill + final reserve. No extraction, recharge, treatment, pump
              efficiency, evaporation or real-time forecast is modelled.
            </p>
            <Source href="https://www.who.int/publications/i/item/9789240088740">
              WHO small-water-supply guidance
            </Source>
          </details>
        </section>
        <section className="water-plan-result" aria-live="polite">
          {result ? (
            <>
              <h2>
                {qty(result.coveragePercent)}% {t('of the entered need met', 'চাহিদা পূরণ হয়')}
              </h2>
              <p>
                {qty(result.totalUnmetL)}{' '}
                {t(
                  'litres needed from another supply during this example.',
                  'লিটার এই উদাহরণে অন্য উৎস থেকে লাগবে।',
                )}
              </p>
              <dl className="water-record">
                <div>
                  <dt>{t('Collected before overflow', 'উপচে পড়ার আগে জমা')}</dt>
                  <dd>{count(result.totalCollectedL)} L</dd>
                </div>
                <div>
                  <dt>{t('Used to meet the need', 'চাহিদা মেটাতে ব্যবহৃত')}</dt>
                  <dd>{count(result.totalServedL)} L</dd>
                </div>
                <div>
                  <dt>{t('Overflow', 'উপচে পড়া পানি')}</dt>
                  <dd>{count(result.totalSpillL)} L</dd>
                </div>
                <div>
                  <dt>{t('Left in the tank', 'শেষে ট্যাংকে থাকে')}</dt>
                  <dd>{count(result.closingL)} L</dd>
                </div>
              </dl>
              <figure className="water-reserve-chart">
                <figcaption>
                  {t(
                    'Water left at the end of each day (litres)',
                    'প্রতিদিন শেষে ট্যাংকে বাকি পানি (লিটার)',
                  )}
                </figcaption>
                <svg
                  role="img"
                  aria-label={t(
                    'Daily water left in the tank. See the table for details.',
                    'প্রতিদিন ট্যাংকে বাকি পানি। বিস্তারিত সারণিতে দেখুন।',
                  )}
                  viewBox="0 0 600 180"
                >
                  <path d="M15 155H585" fill="none" stroke="#a9b7ae" />
                  <polyline
                    fill="none"
                    stroke="#176b4c"
                    strokeWidth="3"
                    points={result.days
                      .map(
                        (d, i) =>
                          `${15 + (i / Math.max(1, result.days.length - 1)) * 570},${155 - (d.closingL / Math.max(1, state.data.input.tankL)) * 130}`,
                      )
                      .join(' ')}
                  />
                </svg>
                <p className="water-small">
                  {t('Day', 'দিন')} {qty(1)} → {t('Day', 'দিন')} {qty(result.days.length)}
                </p>
              </figure>
              <Export name="aquavelle-rainwater-plan.json" data={state.data}>
                {t('Download calculation', 'হিসাব ডাউনলোড করুন')}
              </Export>
              <details>
                <summary>{t('Inspect each day', 'প্রতিদিনের হিসাব দেখুন')}</summary>
                <div className="water-table-wrap">
                  <table>
                    <caption>
                      {t(
                        'Daily tank balance in litres, with rainfall in millimetres',
                        'প্রতিদিনের হিসাব লিটারে, বৃষ্টিপাত মিলিমিটারে',
                      )}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Day', 'দিন')}</th>
                        <th scope="col">{t('Rain mm', 'বৃষ্টি (মিমি)')}</th>
                        <th scope="col">{t('Collected', 'জমা')}</th>
                        <th scope="col">{t('Spilled', 'উপচে পড়া')}</th>
                        <th scope="col">{t('Used', 'ব্যবহার')}</th>
                        <th scope="col">{t('Short', 'ঘাটতি')}</th>
                        <th scope="col">{t('End', 'বাকি')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.days.map((d) => (
                        <tr key={d.day}>
                          <th scope="row">{qty(d.day)}</th>
                          <td>{qty(d.rainfallMm)}</td>
                          <td>{qty(d.collectedL)}</td>
                          <td>{qty(d.spillL)}</td>
                          <td>{qty(d.servedL)}</td>
                          <td>{qty(d.unmetL)}</td>
                          <td>{qty(d.closingL)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="water-qualification">
                {t(
                  'This estimates volume. Have the roof, storage and treatment checked locally and test the water before drinking.',
                  'এটি পানির পরিমাণের হিসাব। স্থানীয়ভাবে ছাদ, ট্যাংক ও পানি শোধনের ব্যবস্থা যাচাই করুন এবং পান করার আগে পরীক্ষা করান।',
                )}
              </p>
            </>
          ) : (
            <div className="water-plan-empty">
              <Droplets size={38} />
              <h2>{t('Will the tank be enough?', 'ট্যাংকের পানি কি যথেষ্ট হবে?')}</h2>
              <p>
                {t(
                  'Calculate to see the amount collected, the amount left, and any shortfall.',
                  'কতটা জমা হবে, কতটা বাকি থাকবে, আর কতটা ঘাটতি হবে, হিসাব করুন।',
                )}
              </p>
            </div>
          )}
        </section>
      </div>
      <details lang="en" className="aq-rain-more">
        <summary>Measure a leak and maintain storage</summary>
        <div className="water-care-row">
          <section>
            <h2>Measure a leak, then repair it</h2>
            <p>
              Collect a leaking tap's water in a measuring jug and time it. This estimate assumes a
              steady leak rate.
            </p>
            <form
              className="water-leak-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  setLeakResult(leakageEstimate(Number(leak.ml), Number(leak.seconds)));
                  setLeakError('');
                } catch (e) {
                  setLeakError(e.message);
                }
              }}
            >
              <label>
                Collected water · mL
                <input
                  name="volumeMl"
                  type="number"
                  min="0"
                  max="1000000"
                  required
                  value={leak.ml}
                  onChange={(e) => {
                    setLeak((d) => ({ ...d, ml: e.target.value }));
                    setLeakResult(null);
                  }}
                />
              </label>
              <label>
                Collection time · seconds
                <input
                  name="seconds"
                  type="number"
                  min=".1"
                  step="any"
                  required
                  value={leak.seconds}
                  onChange={(e) => {
                    setLeak((d) => ({ ...d, seconds: e.target.value }));
                    setLeakResult(null);
                  }}
                />
              </label>
              <button type="submit" className="water-secondary">
                <Wrench size={16} />
                Estimate waste
              </button>
            </form>
            {leakResult && (
              <p role="status" className="water-success">
                About {count(leakResult.dailyLitres)} L/day · {count(leakResult.totalLitres)} L over
                30 days at that steady rate.
              </p>
            )}
            {leakError && <p role="alert">{leakError}</p>}
          </section>
          <section>
            <h2>Keep the supply usable</h2>
            <p>
              Keep storage covered and clean, use a clean outlet, and separate non-drinking uses
              from supplies cleared for drinking. Report damaged pipes and avoid releasing waste or
              chemicals into drains and channels.
            </p>
            <p>
              Boiling and household disinfection do not remove salts, heavy metals or most
              chemicals. Ask the responsible authority about an alternative supply when these are
              suspected.
            </p>
            <Source href="https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water">
              EPA guidance on treatment limits
            </Source>
          </section>
        </div>
      </details>
      <TaskLink view="care" bn={bn} className="aq-inline">
        {t('How to check your water', 'পানি যাচাইয়ের উপায়')}
      </TaskLink>
    </div>
  );
}
