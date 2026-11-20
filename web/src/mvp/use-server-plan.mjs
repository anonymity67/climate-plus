import { useCallback, useEffect, useState } from 'react';
import { fetchScenarioPlan } from './scenario-transport.mjs';
export function useServerPlan(input, graphHash, enabled) {
  const key = JSON.stringify([input, graphHash]),
    [state, setState] = useState({ key: null, data: null, error: '', loading: false }),
    [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    setState({ key, data: null, error: '', loading: true });
    fetchScenarioPlan(input, { expectedGraphHash: graphHash, signal: controller.signal })
      .then((data) => {
        if (active) setState({ key, data, error: '', loading: false });
      })
      .catch((e) => {
        if (active) setState({ key, data: null, error: e.message, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, enabled, revision]);
  return {
    ...(!enabled
      ? { data: null, error: '', loading: false }
      : state.key === key
        ? state
        : { data: null, error: '', loading: true }),
    retry,
  };
}
