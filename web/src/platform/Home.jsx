import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  CloudRain,
  Droplet,
  FlaskConical,
  MapPin,
  ShieldCheck,
  Siren,
  Waves,
  Users,
} from 'lucide-react';
import { homeFacts as F, bnNum, fmt } from './home-facts.mjs';
import { Brief } from './brief.jsx';

export function taskLink(view, bn) {
  const query = new URLSearchParams();
  if (view !== 'home') query.set('view', view);
  if (bn) query.set('lang', 'bn');
  return query.size ? '/?' + query : '/';
}

export function TaskLink({ view, bn, className, current, onGo, children }) {
  return (
    <a
      href={taskLink(view, bn)}
      className={className}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        if (!onGo || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onGo(view);
      }}
    >
      {children}
    </a>
  );
}

const residentTools = [
  [
    'supply',
    CloudRain,
    'Plan a rain tank',
    'বৃষ্টির পানির ট্যাংকের পরিকল্পনা করুন',
    'How much water your roof can give, month by month.',
    'আপনার ছাদ মাসে মাসে কত পানি দিতে পারে।',
  ],
  [
    'hubs',
    Users,
    'Plan shared rain tanks',
    'যৌথ পানির ট্যাংকের পরিকল্পনা করুন',
    'Where shared tanks go and who they serve.',
    'যৌথ ট্যাংক কোথায় হবে, কারা পানি পাবেন।',
  ],
  [
    'water',
    MapPin,
    'Find a backup source',
    'বিকল্প পানির উৎস খুঁজুন',
    'Wells and taps near you for dry spells.',
    'শুষ্ক সময়ের জন্য কাছের নলকূপ ও কল।',
  ],
  [
    'care',
    ShieldCheck,
    'Check before you drink',
    'পান করার আগে যাচাই করুন',
    'What to ask before you drink any water.',
    'যেকোনো পানি পানের আগে কী জানবেন।',
  ],
];

const fieldTools = [
  [
    'rivers',
    Waves,
    'Explore rivers and pollution',
    'নদী ও দূষণের মানচিত্র দেখুন',
    'Follow mapped river links across Bangladesh and open the Dhaka satellite study.',
    'সারা বাংলাদেশের নদী সংযোগ ও ঢাকার স্যাটেলাইট গবেষণা দেখুন।',
  ],
  [
    'hubs',
    CloudRain,
    'Plan shared rain tanks',
    'যৌথ পানির ট্যাংকের পরিকল্পনা করুন',
    'Explore proposed sites and estimated dry-season supply.',
    'প্রস্তাবিত স্থান ও শুষ্ক মৌসুমের আনুমানিক সরবরাহ দেখুন।',
  ],
  [
    'samples',
    FlaskConical,
    'Read river measurements',
    'নদীর পরিমাপ দেখুন',
    'Compare dated field measurements from the Dhaka study area.',
    'ঢাকার গবেষণা এলাকার তারিখসহ নদীর পরিমাপ তুলনা করুন।',
  ],
  [
    'drill',
    Siren,
    'Practise a water outage',
    'পানি সরবরাহে বিঘ্নের মহড়া দিন',
    'Rehearse a pump failure with roles and field forms.',
    'পাম্প বিকল হলে কে কী করবেন, ফর্মসহ অনুশীলন করুন।',
  ],
  [
    'records',
    ClipboardList,
    'Open field records',
    'মাঠের নথি খুলুন',
    'Review private checks and measurements with your team account.',
    'দলের অ্যাকাউন্ট দিয়ে ব্যক্তিগত যাচাই ও পরিমাপের নথি দেখুন।',
  ],
  [
    'evidence',
    BookOpen,
    'Read the methods and sources',
    'পদ্ধতি ও তথ্যসূত্র দেখুন',
    'Check dates, coverage and what the evidence can tell you.',
    'তথ্যের তারিখ, এলাকার পরিধি ও সীমা দেখুন।',
  ],
];

function ToolLinks({ tools, bn, onGo, className = 'aq-tool-list' }) {
  return (
    <ul className={className}>
      {tools.map(([view, Icon, en, bangla, enDetail, bnDetail]) => (
        <li key={view}>
          <TaskLink view={view} bn={bn} onGo={onGo} className="aq-tool">
            <span className="aq-icon">
              <Icon size={23} aria-hidden="true" />
            </span>
            <span className="aq-tool-copy">
              <strong>{bn ? bangla : en}</strong>
              <span>{bn ? bnDetail : enDetail}</span>
            </span>
            <ArrowUpRight size={19} aria-hidden="true" />
          </TaskLink>
        </li>
      ))}
    </ul>
  );
}

