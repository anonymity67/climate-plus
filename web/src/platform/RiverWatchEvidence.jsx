import React from 'react';
import { ArrowLeft, ArrowUpRight, Crosshair } from 'lucide-react';
import { atlasPlace } from './atlas-place-names.mjs';
import { Export } from './shared.jsx';

const reasons = {
  distance_limit: ['Reached the model’s distance limit', 'মডেলের নির্ধারিত দূরত্ব পর্যন্ত'],
  network_end: ['Mapped river network ends here', 'নথিভুক্ত নদীপথ এখানেই শেষ'],
  unresolved_flow: ['Flow direction could not be resolved', 'প্রবাহের দিক নির্ধারণ করা যায়নি'],
  unlinked: [
    'No river matched within the search distance',
    'নির্ধারিত দূরত্বের মধ্যে নদীপথ মেলেনি',
  ],
  cycle: ['The mapped network loops back', 'নথিভুক্ত নদীপথ ফিরে এসেছে'],
};

export function siteKind(site, bn) {
  const kinds = {
    industrial: ['Industry tag', 'শিল্পের ট্যাগ'],
    landfill: ['Waste-site tag', 'বর্জ্য স্থানের ট্যাগ'],
    wastewater: ['Wastewater tag', 'বর্জ্যপানির ট্যাগ'],
    reference: ['Reference reach', 'তুলনার নদী অংশ'],
  };
  return (kinds[site.category] || ['Mapped site', 'মানচিত্রভুক্ত স্থান'])[Number(bn)];
}

