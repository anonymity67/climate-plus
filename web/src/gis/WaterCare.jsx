import React, { useState } from 'react';
import { ArrowRight, Droplets, Printer, ShieldAlert } from 'lucide-react';
import { leakLossLitresPerDay, storagePlanLitres } from '../gis-engine.mjs';
import { SourceLink, number } from './shared.jsx';

export function WaterCare({ bn, onFind }) {
  const [concern, setConcern] = useState('flood'),
    [people, setPeople] = useState('4'),
    [days, setDays] = useState('3'),
    [litres, setLitres] = useState('15'),
    [volume, setVolume] = useState('100'),
    [seconds, setSeconds] = useState('60');
  const numeric = (value) => (value.trim() === '' ? NaN : Number(value));
  const storage = storagePlanLitres(numeric(people), numeric(days), numeric(litres));
  const loss = leakLossLitresPerDay(numeric(volume), numeric(seconds));
  return (
    <div className="gis-care">
      <div className="gis-section-intro">
        <div>
          <h2>
            {bn
              ? 'পানি সুরক্ষিত রাখুন। অপচয় কমান।'
              : 'Protect drinking water. Reduce avoidable loss.'}
          </h2>
          <p>
            {bn
              ? 'বর্তমান স্থানীয় নির্দেশনা মানুন। দূষণের ধরনের সঙ্গে সঠিক ব্যবস্থা মিলিয়ে নিন।'
              : 'Follow current local advice. Match the precaution to the contamination concern.'}
          </p>
        </div>
        <button className="secondary" onClick={onFind}>
          {bn ? 'পানির উৎসের তালিকা' : 'Find water-point candidates'}
          <ArrowRight size={16} />
        </button>
      </div>
      <label className="gis-care-concern">
        What are you concerned about?
        <select value={concern} onChange={(e) => setConcern(e.target.value)}>
          <option value="flood">Flooding or disrupted supply</option>
          <option value="chemical">Industrial chemicals, arsenic or salinity</option>
          <option value="daily">Everyday storage and water use</option>
        </select>
      </label>
      <div className="gis-layer-note gis-care-warning">
        <ShieldAlert size={22} />
        <p>
          {concern === 'chemical'
            ? bn
              ? 'লবণ, আর্সেনিক বা বিষাক্ত রাসায়নিক ফুটিয়ে বা জীবাণুনাশক দিয়ে দূর করা যায় না। অনুমোদিত বিকল্প উৎসের পানি নিন এবং যথাযথ পরীক্ষার ব্যবস্থা করুন।'
              : 'Boiling and disinfection do not remove salts, arsenic or most harmful chemicals. Use an approved alternative supply and obtain contaminant-specific testing; do not boil suspect chemical water and assume it is drinkable.'
            : concern === 'flood'
              ? bn
                ? 'বন্যার পানি পান, রান্না, দাঁত মাজা বা খাবার তৈরিতে ব্যবহার করবেন না। পানির বর্তমান অবস্থা ও চলাচলের পথ স্থানীয় কর্তৃপক্ষের সঙ্গে যাচাই করুন।'
                : 'Do not use floodwater for drinking, preparing food or brushing teeth. Check current water advisories and access conditions locally before travelling.'
              : bn
                ? 'পরিষ্কার দেখালেই পানি নিরাপদ নয়। পানযোগ্য পানি পরিচ্ছন্ন ঢাকনাযুক্ত পাত্রে রাখুন; নোংরা পানি ও পাত্র থেকে আলাদা রাখুন।'
                : 'Clear appearance does not establish safety. Keep drinking water in clean covered containers and separate it from dirty vessels and untreated supplies.'}
        </p>
      </div>
      <div className="gis-care-columns">
        <section>
          <h3>{bn ? 'পরিবারের জন্য করণীয়' : 'For the household'}</h3>
          <ol className="gis-care-steps">
            <li>
              <b>
                {bn
                  ? 'নির্ভরযোগ্য উৎস ও বর্তমান নির্দেশনা যাচাই করুন'
                  : 'Check the source and the current advisory'}
              </b>
              <p>
                Ask the local water operator or DPHE about present availability, testing and any
                restrictions. An old map point is not a current water-quality result.
              </p>
            </li>
            <li>
              <b>
                {bn
                  ? 'জীবাণু ও রাসায়নিকের ঝুঁকি আলাদা করুন'
                  : 'Separate germ treatment from chemical contamination'}
              </b>
              <p>
                When germ contamination is the concern, follow local treatment instructions. CDC
                guidance uses a rolling boil for one minute, then cooling and protected storage.
                Boiling is not a remedy for salinity, arsenic or toxic chemicals.
              </p>
            </li>
            <li>
              <b>
                {bn ? 'সংরক্ষণের সময় পুনরায় দূষণ এড়ান' : 'Prevent contamination after collection'}
              </b>
              <p>
                Use clean, tightly covered containers. Pour water or use a clean dispensing tap;
                avoid dipping hands or dirty cups. Keep treated and untreated containers distinct.
              </p>
            </li>
          </ol>
          <div className="gis-source-footer">
            <SourceLink href="https://www.cdc.gov/water-emergency/about/">
              CDC emergency-water guidance
            </SourceLink>
            <SourceLink href="https://www.who.int/news-room/questions-and-answers/item/how-do-i-protect-my-health-in-a-flood/">
              WHO flood precautions
            </SourceLink>
            <SourceLink href="https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water">
              EPA chemical and salt limitation
            </SourceLink>
          </div>
        </section>
        <section>
          <h3>{bn ? 'নদী ও পানির উৎস রক্ষায়' : 'For the source and the surroundings'}</h3>
          <ul className="gis-care-actions">
            <li>
              <b>Stop pollution at its entry point.</b>
              <p>
                Keep waste oil, solvents, pesticide residue and other hazardous waste out of drains
                and water bodies. Use an authorized collection or treatment pathway.
              </p>
            </li>
            <li>
              <b>Check loads as well as concentration.</b>
              <p>
                For an authorized intervention, compare upstream/outfall/downstream measurements and
                concurrent flow. Dilution alone is not removal; track energy and sludge or brine
                disposal too.
              </p>
            </li>
            <li>
              <b>Fix the loss before rationing essentials.</b>
              <p>
                Report broken supply lines, close unused taps and measure leaks. Do not reduce
                essential drinking, food preparation or hygiene to meet a water-saving target.
              </p>
            </li>
            <li>
              <b>Keep a factual incident record.</b>
              <p>
                Record place, time and observable conditions from a safe position. Do not enter
                floodwater, approach a hazardous discharge, or identify a polluter from proximity
                alone.
              </p>
            </li>
          </ul>
        </section>
      </div>
      <div className="gis-calculators">
        <section className="gis-calculator">
          <div className="gis-inspector-heading">
            <Droplets size={22} />
            <h3>{bn ? 'স্বচ্ছ হিসাবের পানির পরিকল্পনা' : 'A transparent storage estimate'}</h3>
          </div>
          <div className="gis-calculator-inputs">
            <label>
              People
              <input
                type="number"
                min="0"
                step="1"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
              />
            </label>
            <label>
              Planning days
              <input
                type="number"
                min="0"
                step="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <label>
              Entered L/person/day
              <input
                type="number"
                min="0"
                step="any"
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
              />
            </label>
          </div>
          <output className="gis-calculator-output" aria-live="polite">
            {storage === null ? 'Enter valid nonnegative values' : number(storage, 1) + ' L'}
            <small>people × days × your daily allowance</small>
          </output>
          <p className="gis-micro">
            15 L/person/day is an editable planning example, not a prescription or maximum. Actual
            requirements vary with climate, health, hygiene and local response guidance. This
            calculator does not identify a safe supply.
          </p>
        </section>
        <section className="gis-calculator">
          <h3>{bn ? 'মেপে দেখুন, লিকে কত পানি নষ্ট হয়' : 'Measure what a leak could lose'}</h3>
          <div className="gis-calculator-inputs">
            <label>
              Collected leak volume (mL)
              <input
                type="number"
                min="0"
                step="any"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </label>
            <label>
              Collection time (seconds)
              <input
                type="number"
                min="1"
                step="any"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
              />
            </label>
          </div>
          <output className="gis-calculator-output" aria-live="polite">
            {loss === null ? 'Enter volume and a positive duration' : number(loss, 1) + ' L/day'}
            <small>volume ÷ time × 86,400 seconds</small>
          </output>
          <p className="gis-micro">
            Assumes the measured rate continues all day. The default is an illustrative 100 mL
            collected in 60 seconds. It is potential leakage, not measured project savings.
          </p>
        </section>
      </div>
      <div className="gis-print-action">
        <p>Keep the chemical-contamination warning with any printed precaution sheet.</p>
        <button className="secondary" onClick={() => window.print()}>
          <Printer size={16} />
          {bn ? 'নির্দেশনা প্রিন্ট করুন' : 'Print these precautions'}
        </button>
      </div>
    </div>
  );
}