const monthsEn = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const monthsBn = ['জা', 'ফে', 'মা', 'এ', 'মে', 'জু', 'জু', 'আ', 'সে', 'অ', 'ন', 'ডি'];

// Twelve bars of average monthly rain; the five driest months are amber.
function RainChart({ bn }) {
  const max = Math.max(...F.monthlyMm);
  const dry = [...F.monthlyMm].sort((a, b) => a - b)[4];
  const names = bn ? monthsBn : monthsEn;
  return (
    <figure
      className="aq-rain"
      aria-label={
        bn ? 'ঢাকা এলাকায় মাসিক গড় বৃষ্টিপাত' : 'Average rain per month in the Dhaka area'
      }
    >
      <figcaption className="aq-rain-top">
        <span>
          <CloudRain size={18} aria-hidden="true" />
          {bn ? 'ঢাকা এলাকায় মাসিক বৃষ্টি (মিমি)' : 'Rain in the Dhaka area, mm per month'}
        </span>
      </figcaption>
      <div className="aq-rain-plot">
        {F.monthlyMm.map((v, i) => (
          <div key={i} className="aq-rain-bar">
            <span className="aq-rain-value">{bn ? bnNum(v) : v}</span>
            <span
              className={'aq-rain-fill' + (v <= dry ? ' dry' : '')}
              style={{ height: (100 * v) / max + '%' }}
            />
            <span className="aq-rain-month">{names[i]}</span>
          </div>
        ))}
      </div>
      <p className="aq-rain-note">
        <span className="aq-rain-key" aria-hidden="true" />
        {bn
          ? `বছরে ${fmt(F.yearMm, true)} মিমি · সবচেয়ে শুষ্ক পাঁচ মাসে মাত্র ${fmt(F.dryFiveMm, true)} মিমি · CHIRPS ২০১৭–২০২১`
          : `${fmt(F.yearMm)} mm a year · only ${F.dryFiveMm} mm in the five driest months · CHIRPS 2017–2021`}
      </p>
    </figure>
  );
}

