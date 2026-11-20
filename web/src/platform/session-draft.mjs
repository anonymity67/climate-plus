import { useEffect, useState } from 'react';
const storagePrefix = 'climateplus:v4:';
/** Local tab drafts only. No account data is transmitted by this hook. */
export function useSessionDraft(key, initial) {
  const storageKey = storagePrefix + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw && raw.length < 1000000) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
          return { ...initial, ...parsed };
      }
    } catch {}
    return initial;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey, value]);
  return [value, setValue];
}

export function clearFieldDrafts() {
  try {
    for (const key of [
      'source-check-drafts',
      'measurement-draft',
      'measurement-import',
      'measurement-request',
    ]) {
      sessionStorage.removeItem(storagePrefix + key);
    }
  } catch {}
}