function SatellitePairs({ detail, minPairs, bn }) {
  const t = (en, bangla) => (bn ? bangla : en);
  const rows = detail.pairs;
  const scale = Math.max(0.025, ...rows.map((row) => Math.abs(row.delta)));
  const fixed = (num) =>
    num.toLocaleString(bn ? 'bn-BD' : 'en', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const first = Date.parse(rows[0]?.date);
  const last = Date.parse(rows.at(-1)?.date);
  return (
    <section className="rw-evidence-block">
      <h3>{t('Satellite comparison', 'স্যাটেলাইট তুলনা')}</h3>
      <p>
        {t(
          'Sentinel-2, Nov 2025–Apr 2026. The readings compare water appearance on the same image. Sediment, water colour and other conditions can affect them.',
          'সেন্টিনেল-২, নভেম্বর ২০২৫–এপ্রিল ২০২৬। একই ছবিতে পানির চেহারার তুলনা করা হয়েছে। পলি, পানির রং ও অন্যান্য অবস্থার প্রভাব থাকতে পারে।',
        )}
      </p>
      <p className="rw-evidence-callout">
        {rows.length < minPairs
          ? t(
              rows.length + ' usable dates. This comparison needs at least ' + minPairs + '.',
              rows.length.toLocaleString('bn-BD') +
                ' দিনের ব্যবহারযোগ্য ছবি। এই তুলনার জন্য কমপক্ষে ' +
                minPairs.toLocaleString('bn-BD') +
                ' দিন লাগে।',
            )
          : t(
              rows.length + ' usable dates. The river link still needs field review.',
              rows.length.toLocaleString('bn-BD') +
                ' দিনের ব্যবহারযোগ্য ছবি। নদীর সংযোগ এখনো মাঠে যাচাই করতে হবে।',
            )}
      </p>
      {rows.length > 0 && (
        <>
          <p>
            {t('Median difference', 'পার্থক্যের মধ্যমান')} <strong>{fixed(detail.median)}</strong>
          </p>
          <figure className="rw-chart">
            <svg
              viewBox="0 0 330 116"
              role="img"
              aria-label={t(
                'Observed satellite differences by date, relative to the zero line',
                'তারিখ অনুযায়ী স্যাটেলাইট তুলনার পার্থক্য এবং শূন্য রেখা',
              )}
            >
              <line x1="25" y1="55" x2="316" y2="55" stroke="#92a59d" strokeDasharray="4 4" />
              <text x="9" y="59" fill="#38574d" fontSize="11">
                {bn ? '০' : '0'}
              </text>
              {rows.map(({ date, delta, flagged }) => {
                const x =
                  last > first ? 30 + ((Date.parse(date) - first) / (last - first)) * 280 : 170;
                const y = 55 - (delta / scale) * 43;
                return flagged ? (
                  <rect key={date} x={x - 4} y={y - 4} width="8" height="8" fill="#8f512d">
                    <title>
                      {date} {fixed(delta)}
                    </title>
                  </rect>
                ) : (
                  <circle key={date} cx={x} cy={y} r="4" fill="#4c5e90">
                    <title>
                      {date} {fixed(delta)}
                    </title>
                  </circle>
                );
              })}
              <text x="25" y="111" fill="#38574d" fontSize="10">
                {rows[0].date}
              </text>
              {last > first && (
                <text x="315" y="111" textAnchor="end" fill="#38574d" fontSize="10">
                  {rows.at(-1).date}
                </text>
              )}
            </svg>
            <figcaption>
              {t(
                'Downstream minus upstream appearance index. Squares mark dates flagged by RiverWatch for review.',
                'ভাটি থেকে উজানের মান বিয়োগ। চারকোনা বিন্দু রিভারওয়াচের পর্যালোচনার জন্য চিহ্নিত তারিখ।',
              )}
            </figcaption>
          </figure>
          <details>
            <summary>{t('See the paired readings', 'জোড়া পাঠ দেখুন')}</summary>
            <div
              className="water-table-wrap"
              tabIndex={0}
              role="region"
              aria-label={t('Paired satellite readings', 'স্যাটেলাইটের জোড়া পাঠ')}
            >
              <table>
                <caption>
                  {t('Same-scene water appearance readings', 'একই ছবির পানির চেহারার পাঠ')}
                </caption>
                <thead>
                  <tr>
                    {[
                      t('Date', 'তারিখ'),
                      t('Upstream', 'উজান'),
                      t('Downstream', 'ভাটি'),
                      t('Difference', 'পার্থক্য'),
                    ].map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <th scope="row">{row.date}</th>
                      <td>{fixed(row.up)}</td>
                      <td>{fixed(row.down)}</td>
                      <td>{fixed(row.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

export function RiverWatchEvidence({
  site,
  detail,
  run,
  nearby,
  showZone,
  onZone,
  onBack,
  onSample,
  bn,
}) {
  const t = (en, bangla) => (bn ? bangla : en);
  const n = (number, digits = 0) =>
    number.toLocaleString(bn ? 'bn-BD' : 'en', { maximumFractionDigits: digits });
  if (!detail) return null;
  const last = detail.trace.at(-1);
  const stop = reasons[detail.stop]?.[Number(bn)] || detail.stop.replaceAll('_', ' ');
  const facilityNames = {
    school: ['Schools', 'বিদ্যালয়'],
    hospital: ['Hospitals', 'হাসপাতাল'],
    drinking_water: ['Drinking-water points', 'পানির পয়েন্ট'],
    water_well: ['Wells', 'কূপ'],
  };
  return (
    <div className="rw-inspection" lang={bn ? 'bn' : 'en'}>
      <button className="rw-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" /> {t('Back to results', 'ফলাফলে ফিরে যান')}
      </button>
      <h2>
        <span lang="en">{site.name}</span>
      </h2>
      <p className="rw-location">
        {siteKind(site, bn)}{' '}
        {site.district && (
          <>
            {' '}
            · <span>{atlasPlace(site.district, bn)}</span>
          </>
        )}
      </p>
      {site.priority && (
        <p className="rw-evidence-callout">
          {t(
            'Priority for a field check under RiverWatch’s screening rules.',
            'রিভারওয়াচের নিয়মে এই স্থানে আগে মাঠপর্যায়ে যাচাই করা দরকার।',
          )}
        </p>
      )}
      {site.reference && (
        <p>
          {t(
            'Reference reach for comparison in the Dhaka satellite pilot.',
            'ঢাকা স্যাটেলাইট গবেষণায় তুলনার জন্য নদীর এই অংশ ব্যবহার করা হয়েছে।',
          )}
        </p>
      )}
      <section className="rw-evidence-block">
        <h3>
          <Crosshair size={17} aria-hidden="true" /> {t('Link to the river', 'নদীর সঙ্গে সংযোগ')}
        </h3>
        <dl className="rw-facts">
          <div>
            <dt>{t('Mapped river', 'মানচিত্রের নদী')}</dt>
            <dd lang="en">
              {site.river ||
                (detail.reach ? t('Unnamed reach', 'নামহীন নদী অংশ') : t('No match', 'মেলেনি'))}
            </dd>
          </div>
          <div>
            <dt>{t('Site to river', 'স্থান থেকে নদী')}</dt>
            <dd>{detail.gapM == null ? '—' : n(Math.round(detail.gapM)) + t(' m', ' মি')}</dd>
          </div>
          <div>
            <dt>{t('Field review', 'মাঠের যাচাই')}</dt>
            <dd>
              {detail.linkReviewed
                ? t('Link reviewed', 'সংযোগ পর্যালোচিত')
                : t('Still needed', 'এখনো প্রয়োজন')}
            </dd>
          </div>
          <div>
            <dt>{t('Downstream trace', 'ভাটির রেখা')}</dt>
            <dd>{last ? n(last.toKm, 1) + t(' km', ' কিমি') : t('Unavailable', 'পাওয়া যায়নি')}</dd>
          </div>
        </dl>
        <p className="rw-context">
          {stop}
          {detail.method === 'nearest_ambiguous' &&
            t('. More than one river reach was plausible.', '। একাধিক নদী অংশ সম্ভাব্য ছিল।')}
        </p>
      </section>
      {detail.zone && (
        <section className="rw-evidence-block">
          <h3>{t('Who and what is nearby', 'কাছের মানুষ ও স্থাপনা')}</h3>
          {detail.population != null && (
            <p>
              <strong>{n(Math.round(detail.population))}</strong>{' '}
              {t(
                'estimated residents within 500 m of the modelled trace (WorldPop 2020).',
                'মডেলের ভাটির রেখার ৫০০ মিটারের মধ্যে আনুমানিক বাসিন্দা (ওয়ার্ল্ডপপ ২০২০)।',
              )}
            </p>
          )}
          {!detail.populationComplete && (
            <p>
              {t(
                'Population data cover only part of this area.',
                'জনসংখ্যার তথ্য এই এলাকার কেবল একটি অংশে আছে।',
              )}
            </p>
          )}
          <p>
            {t(
              'These counts describe proximity. Exposure requires field evidence.',
              'এই সংখ্যা শুধু অবস্থানের নৈকট্য বোঝায়। সংস্পর্শের প্রমাণের জন্য মাঠে যাচাই দরকার।',
            )}
          </p>
          <dl className="rw-facts">
            {Object.entries(detail.facilities).map(([key, total]) => (
              <div key={key}>
                <dt>{facilityNames[key][Number(bn)]}</dt>
                <dd>{total == null ? '—' : n(total)}</dd>
              </div>
            ))}
          </dl>
          <label className="rw-check">
            <input type="checkbox" checked={showZone} onChange={(e) => onZone(e.target.checked)} />{' '}
            {t('Show the 500 m area on the map', 'মানচিত্রে ৫০০ মিটার এলাকা দেখুন')}
          </label>
        </section>
      )}
      {run.id === 'dhaka_pilot' && (
        <SatellitePairs detail={detail} minPairs={run.minPairs} bn={bn} />
      )}
      {nearby.length > 0 && (
        <section className="rw-evidence-block">
          <h3>{t('Historical river samples near the trace', 'রেখার কাছে নদীর পুরোনো নমুনা')}</h3>
          <p>
            {t(
              'Stations within 500 m of the trace on the map. Their measurements cannot be attributed to this site.',
              'মানচিত্রে রেখা থেকে ৫০০ মিটারের মধ্যে নমুনা কেন্দ্র। এই ফল এই স্থানের কারণে হয়েছে বলা যায় না।',
            )}
          </p>
          <ul className="rw-nearby">
            {nearby.slice(0, 4).map((sample) => (
              <li key={sample.id}>
                <button type="button" onClick={() => onSample(sample.id)}>
                  <span lang="en">
                    {sample.river} · {sample.name}
                  </span>
                  <span>
                    {sample.latestDate} · {n(Math.round(sample.distanceM))}
                    {t(' m', ' মি')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rw-evidence-block">
        <h3>{t('What to check in the field', 'মাঠে যা যাচাই করবেন')}</h3>
        <p>
          {t(
            'Confirm where water leaves the site, which channel it enters, and the direction the water was flowing at the time. Take separate samples when needed.',
            'পানি কোথা দিয়ে বের হয়, কোন নদী বা খালে যায় এবং তখন প্রবাহ কোন দিকে ছিল তা যাচাই করুন। প্রয়োজন হলে আলাদা নমুনা নিন।',
          )}
        </p>
        {detail.osmUrl?.startsWith('https://www.openstreetmap.org/') && (
          <a href={detail.osmUrl} target="_blank" rel="noreferrer">
            {t('Original OpenStreetMap record', 'মূল ওপেনস্ট্রিটম্যাপ নথি')}{' '}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
        <Export
          name={'riverwatch-' + site.id + '.json'}
          data={{
            run: run.id,
            site,
            detail,
            nearby,
            interpretation:
              'RiverWatch screening data. Confirm mapped activity, outlet and flow. Proximity and appearance are not evidence of contamination or attribution.',
          }}
        >
          {t('Download this site’s evidence', 'স্থানের তথ্য ডাউনলোড করুন')}
        </Export>
      </section>
    </div>
  );
}