export function Home({ bn, onGo }) {
  return (
    <>
      <section
        className="aq-cover aq-shell"
        id="water-content"
        tabIndex={-1}
        lang={bn ? 'bn' : 'en'}
      >
        <div className="aq-cover-copy" data-enter>
          <p className="aq-location">
            <MapPin size={16} aria-hidden="true" />
            {bn ? 'বাংলাদেশ · বৃষ্টির পানি সংগ্রহ' : 'Bangladesh · Rainwater harvesting'}
          </p>
          <h1>
            {bn ? 'বৃষ্টির পানি জমান, সারা বছর পানি পান।' : 'Store the rain. Have water all year.'}
          </h1>
          <Brief
            bn={bn}
            problem={[
              'Rivers here are too dirty to drink, and almost no rain falls from November to March.',
              'এখানে নদীর পানি পান করার মতো পরিষ্কার নয়, আর নভেম্বর থেকে মার্চ প্রায় বৃষ্টি হয় না।',
            ]}
            purpose={[
              'Aquavelle helps you catch monsoon rain and keep it for the dry months.',
              'অ্যাকোয়াভেল বর্ষার বৃষ্টি ধরে শুষ্ক মাসের জন্য জমিয়ে রাখতে সাহায্য করে।',
            ]}
            steps={[
              ['Enter your roof and tank', 'ছাদ ও ট্যাংকের মাপ দিন'],
              ['See which months run short', 'কোন মাসে পানি কম পড়বে দেখুন'],
              ['Get a tank design and a backup source', 'ট্যাংকের নকশা ও বিকল্প উৎস পান'],
            ]}
            result={[
              `In the Dhaka plan, ${F.hubs} shared tanks give about ${fmt(F.hubPeople)} people water through the dry season in about 9 of 10 years.`,
              `ঢাকার পরিকল্পনায় ${bnNum(F.hubs)}টি যৌথ ট্যাংক প্রায় ${fmt(F.hubPeople, true)} মানুষকে প্রায় ১০ বছরের ৯ বছরই শুষ্ক মৌসুমজুড়ে পানি দেয়।`,
            ]}
          />
          <div className="aq-actions">
            <TaskLink view="supply" bn={bn} onGo={onGo} className="aq-action">
              {bn ? 'বৃষ্টির পানির ট্যাংক' : 'Plan a rain tank'}{' '}
              <ArrowRight size={19} aria-hidden="true" />
            </TaskLink>
            <TaskLink view="hubs" bn={bn} onGo={onGo} className="aq-inline">
              {bn ? 'যৌথ ট্যাংকের পরিকল্পনা দেখুন' : 'See shared rain tanks'}
            </TaskLink>
          </div>
        </div>
        <RainChart bn={bn} />
      </section>

      <section className="aq-home-tools" lang={bn ? 'bn' : 'en'}>
        <div className="aq-shell">
          <div className="aq-section-heading">
            <h2>{bn ? 'বৃষ্টির পানির সরঞ্জাম' : 'Rainwater tools'}</h2>
            <TaskLink view="field" bn={bn} onGo={onGo} className="aq-inline">
              {bn ? 'মাঠকর্মীদের সরঞ্জাম' : 'Field team tools'}{' '}
              <ArrowRight size={17} aria-hidden="true" />
            </TaskLink>
          </div>
          <ToolLinks
            tools={residentTools}
            bn={bn}
            onGo={onGo}
            className="aq-tool-list aq-tool-list-4"
          />
          <p className="aq-field-caption">
            <TaskLink view="rivers" bn={bn} onGo={onGo} className="aq-inline">
              <Waves size={17} aria-hidden="true" />
              {bn ? 'বাংলাদেশের নদী ও দূষণের মানচিত্র' : 'Bangladesh river and pollution atlas'}
            </TaskLink>
          </p>
        </div>
      </section>
    </>
  );
}

export function Field({ bn, onGo, session }) {
  return (
    <section
      className="aq-shell aq-task-page"
      id="water-content"
      tabIndex={-1}
      lang={bn ? 'bn' : 'en'}
    >
      <h1>{bn ? 'মাঠকর্মীদের সরঞ্জাম' : 'Field team tools'}</h1>
      <Brief
        bn={bn}
        problem={[
          'Rain tanks only help if they are built in the right place and kept running.',
          'বৃষ্টির ট্যাংক তখনই কাজে আসে যখন সঠিক জায়গায় বানানো হয় এবং চালু রাখা হয়।',
        ]}
        purpose={[
          'Tools for NGO and local government teams who plan and run them.',
          'এনজিও ও স্থানীয় সরকারের দলের জন্য পরিকল্পনা ও পরিচালনার সরঞ্জাম।',
        ]}
        steps={[
          ['Find polluted rivers and who lives nearby', 'দূষিত নদী ও কাছের মানুষ খুঁজুন'],
          ['Plan shared tanks', 'যৌথ ট্যাংকের পরিকল্পনা করুন'],
          ['Practise a breakdown', 'বিকল হলে কী করবেন অনুশীলন করুন'],
        ]}
        result={[
          'A plan you can check in the field before anything is built.',
          'বানানোর আগেই মাঠে যাচাই করা যায় এমন পরিকল্পনা।',
        ]}
      />
      {session?.signIn && !session.signedIn && (
        <p>
          <a className="aq-inline" href={session.signIn}>
            {bn ? 'দলের অ্যাকাউন্টে প্রবেশ করুন' : 'Sign in to your field account'}
          </a>
        </p>
      )}
      <ToolLinks tools={fieldTools} bn={bn} onGo={onGo} />
      <p className="aq-field-caption">
        <TaskLink view="response" bn={bn} onGo={onGo} className="aq-inline">
          {bn ? 'সরবরাহের পথ নিয়ে মহড়া' : 'Practise a delivery route'}
        </TaskLink>
        <a className="aq-inline" href="/?workspace=advanced">
          {bn ? 'গবেষণার সরঞ্জাম' : 'Research workspace'}
        </a>
      </p>
    </section>
  );
}

