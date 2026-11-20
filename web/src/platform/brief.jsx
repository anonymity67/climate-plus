import React from 'react';
import { CircleCheck } from 'lucide-react';

// One short block at the top of each page, always in the same order:
// the problem, what the page is for, how to use it (three steps), and what you get.
// Each item is [English, Bangla]. Leave out steps when the page itself is laid out as numbered steps.
export function Brief({ bn, problem, purpose, steps, result }) {
  const t = ([en, bangla]) => (bn && bangla ? bangla : en);
  return (
    <div className="aq-brief">
      <p className="aq-brief-problem">{t(problem)}</p>
      <p className="aq-brief-purpose">{t(purpose)}</p>
      {steps?.length > 0 && (
        <ol className="aq-brief-steps">
          {steps.map((s, i) => (
            <li key={s[0]}>
              <span aria-hidden="true">{bn ? '১২৩৪'[i] : i + 1}</span>
              {t(s)}
            </li>
          ))}
        </ol>
      )}
      <p className="aq-brief-result">
        <CircleCheck size={19} aria-hidden="true" />
        <span>{t(result)}</span>
      </p>
    </div>
  );
}
