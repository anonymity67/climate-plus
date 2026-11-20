import React, { useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react';
import { TaskLink } from './Home.jsx';

const root = '/harvest/';
const sheets = [
  [
    'D-01_system_schematic.svg',
    'How the system works',
    'ব্যবস্থাটি কীভাবে কাজ করে',
    'Follow rain from the roof through first-flush diversion, filtration, covered storage and a draw-off point.',
    'ছাদ থেকে প্রথম বৃষ্টির পানি আলাদা করা, ছাঁকন, ঢাকনাযুক্ত ট্যাংক ও পানি নেওয়ার পথ দেখুন।',
    880,
  ],
  [
    'D-02_T1_household_tank.svg',
    'Household tank',
    'বাড়ির ট্যাংক',
    'A reference layout for a 5,000 litre tank. Check roof area, foundation and flood level at the actual site.',
    '৫,০০০ লিটারের ট্যাংকের নমুনা নকশা। বাস্তব স্থানে ছাদের মাপ, ভিত্তি ও বন্যার উচ্চতা যাচাই করুন।',
    1150,
  ],
  [
    'D-03_catchment_firstflush_filter.svg',
    'Roof, first flush and filter',
    'ছাদ, প্রথম পানি সরানো ও ছাঁকনি',
    'See where the dirtiest first runoff is diverted and where the screen and filter can be reached for cleaning.',
    'প্রথম দফার ময়লা পানি কোথায় সরানো হয় এবং ছাঁকনি কীভাবে পরিষ্কার করা যায়, দেখুন।',
    1020,
  ],
  [
    'D-04_T2_cluster_unit.svg',
    'Shared tank',
    'যৌথ ট্যাংক',
    'Review shared collection, storage and access for a small group of households.',
    'কয়েকটি পরিবারের জন্য যৌথ সংগ্রহ, সংরক্ষণ ও পানি নেওয়ার ব্যবস্থা দেখুন।',
    1060,
  ],
  [
    'D-05_T3_institutional_unit.svg',
    'School or shelter',
    'বিদ্যালয় বা আশ্রয়কেন্দ্র',
    'See the institutional layout and plan a tested backup supply for high demand or long dry periods.',
    'প্রতিষ্ঠানের ব্যবস্থা দেখুন এবং বেশি চাহিদা বা দীর্ঘ শুষ্ক সময়ের জন্য পরীক্ষিত বিকল্প উৎস রাখুন।',
    1060,
  ],
  [
    'D-06_zone_adaptations.svg',
    'Coast, floodplain and dry areas',
    'উপকূল, প্লাবনভূমি ও শুষ্ক এলাকা',
    'Compare site adaptations for high water, strong winds and long periods without rain.',
    'উঁচু পানি, প্রবল বাতাস ও দীর্ঘ বৃষ্টিহীন সময়ের জন্য নকশার পরিবর্তন দেখুন।',
    920,
  ],
  [
    'D-07_overflow_mar_access.svg',
    'Overflow and cleaning access',
    'উপচে পড়া পানি ও পরিষ্কারের প্রবেশপথ',
    'Plan a safe overflow route and room to clean the system. Any groundwater recharge needs local hydrogeological and water-quality review.',
    'উপচে পড়া পানি সরানোর পথ ও পরিষ্কারের জায়গা রাখুন। ভূগর্ভে পানি দেওয়ার আগে স্থানীয় ভূগর্ভস্থ পানি ও পানির মান বিশেষজ্ঞের পর্যালোচনা দরকার।',
    980,
  ],
];
const references = [
  ['01_Technical_Design_Manual.docx', 'Technical design manual', 'কারিগরি নকশা নির্দেশিকা'],
  [
    '02_Construction_OM_and_Water_Safety_Plan.docx',
    'Construction, maintenance and water safety',
    'নির্মাণ, রক্ষণাবেক্ষণ ও পানির নিরাপত্তা',
  ],
  [
    '03_Programme_Implementation_and_DRR_Guide.docx',
    'Community rollout and disaster preparedness',
    'জনগোষ্ঠীর বাস্তবায়ন ও দুর্যোগ প্রস্তুতি',
  ],
  [
    'BorshaBandhu_Costing_and_Sizing_Model.xlsx',
    'Sizing and indicative cost workbook',
    'মাপ ও আনুমানিক খরচের হিসাবপত্র',
  ],
];

export function HarvestDrawings({ bn }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(false);
  const t = (en, bangla) => (bn ? bangla : en);
  const [name, title, titleBn, description, descBn, height] = sheets[selected];
  const asset = root + 'drawings/' + name;
  return (
    <section id="harvest-drawings" className="harvest-drawings">
      <div className="harvest-section-heading">
        <h2>{t('System drawings', 'ব্যবস্থার নকশা')}</h2>
        <p>
          {t(
            'How to build it. Show these to a local engineer before building.',
            'কীভাবে বানাবেন। বানানোর আগে স্থানীয় প্রকৌশলীকে দেখান।',
          )}
        </p>
      </div>
      <div className="harvest-sheet-layout">
        <ul className="harvest-sheet-list" aria-label={t('Select a drawing', 'নকশা বেছে নিন')}>
          {sheets.map(([file, en, bangla], index) => (
            <li key={file}>
              <button
                type="button"
                aria-pressed={selected === index}
                onClick={() => {
                  setSelected(index);
                  setFailed(false);
                }}
              >
                <span lang="en">{file.slice(0, 4)}</span>
                <strong>{t(en, bangla)}</strong>
              </button>
            </li>
          ))}
        </ul>
        <div className="harvest-sheet-view">
          <header>
            <h3>{t(title, titleBn)}</h3>
            <p>{t(description, descBn)}</p>
          </header>
          {selected === 0 && (
            <ol
              className="harvest-flow"
              aria-label={t('Path water takes through the system', 'ব্যবস্থার ভেতর পানির পথ')}
            >
              {[
                ['Collect on roof', 'ছাদে জমা'],
                ['Divert first runoff', 'প্রথম পানি আলাদা'],
                ['Screen and filter', 'ছাঁকন'],
                ['Cover the tank', 'ঢাকনাযুক্ত ট্যাংক'],
              ].map(([en, bangla], index) => (
                <li key={en}>
                  {t(en, bangla)} {index < 3 && <ArrowRight size={14} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}
          {failed && (
            <p role="alert">
              {t(
                'Preview could not load. Open the original drawing below.',
                'প্রিভিউ খোলা যায়নি। নিচে মূল নকশা খুলুন।',
              )}
            </p>
          )}
          <a
            href={asset}
            target="_blank"
            rel="noreferrer"
            aria-label={t('Open the full drawing', 'পুরো নকশা খুলুন')}
          >
            <img
              key={asset}
              src={asset}
              alt={t(description, descBn)}
              width="1500"
              height={height}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          </a>
          <div className="harvest-sheet-links">
            <a href={asset} target="_blank" rel="noreferrer">
              {t('Open full drawing', 'পুরো নকশা খুলুন')}{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a href={asset} download>
              {t('Download SVG', 'এসভিজি ডাউনলোড করুন')}{' '}
              <ArrowDownToLine size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="harvest-caption">
            {t(
              'English source drawing. Review dimensions, site conditions and treatment before building.',
              'মূল নকশাটি ইংরেজিতে। নির্মাণের আগে মাপ, স্থানের অবস্থা ও পানি শোধন যাচাই করুন।',
            )}
          </p>
        </div>
      </div>
      <div className="harvest-field">
        <section>
          <h2>{t('Before people use the water', 'পানি ব্যবহারের আগে')}</h2>
          <ol>
            <li>
              <strong>{t('Check the site.', 'স্থান যাচাই করুন।')}</strong>{' '}
              {t(
                'Measure the roof. Ask a local engineer to check the foundation, flood level, wind and overflow route.',
                'ছাদ মাপুন। স্থানীয় প্রকৌশলীকে ভিত্তি, বন্যার উচ্চতা, বাতাস ও উপচে পানি যাওয়ার পথ যাচাই করতে বলুন।',
              )}
            </li>
            <li>
              <strong>{t('Name a caretaker.', 'তত্ত্বাবধায়ক ঠিক করুন।')}</strong>{' '}
              {t(
                'Agree who cleans the roof and screen, checks the cover and clears the first-flush device.',
                'কে ছাদ ও ছাঁকনি পরিষ্কার করবেন, ঢাকনা দেখবেন ও প্রথম পানি সরানোর অংশ খুলে পরিষ্কার করবেন, ঠিক করুন।',
              )}
            </li>
            <li>
              <strong>{t('Test the supply.', 'পানি পরীক্ষা করুন।')}</strong>{' '}
              {t(
                'Ask the local water authority about treatment and tests for the intended use. Confirm a tested backup supply for shortages.',
                'ব্যবহারের ধরন অনুযায়ী পানি শোধন ও পরীক্ষার জন্য স্থানীয় কর্তৃপক্ষের পরামর্শ নিন। ঘাটতির জন্য পরীক্ষিত বিকল্প উৎস নিশ্চিত করুন।',
              )}
            </li>
          </ol>
          <TaskLink view="care" bn={bn} className="aq-inline">
            {t('Checks before drinking', 'পান করার আগের যাচাই')}{' '}
            <ArrowUpRight size={15} aria-hidden="true" />
          </TaskLink>
          <p>
            <a
              className="aq-inline"
              href="https://www.who.int/publications/m/item/sanitary-inspection-package-%28drinking-water%29--rainwater-collection-and-storage"
            >
              {t(
                'WHO rainwater inspection checklist',
                'বিশ্ব স্বাস্থ্য সংস্থার বৃষ্টির পানি পরিদর্শনের তালিকা',
              )}{' '}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </p>
        </section>
        <section>
          <h2>{t('Field reference files', 'মাঠকর্মের নথি')}</h2>
          <p>
            {t(
              'The workbook uses indicative 2026 costs. Ask local suppliers for current prices.',
              'হিসাবপত্রে ২০২৬ সালের আনুমানিক খরচ ধরা হয়েছে। বর্তমান মূল্য স্থানীয় সরবরাহকারীর কাছে জেনে নিন।',
            )}
          </p>
          <ul className="harvest-downloads">
            {references.map(([file, en, bangla]) => (
              <li key={file}>
                <a href={root + file} download>
                  <BookOpen size={17} aria-hidden="true" />
                  <span>{t(en, bangla)}</span>
                  <span lang="en">{file.split('.').at(-1).toUpperCase()}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