const care = [
  [
    'Ask whether the source is open and working.',
    'Check with the caretaker or local authority before travelling. Ask about opening times, cost and whether you can reach the point.',
    'উৎসটি খোলা ও সচল কি না জেনে নিন।',
    'যাওয়ার আগে তত্ত্বাবধায়ক বা স্থানীয় কর্তৃপক্ষের কাছে সময়, খরচ ও যাতায়াতের পথ জেনে নিন।',
  ],
  [
    'Ask for a recent test from that exact source.',
    'Ask when and where the sample was taken and what was tested. Clear water can still contain arsenic or germs. A result from a nearby well or river cannot answer for this source.',
    'ঠিক ওই উৎসের সাম্প্রতিক পরীক্ষার ফল চান।',
    'নমুনা কোথায় ও কবে নেওয়া হয়েছে এবং কী পরীক্ষা হয়েছে জিজ্ঞেস করুন। স্বচ্ছ পানিতেও আর্সেনিক বা জীবাণু থাকতে পারে। পাশের নলকূপ বা নদীর ফল দিয়ে এই উৎসের পানি বিচার করা যায় না।',
  ],
  [
    'Ask about a tested alternative if you are unsure.',
    'Talk to your local Department of Public Health Engineering (DPHE) office or water provider. Boiling does not remove arsenic or salt. Follow local advice if a source has flooded or has a chemical or salt concern.',
    'সন্দেহ হলে পরীক্ষিত বিকল্প উৎসের খোঁজ নিন।',
    'স্থানীয় জনস্বাস্থ্য প্রকৌশল অধিদপ্তর (ডিপিএইচই) বা পানি সরবরাহকারীর সঙ্গে কথা বলুন। পানি ফুটিয়ে আর্সেনিক বা লবণ দূর করা যায় না। উৎস ডুবে গেলে বা রাসায়নিক বা লবণের সমস্যা থাকলে স্থানীয় কর্তৃপক্ষের পরামর্শ নিন।',
  ],
];

export function WaterCare({ bn, onGo }) {
  return (
    <section
      className="aq-shell aq-task-page aq-care"
      id="water-content"
      tabIndex={-1}
      lang={bn ? 'bn' : 'en'}
    >
      <div className="aq-icon">
        <Droplet size={24} aria-hidden="true" />
      </div>
      <h1>{bn ? 'পান করার আগে যাচাই করুন' : 'Check before you drink'}</h1>
      <Brief
        bn={bn}
        problem={[
          'Clear water can still carry arsenic or germs.',
          'স্বচ্ছ পানিতেও আর্সেনিক বা জীবাণু থাকতে পারে।',
        ]}
        purpose={[
          'Know what to ask before anyone drinks from a well, tap or rain tank.',
          'নলকূপ, কল বা বৃষ্টির ট্যাংকের পানি পানের আগে কী জানতে হবে, জেনে নিন।',
        ]}
        steps={[
          ['Is it working?', 'উৎসটি সচল কি?'],
          ['Is there a recent test?', 'সাম্প্রতিক পরীক্ষার ফল আছে কি?'],
          ['Is there a tested backup?', 'পরীক্ষিত বিকল্প আছে কি?'],
        ]}
        result={['Ask these three questions every time.', 'প্রতিবার এই তিনটি প্রশ্ন করুন।']}
      />
      <ol className="aq-care-list">
        {care.map(([title, text, bnTitle, bnText]) => (
          <li key={title}>
            <h2>{bn ? bnTitle : title}</h2>
            <p>{bn ? bnText : text}</p>
          </li>
        ))}
      </ol>
      <ul className="aq-reference-links">
        <li>
          <a href="https://dphe.gov.bd/pages/static-pages/6922dc2b933eb65569e0ec2c">
            {bn ? 'ডিপিএইচই পানি পরীক্ষার মূল্য' : 'DPHE water testing fees'}{' '}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </li>
        <li>
          <a href="https://www.who.int/news-room/fact-sheets/detail/arsenic">
            {bn ? 'আর্সেনিক সম্পর্কে বিশ্ব স্বাস্থ্য সংস্থার তথ্য' : 'WHO guidance on arsenic'}{' '}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </li>
      </ul>
      <TaskLink view="water" bn={bn} onGo={onGo} className="aq-action">
        {bn ? 'পানির উৎস খুঁজুন' : 'Find water'} <ArrowRight size={19} aria-hidden="true" />
      </TaskLink>
    </section>
  );
}
