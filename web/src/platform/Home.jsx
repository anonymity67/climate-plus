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
} from 'lucide-react';

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
    'water',
    MapPin,
    'Find a water source',
    'পানির উৎস খুঁজুন',
    'Look up recorded wells and rainwater points by area.',
    'এলাকা বেছে নথিভুক্ত নলকূপ ও বৃষ্টির পানির উৎস খুঁজুন।',
  ],
  [
    'care',
    ShieldCheck,
    'Check before you drink',
    'পান করার আগে যাচাই করুন',
    'Know what to ask before using a source.',
    'পানির উৎস ব্যবহারের আগে কী জেনে নেবেন, দেখুন।',
  ],
  [
    'supply',
    CloudRain,
    'Plan a rain tank',
    'বৃষ্টির পানির ট্যাংকের পরিকল্পনা করুন',
    'See how much water your roof and tank could supply.',
    'ছাদ ও ট্যাংক থেকে কতটা পানি পাওয়া যেতে পারে, হিসাব করুন।',
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

function ToolLinks({ tools, bn, onGo }) {
  return (
    <ul className="aq-tool-list">
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
            {bn ? 'বাংলাদেশ' : 'Bangladesh'}
          </p>
          <h1>{bn ? 'পানি কোথায় পাবেন, কীভাবে যাচাই করবেন' : 'Find water. Know what to check.'}</h1>
          <p className="aq-intro">
            {bn
              ? 'কাছের নথিভুক্ত পানির উৎস খুঁজুন, ব্যবহারের আগে কী জেনে নেবেন দেখুন, আর শুষ্ক মৌসুমের জন্য বৃষ্টির পানি জমাতে পরিকল্পনা করুন।'
              : 'Look up water sources, find out what to ask before using one, and plan to store rain for the dry months.'}
          </p>
          <div className="aq-actions">
            <TaskLink view="water" bn={bn} onGo={onGo} className="aq-action">
              {bn ? 'পানির উৎস খুঁজুন' : 'Find water'} <ArrowRight size={19} aria-hidden="true" />
            </TaskLink>
            <TaskLink view="care" bn={bn} onGo={onGo} className="aq-inline">
              {bn ? 'পানি যাচাইয়ের উপায়' : 'How to check a source'}
            </TaskLink>
          </div>
        </div>
        <TaskLink view="rivers" bn={bn} onGo={onGo} className="aq-atlas">
          <img
            src="/images/bangladesh-river-atlas.webp"
            width="1000"
            height="780"
            alt=""
            fetchPriority="high"
          />
          <span className="aq-atlas-top">
            <span>
              <Waves size={18} aria-hidden="true" />
              {bn ? 'বাংলাদেশের নদী ও খাল' : 'Bangladesh river atlas'}
            </span>
            <ArrowUpRight size={21} aria-hidden="true" />
          </span>
          <span className="aq-atlas-bottom">
            <span className="aq-atlas-dot" aria-hidden="true" />
            {bn
              ? 'রিভারওয়াচের অগ্রাধিকার স্থান · নভেম্বর ২০২৬'
              : 'RiverWatch priority leads · Nov 2026'}
          </span>
        </TaskLink>
      </section>
      <section className="aq-home-tools" lang={bn ? 'bn' : 'en'}>
        <div className="aq-shell">
          <div className="aq-section-heading">
            <h2>{bn ? 'আজ কী করতে চান?' : 'Water tools for everyday use'}</h2>
            <TaskLink view="field" bn={bn} onGo={onGo} className="aq-inline">
              {bn ? 'মাঠকর্মীদের সরঞ্জাম' : 'Field team tools'}{' '}
              <ArrowRight size={17} aria-hidden="true" />
            </TaskLink>
          </div>
          <ToolLinks tools={residentTools} bn={bn} onGo={onGo} />
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
      <p className="aq-intro">
        {bn
          ? 'নমুনা সংগ্রহ, বৃষ্টির পানি সংরক্ষণ ও সরবরাহ বন্ধের মহড়ার পরিকল্পনা করুন।'
          : 'Plan sampling, rainwater storage and outage exercises.'}
      </p>
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
      <p className="aq-intro">
        {bn
          ? 'মানচিত্রের তথ্য আগের জরিপ থেকে এসেছে। পান করার সিদ্ধান্ত নিতে উৎসটির বর্তমান অবস্থা ও সাম্প্রতিক পরীক্ষার ফল দেখুন।'
          : 'The map shows records from past surveys. Check the source today and ask for recent test results before you use it for drinking.'}
      </p>
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
